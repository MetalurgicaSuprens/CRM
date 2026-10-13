import { montarReferencia, type Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { lerCalendario, lerMomentoDoOracle, lerNomesDosRepresentantes } from "./cadastros.ts";
import { lerCarteira, lerDatasDeCompra, lerVendasPorMes } from "./carteira.ts";
import { lerNotasRecentes, lerVendasPorDia } from "./faturamento.ts";
import { lerFamiliasDaSuprens, lerProdutosMaisComprados } from "./familias.ts";
import { lerPedidosEmAberto } from "./pedidos.ts";
import type { DadosDoErp } from "./tipos.ts";

export type Progresso = (mensagem: string) => void;

/** Tudo o que a foto precisa, lido do ERP numa conexão só, uma consulta depois da outra. */
export async function lerDadosDoErp(
  oracle: Oracle,
  autorizados: string[],
  progresso: Progresso,
): Promise<{ referencia: Referencia; dados: DadosDoErp }> {
  const geradaEm = await lerMomentoDoOracle(oracle);
  const referencia = montarReferencia(geradaEm);
  const etapa = async <T>(nome: string, ler: () => Promise<T>): Promise<T> => {
    const inicio = Date.now();
    const resultado = await ler();
    progresso(`${nome}: ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
    return resultado;
  };
  const dados: DadosDoErp = {
    geradaEm,
    representantes: await etapa("representantes", () => lerNomesDosRepresentantes(oracle, autorizados)),
    carteira: await etapa("carteira", () => lerCarteira(oracle, referencia, autorizados)),
    vendasDoMes: await etapa("vendas por mês", () => lerVendasPorMes(oracle, referencia, autorizados)),
    datasDeCompra: await etapa("datas de compra", () => lerDatasDeCompra(oracle, referencia, autorizados)),
    familias: await etapa("famílias da Suprens", () => lerFamiliasDaSuprens(oracle, referencia)),
    produtos: await etapa("produtos", () => lerProdutosMaisComprados(oracle, referencia, autorizados)),
    pedidos: await etapa("pedidos em aberto", () => lerPedidosEmAberto(oracle, referencia)),
    notas: await etapa("notas recentes", () => lerNotasRecentes(oracle, referencia, autorizados)),
    vendasDoDia: await etapa("vendas por dia", () => lerVendasPorDia(oracle, referencia, autorizados)),
    diasUteis: await etapa("calendário", () => lerCalendario(oracle, referencia)),
  };
  return { referencia, dados };
}
