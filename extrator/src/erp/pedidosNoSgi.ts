import type { Oracle } from "../oracle.ts";
import { numero, texto, textoOuNulo } from "./linha.ts";
import { emLista, textoDaData } from "./sql.ts";
import type { CondicoesNoSgi, ReferenciasDoItemNoSgi, TransportadoraDoErp } from "./tipos.ts";
import { linhaParaTransportadora, SELECT_DA_TRANSPORTADORA } from "./dadosDoPedido.ts";

/*
 * O que o representante preencheu nos pedidos do Omega que não nasceram no CRM (pedido do Lucas em
 * 2026-11-24): o SGI guarda tudo no pedido de origem (SGI5_TAB_VEN_PV1_V2 e PV2_V2), e o Omega só
 * parte disso. O pedido do Omega é o do SGI com o mesmo número (VEPM.NUMERO = PV1_NPE); quem confere o
 * cliente é o cálculo (calculo/condicoesDosPedidos.ts). Lidos em blocos, para a lista de variáveis
 * não passar do limite do Oracle.
 */

const PEDIDOS_POR_CONSULTA = 900;

/** O cabeçalho dos pedidos do SGI com esses números. */
export async function lerCondicoesNoSgi(oracle: Oracle, pedidos: readonly string[]): Promise<CondicoesNoSgi[]> {
  return emBlocos(pedidos, async (lista) => {
    const linhas = await oracle.consultar(
      `SELECT A.PV1_NPE, A.PV1_CLI, A.PV1_TRA, A.PV1_CPG, TRIM(A.PV1_TEN), ${textoDaData("A.PV1_DEN")}, TRIM(A.PV1_OCO),
              TRIM(A.PV1_CVE), TRIM(A.PV1_TFR), TRIM(A.PV1_PFR), TRIM(A.PV1_OBS)
         FROM ABC71.SGI5_TAB_VEN_PV1_V2 A
        WHERE A.PV1_NPE IN ${lista.sql}`,
      lista.binds,
    );
    return linhas.map((linha) => ({
      pedido: String(numero(linha, 0)),
      cliente: numero(linha, 1),
      transportadora: codigoOuNulo(numero(linha, 2)),
      condicaoDePagamento: codigoOuNulo(numero(linha, 3)),
      tipoDeEntrega: textoOuNulo(linha, 4),
      entrega: textoOuNulo(linha, 5),
      ordemDeCompra: textoOuNulo(linha, 6),
      classificacao: textoOuNulo(linha, 7),
      freteParcial: textoOuNulo(linha, 8),
      pagamentoDoFrete: textoOuNulo(linha, 9),
      observacao: textoOuNulo(linha, 10),
    }));
  });
}

/** O part number, a ordem de compra e o item dela em cada linha dos pedidos do SGI, na ordem do pedido. */
export async function lerReferenciasDosItensNoSgi(oracle: Oracle, pedidos: readonly string[]): Promise<ReferenciasDoItemNoSgi[]> {
  return emBlocos(pedidos, async (lista) => {
    const linhas = await oracle.consultar(
      `SELECT B.PV2_NPE, TRIM(B.PV2_PAC), TRIM(B.PV2_PNU), TRIM(B.PV2_OCO), B.PV2_IOC
         FROM ABC71.SGI5_TAB_VEN_PV2_V2 B
        WHERE B.PV2_NPE IN ${lista.sql}
        ORDER BY B.PV2_NPE, B.PV2_ITE`,
      lista.binds,
    );
    return linhas.map((linha) => ({
      pedido: String(numero(linha, 0)),
      produto: texto(linha, 1),
      partNumber: textoOuNulo(linha, 2),
      ordemDeCompra: textoOuNulo(linha, 3),
      itemDaOrdemDeCompra: numero(linha, 4) > 0 ? numero(linha, 4) : null,
    }));
  });
}

/**
 * As transportadoras com esses códigos, ativas ou não: as dos pedidos antigos que hoje estão inativas
 * (121 pedidos em 2026-11-24) também precisam do nome e do CNPJ na tela.
 */
export async function lerTransportadorasPorCodigo(oracle: Oracle, codigos: readonly string[]): Promise<TransportadoraDoErp[]> {
  return emBlocos(codigos, async (lista) => {
    const linhas = await oracle.consultar(`${SELECT_DA_TRANSPORTADORA} WHERE A.FORNEC IN ${lista.sql}`, lista.binds);
    return linhas.map(linhaParaTransportadora);
  });
}

async function emBlocos<T>(valores: readonly string[], ler: (lista: ReturnType<typeof emLista>) => Promise<T[]>): Promise<T[]> {
  const resultado: T[] = [];
  for (let inicio = 0; inicio < valores.length; inicio += PEDIDOS_POR_CONSULTA) {
    resultado.push(...(await ler(emLista("v", valores.slice(inicio, inicio + PEDIDOS_POR_CONSULTA)))));
  }
  return resultado;
}

/** O código zero é o "sem" do SGI. */
function codigoOuNulo(codigo: number): string | null {
  return codigo === 0 ? null : String(codigo);
}
