import type { Mercado, StatusDoCadastro } from "dominio/tipos";
import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { cepDoErp } from "../localizacao/endereco.ts";
import { chaveDoCliente, numero, texto, textoOuNulo } from "./linha.ts";
import { ITENS_DAS_NOTAS, NOTA_DE_VENDA, PECAS_DO_ITEM, VALOR_DO_ITEM, data, emLista, textoDaData } from "./sql.ts";
import type { ClienteDaCarteira, DatasDeCompra, EnderecoDoCliente, VendaDoMes } from "./tipos.ts";

/*
 * A carteira dos representantes autorizados e a história de compras de cada cliente dela.
 * Carteira: clientes com VEND_1 de um autorizado e nota de venda nos 36 meses da janela, com o
 * status do cadastro do SGI, que a tela mostra quando não é ativo. O endereço só sai do Oracle na
 * empresa (FIS_JURID = 'J'), como o código do cliente: o da pessoa física é dado pessoal (CLAUDE.md,
 * regra 3).
 */

/**
 * O cliente C (CRCL) é da carteira: VEND_1 de um autorizado e nota de venda desde :inicio, o
 * começo da janela. Também é o filtro do catálogo, que é lido só para a carteira.
 */
export function condicaoDaCarteira(lista: string): string {
  return `C.VEND_1 IN ${lista}
        AND EXISTS (SELECT 1 FROM ABC71.NFME M
                     WHERE M.EMP_FIL = C.EMP_FIL AND M.FORNEC = C.CLIENTE
                       AND ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")})`;
}

/** Da nota M, o cliente é da carteira de um autorizado. */
function daCarteira(lista: string): string {
  return `EXISTS (SELECT 1 FROM ABC71.CRCL C WHERE C.EMP_FIL = M.EMP_FIL AND C.CLIENTE = M.FORNEC AND C.VEND_1 IN ${lista})`;
}

export async function lerCarteira(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<ClienteDaCarteira[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT C.EMP_FIL, C.CLIENTE, TRIM(C.FIS_JURID), C.NOM_FANTAS, C.RAZ_SOCIAL || C.COMPLEM_RZ,
            TRIM(C.CIDADE), TRIM(C.ESTADO), TRIM(C.TIPO_CLI), C.VEND_1, TRIM(G.CLI3_STA), C.RESERVADO7,
            UPPER(TRIM(G.CLI3_GRP)),
            CASE WHEN TRIM(C.FIS_JURID) = 'J' THEN TRIM(C.ENDERECO) END,
            CASE WHEN TRIM(C.FIS_JURID) = 'J' THEN TRIM(C.BAIRRO) END,
            CASE WHEN TRIM(C.FIS_JURID) = 'J' THEN C.CEP END
       FROM ABC71.CRCL C
       LEFT JOIN ABC71.SGI5_TAB_VEN_CLI3 G ON G.CLI3_CLI = C.CLIENTE
      WHERE ${condicaoDaCarteira(lista.sql)}`,
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
    status: statusDoCadastro(textoOuNulo(linha, 9)),
    municipio: municipioDoCadastro(textoOuNulo(linha, 10), texto(linha, 6)),
    grupo: grupoDoCadastro(textoOuNulo(linha, 11)),
    endereco: enderecoDoCadastro(textoOuNulo(linha, 12), textoOuNulo(linha, 13), textoOuNulo(linha, 14)),
    ponto: null,
  }));
}

/** Sem a rua, não há endereço para mostrar nem para pôr no mapa. */
export function enderecoDoCadastro(rua: string | null, bairro: string | null, cep: string | null): EnderecoDoCliente | null {
  if (rua === null) return null;
  return { texto: semEspacosSobrando(rua), bairro: bairro === null ? null : semEspacosSobrando(bairro), cep: cepDoErp(cep === null ? null : Number(cep)) };
}

/**
 * O campo Grupo do cadastro do SGI (Vendas → Clientes), como está: o texto digitado ou o nome
 * fantasia, que a tela grava com o campo vazio (untVenCli_CliMov.pas:148-151) e que nada atualiza
 * quando o fantasia muda no Omega.
 */
export function grupoDoCadastro(grupo: string | null): string | null {
  return grupo === null ? null : semEspacosSobrando(grupo);
}

/** TIPO_CLI: M = montadora, E = exportação, o resto é praça (CRM-prototipo/REGRAS.md). */
export function mercadoDoTipoDeCliente(tipo: string | null): Mercado {
  if (tipo === "M") return "MONTADORA";
  if (tipo === "E") return "EXPORTACAO";
  return "PRACA";
}

/** Os dois primeiros dígitos do código IBGE dos municípios de cada estado. */
const CODIGO_IBGE_DA_UF: Readonly<Record<string, string>> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

/**
 * O município pelo código IBGE do cadastro (CRCL.RESERVADO7, que a GNRE do SGI manda como código da
 * cidade). Em 2026-10-15, os 178 clientes da Star Vendas tinham 7 dígitos, sempre do estado deles.
 * Fora do formato ou de outro estado, o cliente fica sem município, e o mapa não o põe em lugar nenhum.
 */
export function municipioDoCadastro(codigo: string | null, uf: string): string | null {
  const prefixo = CODIGO_IBGE_DA_UF[uf];
  return codigo !== null && prefixo !== undefined && /^\d{7}$/.test(codigo) && codigo.startsWith(prefixo) ? codigo : null;
}

/** Os valores do CLI3_STA, os mesmos da tela de cadastro do SGI (untVenCli_CliMov.dfm:573-576). */
const STATUS_DO_SGI = new Map<string, StatusDoCadastro>([
  ["ATIVO", "ativo"],
  ["INATIVO", "inativo"],
  ["SUBSTITUIDO", "substituido"],
]);

/**
 * O cliente sem status conta como ATIVO, como no próprio SGI (untDmVenPvd.dfm:2572). Um valor
 * novo no SGI para a foto: sem saber o que ele significa, o CRM não decide se o cliente recebe pedido.
 */
export function statusDoCadastro(valorNoSgi: string | null): StatusDoCadastro {
  const status = STATUS_DO_SGI.get(valorNoSgi ?? "ATIVO");
  if (!status) throw new Error(`Status de cliente desconhecido no cadastro do SGI (CLI3_STA): ${valorNoSgi}`);
  return status;
}

/** Faturado e peças de cada cliente por mês, desde o começo dos meses da ficha, que cobrem a janela das análises. */
export async function lerVendasPorMes(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<VendaDoMes[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT M.EMP_FIL, M.FORNEC, ${textoDaData("M.DT_EMISSAO", "YYYY-MM")}, SUM(${VALOR_DO_ITEM}), SUM(${PECAS_DO_ITEM})
     ${ITENS_DAS_NOTAS}
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${daCarteira(lista.sql)}
      GROUP BY M.EMP_FIL, M.FORNEC, ${textoDaData("M.DT_EMISSAO", "YYYY-MM")}`,
    { ...lista.binds, inicio: referencia.inicioDaFicha },
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
