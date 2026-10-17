import { analisarCliente, type AnaliseDoCliente, type HistoricoDoCliente } from "dominio/analises";
import { cicloTipico, comprasDasNotas } from "dominio/ciclo";
import type { Foto } from "dominio/esquemaDaFoto";
import { evolucao12m, variacao12m } from "dominio/indicadores";
import { sugerirMix, type ClienteNoMix, type SugestaoDeMix } from "dominio/mix";
import type { ClienteDaCarteira, DadosDoErp, FamiliaDoCliente, ProdutoDoCliente } from "../erp/tipos.ts";
import { agruparPor } from "./agrupar.ts";
import { montarCatalogo, type TabelaEListaDoCliente } from "./catalogo.ts";
import { formarGrupos, juntarCompras, type Compras } from "./grupos.ts";
import { nomeDoCliente } from "./nomeDoCliente.ts";
import { SEM_FAMILIA, juntarProdutos } from "./produtos.ts";
import { MESES_FECHADOS, type Referencia } from "./referencia.ts";

/*
 * As tabelas dos clientes da carteira: cadastro, indicadores, ficha, análises e catálogo, com as
 * regras do módulo dominio (as mesmas do protótipo). O grupo do SGI com dois ou mais CNPJs na
 * carteira do mesmo representante ganha uma linha própria, com as compras dos CNPJs somadas: as
 * análises e a lista de Clientes mostram o grupo no lugar deles, e cada CNPJ continua com a ficha
 * dele, ligada ao grupo.
 */

/** A Ficha mostra os 8 produtos de maior valor nos 12 meses fechados. */
const PRODUTOS_DA_FICHA = 8;

export type TabelasDosClientes = Pick<
  Foto,
  | "cliente"
  | "cliente_mes"
  | "cliente_familia"
  | "produto"
  | "lista_de_precos"
  | "produto_comprado"
  | "ficha_produto"
  | "cliente_mix"
  | "analise_parado"
  | "analise_ritmo"
  | "analise_novo"
  | "analise_mix"
>;

/** Os ids opacos da foto (extrator/src/idDoCliente.ts). */
export type IdsDaFoto = {
  doCliente: (cliente: ClienteDaCarteira) => string;
  doGrupo: (representante: string, nome: string) => string;
};

type MesDoCliente = { mes: string; valor: number; pecas: number };

/** O que as regras dizem de um cliente ou de um grupo, a partir das compras dele. */
type Analisado = {
  id: string;
  compras: Compras;
  /** Os 36 meses fechados e o corrente. */
  mensal: MesDoCliente[];
  historico: HistoricoDoCliente;
  analise: AnaliseDoCliente;
  evolucao: number[];
  mix: SugestaoDeMix | null;
};

type ClienteAnalisado = Analisado & { cliente: ClienteDaCarteira };

type GrupoAnalisado = Analisado & { nome: string; representante: string; membros: ClienteAnalisado[] };

export function montarClientes(dados: DadosDoErp, referencia: Referencia, ids: IdsDaFoto): TabelasDosClientes {
  const suprens = populacaoDoMix(dados.familias);
  const comprasDe = comprasPorCliente(dados, suprens.porChave);
  const clientes: ClienteAnalisado[] = dados.carteira.flatMap((cliente) => {
    const compras = comprasDe(cliente);
    return compras ? [{ id: ids.doCliente(cliente), cliente, ...analisar(compras, referencia, suprens.todos) }] : [];
  });
  const grupos: GrupoAnalisado[] = formarGrupos(clientes).map(({ nome, representante, membros }) => {
    const id = ids.doGrupo(representante, nome);
    const compras = juntarCompras(id, membros.map((membro) => membro.compras));
    return { id, nome, representante, membros, ...analisar(compras, referencia, suprens.todos) };
  });
  const grupoDe = new Map(grupos.flatMap(({ id, membros }) => membros.map((membro) => [membro.id, id] as const)));
  /** Cada CNPJ e cada grupo tem a sua ficha. */
  const comFicha: Analisado[] = [...clientes, ...grupos];
  /** As análises listam o grupo no lugar dos CNPJs dele. */
  const nasAnalises: Analisado[] = [...clientes.filter(({ id }) => !grupoDe.has(id)), ...grupos];
  const produtosDaFicha = comFicha.flatMap(({ id, compras }) => maisComprados(compras.produtos).map((produto) => ({ ...produto, cliente: id })));
  const catalogo = montarCatalogo(clientes, dados);
  return {
    cliente: [
      ...clientes.map((analisado) => linhaDoCliente(analisado, catalogo.porCliente.get(analisado.id), grupoDe.get(analisado.id) ?? null)),
      ...grupos.map(linhaDoGrupo),
    ],
    cliente_mes: comFicha.flatMap(({ id, compras }) => faturadoPorMes(compras, referencia.mesesDaFicha).map(({ mes, valor }) => ({ cliente: id, mes, valor }))),
    cliente_familia: comFicha.flatMap(({ id, compras }) => familiasDaFicha(id, compras.familias)),
    produto: juntarProdutos(catalogo.produtos, produtosDaFicha),
    lista_de_precos: catalogo.lista_de_precos,
    produto_comprado: catalogo.produto_comprado,
    ficha_produto: produtosDaFicha.map((produto) => ({
      cliente: produto.cliente,
      produto: produto.produto,
      pecas_12m: produto.pecas,
      valor_12m: produto.valor,
      ultima_compra: produto.ultimaCompra,
    })),
    cliente_mix: comFicha.flatMap(({ id, mix }) =>
      (mix?.oportunidades ?? []).map((oportunidade, i) => ({ cliente: id, ...oportunidade, ordem: i + 1 })),
    ),
    ...montarAnalises(nasAnalises),
  };
}

/** As compras de cada cliente da carteira; null para quem não tem nota (não entra na foto). */
function comprasPorCliente(dados: DadosDoErp, noMix: ReadonlyMap<string, ClienteNoMix>): (cliente: ClienteDaCarteira) => Compras | null {
  const vendas = agruparPor(dados.vendasDoMes, (venda) => venda.chave);
  const familias = agruparPor(dados.familias, (familia) => familia.chave);
  const produtos = agruparPor(dados.produtos, (produto) => produto.chave);
  const comPedido = new Set(dados.pedidos.map((pedido) => pedido.chave));
  return (cliente) => {
    const datas = dados.datasDeCompra.get(cliente.chave);
    if (!datas) return null;
    return {
      datas,
      vendas: vendas.get(cliente.chave) ?? [],
      familias: familias.get(cliente.chave) ?? [],
      produtos: produtos.get(cliente.chave) ?? [],
      temPedidoEmAberto: comPedido.has(cliente.chave),
      noMix: noMix.get(cliente.chave) ?? semComprasNoMix(cliente),
    };
  };
}

function analisar(compras: Compras, referencia: Referencia, populacaoDoMix: readonly ClienteNoMix[]): Omit<Analisado, "id"> {
  const mensal = referencia.meses.map((mes) => {
    const venda = compras.vendas.find((candidata) => candidata.mes === mes);
    return { mes, valor: venda?.valor ?? 0, pecas: venda?.pecas ?? 0 };
  });
  const { datas } = compras;
  const datasDasCompras = datas.ultimaAntesDaJanela ? [datas.ultimaAntesDaJanela, ...datas.datas] : datas.datas;
  const historico: HistoricoDoCliente = {
    mensal: mensal.slice(0, MESES_FECHADOS),
    compras: datasDasCompras,
    primeiraCompra: datas.primeiraCompra,
    cicloDias: cicloTipico(comprasDasNotas(datasDasCompras), referencia.hoje),
    temPedidoEmAberto: compras.temPedidoEmAberto,
  };
  return {
    compras,
    mensal,
    historico,
    analise: analisarCliente(historico, referencia.hoje),
    evolucao: evolucao12m(historico.mensal.map((mes) => mes.valor)),
    mix: sugerirMix(compras.noMix, populacaoDoMix),
  };
}

function linhaDoCliente(
  analisado: ClienteAnalisado,
  catalogo: TabelaEListaDoCliente | undefined,
  grupo: string | null,
): Foto["cliente"][number] {
  const { cliente } = analisado;
  return {
    cliente: analisado.id,
    codigo_erp: cliente.isPessoaFisica ? null : String(cliente.cliente),
    representante: cliente.representante,
    nome: nomeDoCliente(cliente.fantasia, cliente.razaoSocial),
    razao_social: cliente.razaoSocial,
    cidade: cliente.cidade,
    uf: cliente.uf,
    municipio_ibge: cliente.municipio,
    mercado: cliente.mercado,
    status: cliente.status,
    ...indicadores(analisado),
    tabela_preco: catalogo?.tabela ?? null,
    lista_de_precos: catalogo?.lista ?? null,
    grupo,
    cnpjs: null,
  };
}

/**
 * O grupo não tem cidade, código do ERP nem tabela de preço: o pedido é sempre de um CNPJ. O
 * mercado é o do CNPJ que mais fatura, e o grupo está ativo se algum CNPJ estiver.
 */
function linhaDoGrupo(grupo: GrupoAnalisado): Foto["cliente"][number] {
  const principal = grupo.membros.reduce((maior, membro) => ((membro.evolucao.at(-1) ?? 0) > (maior.evolucao.at(-1) ?? 0) ? membro : maior));
  return {
    cliente: grupo.id,
    codigo_erp: null,
    representante: grupo.representante,
    nome: grupo.nome,
    razao_social: "",
    cidade: "",
    uf: "",
    municipio_ibge: null,
    mercado: principal.cliente.mercado,
    status: grupo.membros.some(({ cliente }) => cliente.status === "ativo") ? "ativo" : principal.cliente.status,
    ...indicadores(grupo),
    tabela_preco: null,
    lista_de_precos: null,
    grupo: null,
    cnpjs: grupo.membros.length,
  };
}

/** O que as regras dizem do cliente ou do grupo, nas colunas da linha dele. */
function indicadores({ historico, analise, evolucao, mix }: Analisado) {
  return {
    situacao: analise.situacao,
    ultima_compra: historico.compras.at(-1) ?? null,
    cliente_desde: Number(historico.primeiraCompra.slice(0, 4)),
    ciclo_dias: historico.cicloDias,
    faturamento_12m: evolucao.at(-1) ?? 0,
    variacao_12m: variacao12m(evolucao),
    evolucao_12m: JSON.stringify(evolucao),
    grupo_mix: mix ? (mix.porte ?? "mercado") : null,
    // "Comprando menos" só vale para o cliente em risco (dominio/analises.ts): é a queda do selo.
    queda_no_semestre: analise.ritmo?.direcao === "menos" ? analise.ritmo.variacao : null,
  };
}

/** O faturado de cada mês, com zero no mês sem compra. */
function faturadoPorMes(compras: Compras, meses: readonly string[]): { mes: string; valor: number }[] {
  const porMes = new Map(compras.vendas.map(({ mes, valor }) => [mes, valor]));
  return meses.map((mes) => ({ mes, valor: porMes.get(mes) ?? 0 }));
}

/** Os produtos de maior valor nos 12 meses fechados; no empate, pela ordem do código. */
function maisComprados(produtos: readonly ProdutoDoCliente[]): ProdutoDoCliente[] {
  return [...produtos].sort((a, b) => b.valor - a.valor || a.produto.localeCompare(b.produto)).slice(0, PRODUTOS_DA_FICHA);
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
function montarAnalises(analisados: Analisado[]): Pick<TabelasDosClientes, "analise_parado" | "analise_ritmo" | "analise_novo" | "analise_mix"> {
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
