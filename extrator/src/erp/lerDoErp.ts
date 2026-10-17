import { montarReferencia, type Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { lerMomentoDoOracle, lerNomesDosRepresentantes } from "./cadastros.ts";
import { lerCarteira, lerDatasDeCompra, lerVendasPorMes } from "./carteira.ts";
import { lerPrecos, lerProdutosDasTabelas, lerProdutosJaComprados, lerTabelasDosClientes } from "./catalogo.ts";
import { lerNotasRecentes, lerPedidosFaturados, lerVendasPorDia } from "./faturamento.ts";
import { lerFamiliasDaSuprens, lerProdutosDoAno } from "./familias.ts";
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
  const tabelas = await etapa("tabelas de preço", () => lerTabelasDosClientes(oracle, referencia, autorizados));
  const dados: DadosDoErp = {
    geradaEm,
    representantes: await etapa("representantes", () => lerNomesDosRepresentantes(oracle, autorizados)),
    carteira: await etapa("carteira", () => lerCarteira(oracle, referencia, autorizados)),
    vendasDoMes: await etapa("vendas por mês", () => lerVendasPorMes(oracle, referencia, autorizados)),
    datasDeCompra: await etapa("datas de compra", () => lerDatasDeCompra(oracle, referencia, autorizados)),
    familias: await etapa("famílias da Suprens", () => lerFamiliasDaSuprens(oracle, referencia)),
    produtos: await etapa("produtos", () => lerProdutosDoAno(oracle, referencia, autorizados)),
    pedidos: await etapa("pedidos em aberto", () => lerPedidosEmAberto(oracle)),
    pedidosFaturados: await etapa("pedidos faturados", () => lerPedidosFaturados(oracle, referencia, autorizados)),
    notas: await etapa("notas recentes", () => lerNotasRecentes(oracle, referencia, autorizados)),
    vendasDoDia: await etapa("vendas por dia", () => lerVendasPorDia(oracle, referencia, autorizados)),
    tabelas,
    precos: await etapa("preços", () => lerPrecos(oracle, referencia, autorizados)),
    produtosDasTabelas: await etapa("produtos das tabelas", () =>
      lerProdutosDasTabelas(oracle, [...new Set(tabelas.map((tabela) => tabela.tabela))]),
    ),
    jaComprados: await etapa("produtos já comprados", () => lerProdutosJaComprados(oracle, referencia, autorizados)),
  };
  return { referencia, dados };
}
