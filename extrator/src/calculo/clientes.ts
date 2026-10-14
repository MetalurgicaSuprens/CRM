import { analisarCliente, type AnaliseDoCliente, type HistoricoDoCliente } from "dominio/analises";
import { cicloTipico, comprasDasNotas } from "dominio/ciclo";
import type { Foto } from "dominio/esquemaDaFoto";
import { evolucao12m, variacao12m } from "dominio/indicadores";
import { sugerirMix, type ClienteNoMix, type SugestaoDeMix } from "dominio/mix";
import type { ClienteDaCarteira, DadosDoErp, DatasDeCompra, FamiliaDoCliente, VendaDoMes } from "../erp/tipos.ts";
import { nomeDoCliente } from "./nomeDoCliente.ts";
import { MESES_FECHADOS, type Referencia } from "./referencia.ts";

/*
 * As tabelas dos clientes da carteira: cadastro, indicadores, ficha e análises, com as regras do
 * módulo dominio (as mesmas do protótipo).
 */

export const SEM_FAMILIA = "SEM FAMÍLIA";
/** A Ficha mostra 24 meses fechados e o corrente. */
const MESES_DA_FICHA = 25;

export type TabelasDosClientes = Pick<
  Foto,
  | "cliente"
  | "cliente_mes"
  | "cliente_familia"
  | "produto"
  | "ficha_produto"
  | "cliente_mix"
  | "analise_parado"
  | "analise_ritmo"
  | "analise_novo"
  | "analise_mix"
>;

type MesDoCliente = { mes: string; valor: number; pecas: number };

/** Um cliente da carteira com o que as regras dizem dele. */
type ClienteAnalisado = {
  id: string;
  cliente: ClienteDaCarteira;
  /** Os 36 meses fechados e o corrente. */
  mensal: MesDoCliente[];
  historico: HistoricoDoCliente;
  analise: AnaliseDoCliente;
  evolucao: number[];
  mix: SugestaoDeMix | null;
};

export function montarClientes(
  dados: DadosDoErp,
  referencia: Referencia,
  idDe: (cliente: ClienteDaCarteira) => string,
): TabelasDosClientes {
  const suprens = populacaoDoMix(dados.familias);
  const vendas = agruparPor(dados.vendasDoMes, (venda) => venda.chave);
  const familias = agruparPor(dados.familias, (familia) => familia.chave);
  const comPedido = new Set(dados.pedidos.map((pedido) => pedido.chave));
  const analisados = dados.carteira.flatMap((cliente) => {
    const datas = dados.datasDeCompra.get(cliente.chave);
    if (!datas) return [];
    const base = analisar(datas, vendas.get(cliente.chave) ?? [], comPedido.has(cliente.chave), referencia);
    const noMix = suprens.porChave.get(cliente.chave) ?? semComprasNoMix(cliente);
    return [{ id: idDe(cliente), cliente, ...base, mix: sugerirMix(noMix, suprens.todos) }];
  });
  const idPorChave = new Map(analisados.map(({ id, cliente }) => [cliente.chave, id]));
  const produtosDaFicha = dados.produtos.filter((produto) => idPorChave.has(produto.chave));
  return {
    cliente: analisados.map(linhaDoCliente),
    cliente_mes: analisados.flatMap(({ id, mensal }) => mensal.slice(-MESES_DA_FICHA).map(({ mes, valor }) => ({ cliente: id, mes, valor }))),
    cliente_familia: analisados.flatMap(({ id, cliente }) => familiasDaFicha(id, familias.get(cliente.chave) ?? [])),
    produto: [...new Map(produtosDaFicha.map((produto) => [produto.produto, produto.familia ?? SEM_FAMILIA])).entries()].map(
      ([produto, familia]) => ({ produto, familia }),
    ),
    ficha_produto: produtosDaFicha.map((produto) => ({
      cliente: idPorChave.get(produto.chave) ?? "",
      produto: produto.produto,
      pecas_12m: produto.pecas,
      valor_12m: produto.valor,
      ultima_compra: produto.ultimaCompra,
    })),
    cliente_mix: analisados.flatMap(({ id, mix }) =>
      (mix?.oportunidades ?? []).map((oportunidade, i) => ({ cliente: id, ...oportunidade, ordem: i + 1 })),
    ),
    ...montarAnalises(analisados),
  };
}

function analisar(datas: DatasDeCompra, vendas: VendaDoMes[], temPedidoEmAberto: boolean, referencia: Referencia) {
  const mensal = referencia.meses.map((mes) => {
    const venda = vendas.find((candidata) => candidata.mes === mes);
    return { mes, valor: venda?.valor ?? 0, pecas: venda?.pecas ?? 0 };
  });
  const compras = datas.ultimaAntesDaJanela ? [datas.ultimaAntesDaJanela, ...datas.datas] : datas.datas;
  const historico: HistoricoDoCliente = {
    mensal: mensal.slice(0, MESES_FECHADOS),
    compras,
    primeiraCompra: datas.primeiraCompra,
    cicloDias: cicloTipico(comprasDasNotas(compras), referencia.hoje),
    temPedidoEmAberto,
  };
  return {
    mensal,
    historico,
    analise: analisarCliente(historico, referencia.hoje),
    evolucao: evolucao12m(historico.mensal.map((mes) => mes.valor)),
  };
}

function linhaDoCliente({ id, cliente, historico, analise, evolucao, mix }: ClienteAnalisado): Foto["cliente"][number] {
  return {
    cliente: id,
    codigo_erp: cliente.isPessoaFisica ? null : String(cliente.cliente),
    representante: cliente.representante,
    nome: nomeDoCliente(cliente.fantasia, cliente.razaoSocial),
    razao_social: cliente.razaoSocial,
    cidade: cliente.cidade,
    uf: cliente.uf,
    mercado: cliente.mercado,
    situacao: analise.situacao,
    negativo: cliente.isNegativo ? 1 : 0,
    ultima_compra: historico.compras.at(-1) ?? null,
    cliente_desde: Number(historico.primeiraCompra.slice(0, 4)),
    ciclo_dias: historico.cicloDias,
    faturamento_12m: evolucao.at(-1) ?? 0,
    variacao_12m: variacao12m(evolucao),
    evolucao_12m: JSON.stringify(evolucao),
    grupo_mix: mix ? (mix.porte ?? "mercado") : null,
  };
}

/** Famílias compradas nos 12 meses fechados, com a parte de cada uma no faturado. */
function familiasDaFicha(id: string, familias: FamiliaDoCliente[]): Foto["cliente_familia"] {
  const total = familias.reduce((soma, familia) => soma + familia.valor12m, 0);
  if (total <= 0) return [];
  const porNome = new Map<string, number>();
  for (const { familia, valor12m } of familias) {
    const nome = familia ?? SEM_FAMILIA;
    porNome.set(nome, (porNome.get(nome) ?? 0) + valor12m);
  }
  return [...porNome.entries()]
    .filter(([, valor]) => valor > 0)
    .map(([familia, valor]) => ({ cliente: id, familia, valor, participacao: valor / total }));
}

/** As listas das análises, cada uma na ordem da sua regra, numerada para toda a carteira. */
function montarAnalises(analisados: ClienteAnalisado[]): Pick<
  TabelasDosClientes,
  "analise_parado" | "analise_ritmo" | "analise_novo" | "analise_mix"
> {
  const diferenca = (linha: { semestre: number; semestre_ano_anterior: number }) => linha.semestre - linha.semestre_ano_anterior;
  const ritmo = (direcao: "menos" | "mais") =>
    analisados.flatMap(({ id, analise }) =>
      analise.ritmo?.direcao === direcao
        ? [
            {
              cliente: id,
              direcao,
              semestre: analise.ritmo.semestre,
              semestre_ano_anterior: analise.ritmo.semestreAnoAnterior,
              variacao: analise.ritmo.variacao,
              variacao_pecas: analise.ritmo.variacaoPecas,
            },
          ]
        : [],
    );
  return {
    analise_parado: numerar(
      analisados.flatMap(({ id, analise }) => (analise.parada ? [{ cliente: id, perda_mensal: analise.parada.perdaMensal }] : [])),
      (a, b) => b.perda_mensal - a.perda_mensal,
    ),
    analise_ritmo: [
      ...numerar(ritmo("menos"), (a, b) => diferenca(a) - diferenca(b)),
      ...numerar(ritmo("mais"), (a, b) => diferenca(b) - diferenca(a)),
    ],
    analise_novo: numerar(
      analisados.flatMap(({ id, analise, mensal }) =>
        analise.entrada
          ? [{ cliente: id, tipo: analise.entrada.tipo, desde: analise.entrada.desde, faturado_desde: faturadoDesde(mensal, analise.entrada.desde) }]
          : [],
      ),
      (a, b) => b.faturado_desde - a.faturado_desde,
    ),
    analise_mix: numerar(
      analisados.flatMap(({ id, analise, mix, evolucao }) =>
        analise.isAtivo && mix && mix.oportunidades.length > 0 ? [{ cliente: id, faturamento: evolucao.at(-1) ?? 0 }] : [],
      ),
      (a, b) => b.faturamento - a.faturamento,
    ).map(({ cliente, ordem }) => ({ cliente, ordem })),
  };
}

/** Do mês da data até o mês corrente, inclusive. */
function faturadoDesde(mensal: MesDoCliente[], data: string): number {
  return mensal.filter(({ mes }) => mes >= data.slice(0, 7)).reduce((soma, { valor }) => soma + valor, 0);
}

/** Ordena e numera a partir de 1; no empate, mantém a ordem da carteira. */
function numerar<T>(itens: T[], comparar: (a: T, b: T) => number): (T & { ordem: number })[] {
  return [...itens].sort(comparar).map((item, i) => ({ ...item, ordem: i + 1 }));
}

/** Os clientes da Suprens como o mix os compara: mercado, faturado em 12 meses e famílias. */
function populacaoDoMix(familias: FamiliaDoCliente[]): { todos: ClienteNoMix[]; porChave: Map<string, ClienteNoMix> } {
  const porChave = new Map<string, { codigo: string; mercado: ClienteNoMix["mercado"]; faturamento12m: number; familias12m: Set<string>; familias24m: Set<string> }>();
  for (const linha of familias) {
    const cliente = porChave.get(linha.chave) ?? {
      codigo: linha.chave,
      mercado: linha.mercado,
      faturamento12m: 0,
      familias12m: new Set<string>(),
      familias24m: new Set<string>(),
    };
    cliente.faturamento12m += linha.valor12m;
    if (linha.familia && linha.valor12m > 0) cliente.familias12m.add(linha.familia);
    if (linha.familia && linha.valor24m > 0) cliente.familias24m.add(linha.familia);
    porChave.set(linha.chave, cliente);
  }
  return { todos: [...porChave.values()], porChave };
}

/** Cliente da carteira sem nota nos 24 meses fechados. */
function semComprasNoMix(cliente: ClienteDaCarteira): ClienteNoMix {
  return { codigo: cliente.chave, mercado: cliente.mercado, faturamento12m: 0, familias12m: new Set(), familias24m: new Set() };
}

function agruparPor<T>(itens: readonly T[], chave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const grupo = grupos.get(chave(item));
    if (grupo) grupo.push(item);
    else grupos.set(chave(item), [item]);
  }
  return grupos;
}
