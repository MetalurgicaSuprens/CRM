import { montarReferencia, type Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { lerMomentoDoOracle, lerNomesDosRepresentantes } from "./cadastros.ts";
import { lerCarteira, lerDatasDeCompra, lerVendasPorMes } from "./carteira.ts";
import { lerPartNumbersDaBiblia, lerPartNumbersDasTabelas, lerPrecos, lerProdutosDasTabelas, lerProdutosJaComprados, lerTabelasDosClientes } from "./catalogo.ts";
import { lerNotasRecentes, lerPedidosFaturados, lerVendasPorDia } from "./faturamento.ts";
import { lerFamiliasDaSuprens, lerProdutosDoAno } from "./familias.ts";
import { lerCadastros, lerCondicoes, lerEscolhas, lerLocais, lerPartNumbersUsados, lerTransportadoras, lerTransportadorasDosRepresentantes, lerUltimosPedidos } from "./dadosDoPedido.ts";
import { lerPedidosEmAberto } from "./pedidos.ts";
import { lerCondicoesNoSgi, lerReferenciasDosItensNoSgi, lerTransportadorasPorCodigo } from "./pedidosNoSgi.ts";
import type { CondicoesNoSgi, DadosDoErp, TransportadoraDoErp } from "./tipos.ts";

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
  const dados = {
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
    partNumbers: await etapa("part numbers da Bíblia Montadora", () => lerPartNumbersDaBiblia(oracle)),
    partNumbersDasTabelas: await etapa("part numbers das tabelas próprias", () =>
      lerPartNumbersDasTabelas(oracle, [...new Set(tabelas.map((tabela) => tabela.tabela))]),
    ),
    partNumbersUsados: await etapa("part numbers usados nos pedidos", () => lerPartNumbersUsados(oracle, referencia, autorizados)),
    produtosDasTabelas: await etapa("produtos das tabelas", () =>
      lerProdutosDasTabelas(oracle, [...new Set(tabelas.map((tabela) => tabela.tabela))]),
    ),
    jaComprados: await etapa("produtos já comprados", () => lerProdutosJaComprados(oracle, referencia, autorizados)),
    dadosDoPedido: {
      cadastros: await etapa("cadastro dos clientes", () => lerCadastros(oracle, referencia, autorizados)),
      locais: await etapa("cobrança e entrega", () => lerLocais(oracle, referencia, autorizados)),
      transportadoras: await etapa("transportadoras", () => lerTransportadoras(oracle)),
      condicoes: await etapa("condições de pagamento", () => lerCondicoes(oracle, referencia, autorizados)),
      escolhas: await etapa("escolhas dos pedidos", () => lerEscolhas(oracle, referencia, autorizados)),
      transportadorasDosRepresentantes: await etapa("transportadoras dos representantes", () => lerTransportadorasDosRepresentantes(oracle, referencia, autorizados)),
      ultimosPedidos: await etapa("últimos pedidos", () => lerUltimosPedidos(oracle, referencia, autorizados)),
    },
  };
  const pedidos = [...new Set([...dados.pedidos, ...dados.pedidosFaturados].map(({ pedido }) => pedido))];
  const condicoes = await etapa("condições dos pedidos no SGI", () => lerCondicoesNoSgi(oracle, pedidos));
  const itens = await etapa("part numbers e ordens de compra dos pedidos no SGI", () => lerReferenciasDosItensNoSgi(oracle, pedidos));
  const transportadorasInativas = await etapa("transportadoras inativas dos pedidos", () =>
    lerTransportadorasPorCodigo(oracle, codigosInativos(condicoes, dados.dadosDoPedido.transportadoras)),
  );
  return { referencia, dados: { ...dados, dadosDoPedido: { ...dados.dadosDoPedido, transportadorasInativas }, pedidosNoSgi: { condicoes, itens } } };
}

/** As transportadoras dos pedidos que não estão entre as ativas. */
function codigosInativos(condicoes: readonly CondicoesNoSgi[], ativas: readonly TransportadoraDoErp[]): string[] {
  const codigosAtivos = new Set(ativas.map(({ codigo }) => codigo));
  return [...new Set(condicoes.flatMap(({ transportadora }) => (transportadora && !codigosAtivos.has(transportadora) ? [transportadora] : [])))];
}
