import type { MapaDaUf, MunicipioDoMapa, RegiaoDoMapa } from "dominio/mapa";
import type { Analises, ClienteResumo } from "./tipos";

/*
 * O mapa da carteira: de onde vem a receita e onde dá para crescer. Tudo por estado. O potencial só se
 * mede na área do representante, as regiões com cliente e as vizinhas delas, e a régua é a receita por
 * habitante dele nessa área: a região distante, sem cliente por perto, não entra na conta.
 */

export type MunicipioNoTerritorio = {
  municipio: MunicipioDoMapa;
  /** Faturado em 12 meses pelos clientes da carteira no município. */
  receita: number;
  clientes: readonly ClienteResumo[];
  aRecuperarPorMes: number;
};

export type RegiaoNoTerritorio = {
  regiao: RegiaoDoMapa;
  populacao: number;
  receita: number;
  /** Parte da receita do estado que vem da região. */
  participacao: number;
  /** A região tem cliente ou faz divisa com uma que tem. */
  isDaArea: boolean;
  /** O que a região faturaria se comprasse, por habitante, a média do representante na área; fora dela, 0. */
  potencial: number;
  /** O que falta para essa média; 0 na região que já passa dela e na de fora da área. */
  lacuna: number;
  aRecuperarPorMes: number;
  clientes: number;
  /** Só os municípios com cliente, do que mais fatura ao que menos fatura. */
  municipios: readonly MunicipioNoTerritorio[];
};

export type Territorio = {
  uf: string;
  nome: string;
  receita: number;
  /** A régua do potencial: a receita pela população das regiões da área. */
  receitaPorHabitante: number;
  /** Por código IBGE, só os municípios com cliente. */
  municipios: ReadonlyMap<string, MunicipioNoTerritorio>;
  regioes: readonly RegiaoNoTerritorio[];
  clientes: number;
  /** Quantos municípios, dos que mais faturam, fazem 80% da receita do estado. */
  municipiosPara80: number;
  aRecuperarPorMes: number;
  clientesARecuperar: number;
};

/** A parte da receita que mostra a concentração: "N municípios fazem 80%". */
const PARTE_DA_CONCENTRACAO = 0.8;
const MESES_DO_SEMESTRE = 6;

/**
 * O que deixou de entrar por mês, por cliente: a média mensal perdida de quem parou de comprar e a
 * queda mensal de quem está comprando menos, as duas listas de Análises. As análises tratam o grupo
 * como um cliente só, e o mapa põe cada CNPJ no seu município: o valor do grupo se divide entre os
 * CNPJs pela parte de cada um no faturado de 12 meses, ou em partes iguais se ele não faturou nada.
 */
export function aRecuperarPorCliente(analises: Pick<Analises, "pararam" | "menos">): Map<string, number> {
  const porCliente = new Map<string, number>();
  const anotar = (cliente: ClienteResumo, valor: number) => {
    for (const { codigo, parte } of partesDosCnpjs(cliente)) porCliente.set(codigo, valor * parte);
  };
  for (const { cliente, perdaMensal } of analises.pararam) anotar(cliente, perdaMensal);
  for (const { cliente, semestre, semestreAnoAnterior } of analises.menos) {
    anotar(cliente, Math.max(0, semestreAnoAnterior - semestre) / MESES_DO_SEMESTRE);
  }
  return porCliente;
}

/** O cliente sozinho fica com tudo; no grupo, cada CNPJ fica com a parte dele. */
function partesDosCnpjs(cliente: ClienteResumo): { codigo: string; parte: number }[] {
  const { cnpjs } = cliente;
  if (!cnpjs) return [{ codigo: cliente.codigo, parte: 1 }];
  const total = somar(cnpjs.map(({ faturamento12m }) => faturamento12m));
  return cnpjs.map(({ codigo, faturamento12m }) => ({ codigo, parte: total > 0 ? faturamento12m / total : 1 / cnpjs.length }));
}

/** O estado com a carteira por cima: os municípios com cliente e todas as regiões imediatas, com o potencial. */
export function montarTerritorio(mapa: MapaDaUf, clientes: readonly ClienteResumo[], aRecuperar: ReadonlyMap<string, number>): Territorio {
  const municipios = municipiosComCliente(mapa, clientes, aRecuperar);
  const presencas = [...municipios.values()];
  const receita = somar(presencas.map((presenca) => presenca.receita));
  const area = regioesDaArea(mapa, presencas);
  const populacaoDaArea = somar(mapa.municipios.filter((municipio) => area.has(municipio.regiao)).map((municipio) => municipio.populacao ?? 0));
  const receitaPorHabitante = populacaoDaArea > 0 ? receita / populacaoDaArea : 0;
  const estado: EstadoDaCarteira = { mapa, municipios, area, receita, receitaPorHabitante };
  return {
    uf: mapa.uf,
    nome: mapa.nome,
    receita,
    receitaPorHabitante,
    municipios,
    regioes: mapa.regioes.map((regiao) => regiaoNoTerritorio(regiao, estado)),
    clientes: somar(presencas.map((presenca) => presenca.clientes.length)),
    municipiosPara80: quantosFazem(presencas.map((presenca) => presenca.receita), PARTE_DA_CONCENTRACAO),
    aRecuperarPorMes: somar(presencas.map((presenca) => presenca.aRecuperarPorMes)),
    clientesARecuperar: presencas.flatMap((presenca) => presenca.clientes).filter((cliente) => (aRecuperar.get(cliente.codigo) ?? 0) > 0).length,
  };
}

/**
 * A classe de cor da lacuna da região, de 1 (menor) a 4 (maior), pelos quartis das regiões que têm
 * lacuna; 0 na região sem lacuna. Os quartis dão cores bem repartidas mesmo com uma região muito acima.
 */
export function classeDaLacuna(lacuna: number, lacunas: readonly number[]): 0 | 1 | 2 | 3 | 4 {
  if (lacuna <= 0) return 0;
  const positivas = lacunas.filter((valor) => valor > 0).sort((a, b) => a - b);
  const posicao = positivas.filter((valor) => valor < lacuna).length / positivas.length;
  return (Math.min(3, Math.floor(posicao * 4)) + 1) as 1 | 2 | 3 | 4;
}

function municipiosComCliente(mapa: MapaDaUf, clientes: readonly ClienteResumo[], aRecuperar: ReadonlyMap<string, number>): Map<string, MunicipioNoTerritorio> {
  const doMapa = new Map(mapa.municipios.map((municipio) => [municipio.codigo, municipio]));
  const porMunicipio = new Map<string, MunicipioNoTerritorio>();
  for (const cliente of clientes) {
    const municipio = cliente.municipio ? doMapa.get(cliente.municipio) : undefined;
    if (!municipio) continue;
    const presenca = porMunicipio.get(municipio.codigo) ?? { municipio, receita: 0, clientes: [], aRecuperarPorMes: 0 };
    porMunicipio.set(municipio.codigo, {
      municipio,
      receita: presenca.receita + cliente.faturamento12m,
      clientes: [...presenca.clientes, cliente],
      aRecuperarPorMes: presenca.aRecuperarPorMes + (aRecuperar.get(cliente.codigo) ?? 0),
    });
  }
  return porMunicipio;
}

/** As regiões com cliente e as vizinhas delas, no mesmo estado. */
function regioesDaArea(mapa: MapaDaUf, presencas: readonly MunicipioNoTerritorio[]): Set<string> {
  const comCliente = new Set(presencas.map((presenca) => presenca.municipio.regiao));
  const isDaArea = (regiao: RegiaoDoMapa) => comCliente.has(regiao.codigo) || regiao.vizinhas.some((vizinha) => comCliente.has(vizinha));
  return new Set(mapa.regioes.filter(isDaArea).map((regiao) => regiao.codigo));
}

type EstadoDaCarteira = {
  mapa: MapaDaUf;
  municipios: ReadonlyMap<string, MunicipioNoTerritorio>;
  area: ReadonlySet<string>;
  receita: number;
  receitaPorHabitante: number;
};

function regiaoNoTerritorio(regiao: RegiaoDoMapa, estado: EstadoDaCarteira): RegiaoNoTerritorio {
  const daRegiao = estado.mapa.municipios.filter((municipio) => municipio.regiao === regiao.codigo);
  const presencas = daRegiao.flatMap((municipio) => estado.municipios.get(municipio.codigo) ?? []).sort((a, b) => b.receita - a.receita);
  const populacao = somar(daRegiao.map((municipio) => municipio.populacao ?? 0));
  const receita = somar(presencas.map((presenca) => presenca.receita));
  const isDaArea = estado.area.has(regiao.codigo);
  const potencial = isDaArea ? populacao * estado.receitaPorHabitante : 0;
  return {
    regiao,
    populacao,
    receita,
    participacao: estado.receita > 0 ? receita / estado.receita : 0,
    isDaArea,
    potencial,
    lacuna: Math.max(0, potencial - receita),
    aRecuperarPorMes: somar(presencas.map((presenca) => presenca.aRecuperarPorMes)),
    clientes: somar(presencas.map((presenca) => presenca.clientes.length)),
    municipios: presencas,
  };
}

/** Quantos dos maiores valores, somados, chegam à parte do total. */
function quantosFazem(valores: readonly number[], parte: number): number {
  const total = somar(valores);
  if (total <= 0) return 0;
  let acumulado = 0;
  const ordenados = [...valores].sort((a, b) => b - a);
  for (const [i, valor] of ordenados.entries()) {
    acumulado += valor;
    if (acumulado >= total * parte) return i + 1;
  }
  return ordenados.length;
}

function somar(valores: readonly number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}
