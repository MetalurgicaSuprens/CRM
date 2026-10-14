import { isClienteNegativo } from "dominio/clienteNegativo";
import type { Mercado } from "dominio/tipos";
import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { chaveDoCliente, numero, texto, textoOuNulo } from "./linha.ts";
import { ITENS_DAS_NOTAS, NOTA_DE_VENDA, PECAS_DO_ITEM, VALOR_DO_ITEM, data, emLista, textoDaData } from "./sql.ts";
import type { ClienteDaCarteira, DatasDeCompra, VendaDoMes } from "./tipos.ts";

/*
 * A carteira dos representantes autorizados e a história de compras de cada cliente dela.
 * Carteira: clientes com VEND_1 de um autorizado e nota de venda nos 36 meses da janela. O status
 * do SGI só serve para marcar o cliente negativo: a foto não leva o status em si.
 */

/** Da nota M, o cliente é da carteira de um autorizado. */
function daCarteira(lista: string): string {
  return `EXISTS (SELECT 1 FROM ABC71.CRCL C WHERE C.EMP_FIL = M.EMP_FIL AND C.CLIENTE = M.FORNEC AND C.VEND_1 IN ${lista})`;
}

export async function lerCarteira(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<ClienteDaCarteira[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT C.EMP_FIL, C.CLIENTE, TRIM(C.FIS_JURID), C.NOM_FANTAS, C.RAZ_SOCIAL || C.COMPLEM_RZ,
            TRIM(C.CIDADE), TRIM(C.ESTADO), TRIM(C.TIPO_CLI), C.VEND_1, TRIM(G.CLI3_STA)
       FROM ABC71.CRCL C
       LEFT JOIN ABC71.SGI5_TAB_VEN_CLI3 G ON G.CLI3_CLI = C.CLIENTE
      WHERE C.VEND_1 IN ${lista.sql}
        AND EXISTS (SELECT 1 FROM ABC71.NFME M
                     WHERE M.EMP_FIL = C.EMP_FIL AND M.FORNEC = C.CLIENTE
                       AND ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")})`,
    { ...lista.binds, inicio: referencia.inicioDaJanela },
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    empresa: numero(linha, 0),
    cliente: numero(linha, 1),
    // Só a empresa (J) mostra o código do ERP; na dúvida, trata como pessoa física.
    isPessoaFisica: texto(linha, 2) !== "J",
    fantasia: semEspacosSobrando(texto(linha, 3)),
    razaoSocial: semEspacosSobrando(texto(linha, 4)),
    cidade: texto(linha, 5),
    uf: texto(linha, 6),
    mercado: mercadoDoTipoDeCliente(textoOuNulo(linha, 7)),
    representante: String(numero(linha, 8)),
    isNegativo: isClienteNegativo(textoOuNulo(linha, 9)),
  }));
}

/** TIPO_CLI: M = montadora, E = exportação, o resto é praça (CRM-prototipo/REGRAS.md). */
export function mercadoDoTipoDeCliente(tipo: string | null): Mercado {
  if (tipo === "M") return "MONTADORA";
  if (tipo === "E") return "EXPORTACAO";
  return "PRACA";
}

export async function lerVendasPorMes(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<VendaDoMes[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT M.EMP_FIL, M.FORNEC, ${textoDaData("M.DT_EMISSAO", "YYYY-MM")}, SUM(${VALOR_DO_ITEM}), SUM(${PECAS_DO_ITEM})
     ${ITENS_DAS_NOTAS}
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${daCarteira(lista.sql)}
      GROUP BY M.EMP_FIL, M.FORNEC, ${textoDaData("M.DT_EMISSAO", "YYYY-MM")}`,
    { ...lista.binds, inicio: referencia.inicioDaJanela },
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    mes: texto(linha, 2),
    valor: numero(linha, 3),
    pecas: numero(linha, 4),
  }));
}

export async function lerDatasDeCompra(
  oracle: Oracle,
  referencia: Referencia,
  autorizados: string[],
): Promise<Map<string, DatasDeCompra>> {
  const lista = emLista("r", autorizados);
  const binds = { ...lista.binds, inicio: referencia.inicioDaJanela };
  const extremos = await oracle.consultar(
    `SELECT M.EMP_FIL, M.FORNEC, ${textoDaData("MIN(M.DT_EMISSAO)")},
            ${textoDaData(`MAX(CASE WHEN M.DT_EMISSAO < ${data("inicio")} THEN M.DT_EMISSAO END)`)}
       FROM ABC71.NFME M
      WHERE ${NOTA_DE_VENDA} AND ${daCarteira(lista.sql)}
      GROUP BY M.EMP_FIL, M.FORNEC`,
    binds,
  );
  const datas = await oracle.consultar(
    `SELECT M.EMP_FIL, M.FORNEC, ${textoDaData("TRUNC(M.DT_EMISSAO)")}
       FROM ABC71.NFME M
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${daCarteira(lista.sql)}
      GROUP BY M.EMP_FIL, M.FORNEC, TRUNC(M.DT_EMISSAO)
      ORDER BY 3`,
    binds,
  );
  const porCliente = new Map<string, DatasDeCompra>(
    extremos.map((linha) => [
      chaveDoCliente(numero(linha, 0), numero(linha, 1)),
      { primeiraCompra: texto(linha, 2), ultimaAntesDaJanela: textoOuNulo(linha, 3), datas: [] },
    ]),
  );
  for (const linha of datas) porCliente.get(chaveDoCliente(numero(linha, 0), numero(linha, 1)))?.datas.push(texto(linha, 2));
  return porCliente;
}

function semEspacosSobrando(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}
