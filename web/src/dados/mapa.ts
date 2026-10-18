import { diasEntre } from "dominio/datas";
import type { MapaDaUf, MunicipioDoMapa, RegiaoDoMapa } from "dominio/mapa";
import type { Analises, ClienteResumo, UltimasVisitas } from "./tipos";

/*
 * O mapa da carteira, por estado. A pergunta principal é "para onde eu vou, e o que faço lá?": os
 * clientes que pedem ação e o dinheiro em jogo em cada cidade. As outras são como está o território
 * (a receita e se ela cresce), as cidades esquecidas e onde crescer. O potencial só se mede na área
 * do representante, as regiões com cliente e as vizinhas delas, e a régua é a receita por habitante
 * dele nessa área: a região distante, sem cliente por perto, não entra na conta.
 */

/** O que pede ação num cliente; no grupo, cada CNPJ fica com a parte dele no dinheiro. */
export type AcoesDoCliente = {
  /** Parou de comprar (Análises): o que deixou de entrar por mês. */
  parado?: { perdaPorMes: number; diasSemComprar: number };
  /** Comprando menos (Análises): a queda por mês no semestre e a variação dele. */
  emRisco?: { quedaPorMes: number; variacao: number };
  /** Ativo, mas já passou do próprio ciclo de compra: ainda dá para pegar antes de parar. */
  atrasado?: { diasSemComprar: number; cicloDias: number; mediaPorMes: number };
  /** As famílias que os clientes parecidos compram e ele não (Análises). */
  mix?: { familias: string[] };
  /** Chegou ou voltou há pouco (Análises): é a hora de firmar. */
  novo?: { tipo: "novo" | "reativado"; desde: string };
};

/** Parado é crítico; em risco e atrasado pedem atenção; mix e novo são oportunidade. */
export type Gravidade = "critico" | "atencao" | "oportunidade";

export type ResumoDasAcoes = {
  /** Por mês: o que parou de entrar, a queda de quem compra menos e a média de quem passou do ciclo. */
  emJogoPorMes: number;
  parados: number;
  emRisco: number;
  atrasados: number;
  comMix: number;
  novos: number;
};

export type Direcao = "alta" | "estavel" | "queda";

export type MunicipioNoTerritorio = {
  municipio: MunicipioDoMapa;
  /** Faturado em 12 meses pelos clientes da carteira no município. */
  receita: number;
  /** O mesmo, nos 12 meses anteriores: a base da direção. */
  receitaAnoAntes: number;
  clientes: readonly ClienteResumo[];
  acoes: ResumoDasAcoes;
  /** A compra mais recente de algum cliente do município; null se nenhum comprou. */
  ultimaCompra: string | null;
  /** A visita mais recente do login a algum cliente do município (app.db); null se nenhuma. */
  ultimaVisita: string | null;
};

export type RegiaoNoTerritorio = {
  regiao: RegiaoDoMapa;
  populacao: number;
  receita: number;
  receitaAnoAntes: number;
  /** Parte da receita do estado que vem da região. */
  participacao: number;
  /** A região tem cliente ou faz divisa com uma que tem. */
  isDaArea: boolean;
  /** O que a região faturaria se comprasse, por habitante, a média do representante na área; fora dela, 0. */
  potencial: number;
  /** O que falta para essa média; 0 na região que já passa dela e na de fora da área. */
  lacuna: number;
  acoes: ResumoDasAcoes;
  clientes: number;
  /** Só os municípios com cliente, do que mais fatura ao que menos fatura. */
  municipios: readonly MunicipioNoTerritorio[];
  /** Os municípios sem cliente da carteira, do mais populoso ao menos. */
  semCliente: readonly MunicipioDoMapa[];
};

export type Territorio = {
  uf: string;
  nome: string;
  receita: number;
  receitaAnoAntes: number;
  /** A régua do potencial: a receita pela população das regiões da área. */
  receitaPorHabitante: number;
  /** Por código IBGE, só os municípios com cliente. */
  municipios: ReadonlyMap<string, MunicipioNoTerritorio>;
  regioes: readonly RegiaoNoTerritorio[];
  clientes: number;
  /** Quantos municípios, dos que mais faturam, fazem 80% da receita do estado. */
  municipiosPara80: number;
  acoes: ResumoDasAcoes;
  /** As ações de cada cliente do estado, pelo código do CNPJ. */
  acoesPorCliente: ReadonlyMap<string, AcoesDoCliente>;
};

/** A parte da receita que mostra a concentração: "N municípios fazem 80%". */
const PARTE_DA_CONCENTRACAO = 0.8;
const MESES_DO_SEMESTRE = 6;
const MESES_DO_ANO = 12;
/** Abaixo disto, para cima ou para baixo, a receita do lugar está estável. */
const LIMITE_DA_DIRECAO_EM_PORCENTO = 10;
/** Os limites, em dias sem compra, das faixas de "Esquecidas": até 30, até 90, até 180 e mais. */
const LIMITES_DA_RECENCIA = [30, 90, 180] as const;
const SEM_ACOES: ResumoDasAcoes = { emJogoPorMes: 0, parados: 0, emRisco: 0, atrasados: 0, comMix: 0, novos: 0 };

/**
 * O que pede ação em cada cliente da carteira, pelas listas de Análises e pelo ciclo de compra. As
 * análises tratam o grupo como um cliente só, e o mapa põe cada CNPJ no seu município: o dinheiro do
 * grupo se divide entre os CNPJs pela parte de cada um no faturado de 12 meses, ou em partes iguais
 * se ele não faturou nada. O atraso no ciclo é de cada CNPJ, e só conta em quem não está parado nem
 * em risco.
 */
export function acoesDaCarteira(
  carteira: readonly ClienteResumo[],
  analises: Pick<Analises, "pararam" | "menos" | "mix" | "novos">,
  hoje: string,
): Map<string, AcoesDoCliente> {
  const porCliente = new Map<string, AcoesDoCliente>();
  const anotar = (cliente: ClienteResumo, acao: (parte: number) => AcoesDoCliente) => {
    for (const { codigo, parte } of partesDosCnpjs(cliente)) porCliente.set(codigo, { ...porCliente.get(codigo), ...acao(parte) });
  };
  for (const { cliente, perdaMensal, diasSemComprar } of analises.pararam) {
    anotar(cliente, (parte) => ({ parado: { perdaPorMes: perdaMensal * parte, diasSemComprar } }));
  }
  for (const { cliente, semestre, semestreAnoAnterior, variacao } of analises.menos) {
    anotar(cliente, (parte) => ({ emRisco: { quedaPorMes: (Math.max(0, semestreAnoAnterior - semestre) / MESES_DO_SEMESTRE) * parte, variacao } }));
  }
  for (const { cliente, oportunidades } of analises.mix) {
    if (oportunidades.length > 0) anotar(cliente, () => ({ mix: { familias: oportunidades.map(({ familia }) => familia) } }));
  }
  for (const { cliente, tipo, desde } of analises.novos) anotar(cliente, () => ({ novo: { tipo, desde } }));
  for (const cnpj of carteira.flatMap((cliente) => cliente.cnpjs ?? [cliente])) {
    const acoes = porCliente.get(cnpj.codigo);
    const atrasado = acoes?.parado || acoes?.emRisco ? undefined : atrasoNoCiclo(cnpj, hoje);
    if (atrasado) porCliente.set(cnpj.codigo, { ...acoes, atrasado });
  }
  return porCliente;
}

/** O dinheiro em jogo por mês num cliente: parado, em risco e atrasado somam; mix e novo não têm valor. */
export function emJogoPorMes(acoes: AcoesDoCliente | undefined): number {
  return (acoes?.parado?.perdaPorMes ?? 0) + (acoes?.emRisco?.quedaPorMes ?? 0) + (acoes?.atrasado?.mediaPorMes ?? 0);
}

export function gravidadeDoCliente(acoes: AcoesDoCliente | undefined): Gravidade | null {
  if (acoes?.parado) return "critico";
  if (acoes?.emRisco || acoes?.atrasado) return "atencao";
  return acoes?.mix || acoes?.novo ? "oportunidade" : null;
}

export function gravidadeDoResumo(resumo: ResumoDasAcoes): Gravidade | null {
  if (resumo.parados > 0) return "critico";
  if (resumo.emRisco + resumo.atrasados > 0) return "atencao";
  return resumo.comMix + resumo.novos > 0 ? "oportunidade" : null;
}

/**
 * Crescendo, estável ou caindo: o faturado em 12 meses contra os 12 anteriores, com 10% de folga para
 * cada lado. Conta o percentual inteiro, o mesmo que a tela escreve: "−10%" já é queda.
 */
export function direcaoDaReceita(receita: number, receitaAnoAntes: number): Direcao {
  if (receitaAnoAntes <= 0) return receita > 0 ? "alta" : "estavel";
  const percentual = Math.round((receita / receitaAnoAntes - 1) * 100);
  if (percentual >= LIMITE_DA_DIRECAO_EM_PORCENTO) return "alta";
  return percentual <= -LIMITE_DA_DIRECAO_EM_PORCENTO ? "queda" : "estavel";
}

/** A faixa de "Esquecidas": 1 até 30 dias sem compra, 2 até 90, 3 até 180, 4 acima disso ou nunca. */
export function faixaDeRecencia(diasSemCompra: number | null): 1 | 2 | 3 | 4 {
  if (diasSemCompra === null) return 4;
  const faixa = LIMITES_DA_RECENCIA.findIndex((limite) => diasSemCompra <= limite);
  return (faixa === -1 ? 4 : faixa + 1) as 1 | 2 | 3 | 4;
}

/**
 * O estado com a carteira por cima: os municípios com cliente e todas as regiões imediatas, com o
 * potencial. As visitas são a última do login a cada cliente.
 */
export function montarTerritorio(
  mapa: MapaDaUf,
  clientes: readonly ClienteResumo[],
  acoesPorCliente: ReadonlyMap<string, AcoesDoCliente>,
  visitas: UltimasVisitas,
): Territorio {
  const municipios = municipiosComCliente(mapa, clientes, acoesPorCliente, visitas);
  const presencas = [...municipios.values()];
  const receita = somar(presencas.map((presenca) => presenca.receita));
  const area = regioesDaArea(mapa, presencas);
  const populacaoDaArea = somar(mapa.municipios.filter((municipio) => area.has(municipio.regiao)).map((municipio) => municipio.populacao ?? 0));
  const receitaPorHabitante = populacaoDaArea > 0 ? receita / populacaoDaArea : 0;
  const estado: EstadoDaCarteira = { mapa, municipios, area, receita, receitaPorHabitante };
  const doEstado = presencas.flatMap((presenca) => presenca.clientes);
  return {
    uf: mapa.uf,
    nome: mapa.nome,
    receita,
    receitaAnoAntes: somar(presencas.map((presenca) => presenca.receitaAnoAntes)),
    receitaPorHabitante,
    municipios,
    regioes: mapa.regioes.map((regiao) => regiaoNoTerritorio(regiao, estado)),
    clientes: doEstado.length,
    municipiosPara80: quantosFazem(presencas.map((presenca) => presenca.receita), PARTE_DA_CONCENTRACAO),
    acoes: resumirAcoes(doEstado, acoesPorCliente),
    acoesPorCliente,
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

/** O cliente ativo que já passou do próprio ciclo de compra, antes de virar parado. */
function atrasoNoCiclo(cliente: ClienteResumo, hoje: string): AcoesDoCliente["atrasado"] {
  if (cliente.situacao !== "ativo" || cliente.cicloDias === null || cliente.ultimaCompra === null) return undefined;
  const diasSemComprar = diasEntre(cliente.ultimaCompra, hoje);
  return diasSemComprar > cliente.cicloDias ? { diasSemComprar, cicloDias: cliente.cicloDias, mediaPorMes: cliente.faturamento12m / MESES_DO_ANO } : undefined;
}

/** O cliente sozinho fica com tudo; no grupo, cada CNPJ fica com a parte dele. */
function partesDosCnpjs(cliente: ClienteResumo): { codigo: string; parte: number }[] {
  const { cnpjs } = cliente;
  if (!cnpjs) return [{ codigo: cliente.codigo, parte: 1 }];
  const total = somar(cnpjs.map(({ faturamento12m }) => faturamento12m));
  return cnpjs.map(({ codigo, faturamento12m }) => ({ codigo, parte: total > 0 ? faturamento12m / total : 1 / cnpjs.length }));
}

function resumirAcoes(clientes: readonly ClienteResumo[], acoesPorCliente: ReadonlyMap<string, AcoesDoCliente>): ResumoDasAcoes {
  return clientes.reduce((resumo, cliente) => {
    const acoes = acoesPorCliente.get(cliente.codigo);
    if (!acoes) return resumo;
    return {
      emJogoPorMes: resumo.emJogoPorMes + emJogoPorMes(acoes),
      parados: resumo.parados + (acoes.parado ? 1 : 0),
      emRisco: resumo.emRisco + (acoes.emRisco ? 1 : 0),
      atrasados: resumo.atrasados + (acoes.atrasado ? 1 : 0),
      comMix: resumo.comMix + (acoes.mix ? 1 : 0),
      novos: resumo.novos + (acoes.novo ? 1 : 0),
    };
  }, SEM_ACOES);
}

function municipiosComCliente(
  mapa: MapaDaUf,
  clientes: readonly ClienteResumo[],
  acoesPorCliente: ReadonlyMap<string, AcoesDoCliente>,
  visitas: UltimasVisitas,
): Map<string, MunicipioNoTerritorio> {
  const doMapa = new Map(mapa.municipios.map((municipio) => [municipio.codigo, municipio]));
  const porMunicipio = new Map<string, ClienteResumo[]>();
  for (const cliente of clientes) {
    if (cliente.municipio && doMapa.has(cliente.municipio)) porMunicipio.set(cliente.municipio, [...(porMunicipio.get(cliente.municipio) ?? []), cliente]);
  }
  return new Map(
    [...porMunicipio.entries()].flatMap(([codigo, doMunicipio]) => {
      const municipio = doMapa.get(codigo);
      if (!municipio) return [];
      const compras = doMunicipio.flatMap(({ ultimaCompra }) => (ultimaCompra ? [ultimaCompra] : [])).sort();
      const visitados = doMunicipio.flatMap(({ codigo }) => visitas[codigo] ?? []).sort();
      return [
        [
          codigo,
          {
            municipio,
            receita: somar(doMunicipio.map(({ faturamento12m }) => faturamento12m)),
            receitaAnoAntes: somar(doMunicipio.map(({ evolucao12m }) => evolucao12m[0] ?? 0)),
            clientes: doMunicipio,
            acoes: resumirAcoes(doMunicipio, acoesPorCliente),
            ultimaCompra: compras.at(-1) ?? null,
            ultimaVisita: visitados.at(-1) ?? null,
          },
        ] as const,
      ];
    }),
  );
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
    receitaAnoAntes: somar(presencas.map((presenca) => presenca.receitaAnoAntes)),
    participacao: estado.receita > 0 ? receita / estado.receita : 0,
    isDaArea,
    potencial,
    lacuna: Math.max(0, potencial - receita),
    acoes: somarResumos(presencas.map((presenca) => presenca.acoes)),
    clientes: somar(presencas.map((presenca) => presenca.clientes.length)),
    municipios: presencas,
    semCliente: daRegiao.filter((municipio) => !estado.municipios.has(municipio.codigo)).sort((a, b) => (b.populacao ?? 0) - (a.populacao ?? 0)),
  };
}

function somarResumos(resumos: readonly ResumoDasAcoes[]): ResumoDasAcoes {
  return resumos.reduce(
    (soma, resumo) => ({
      emJogoPorMes: soma.emJogoPorMes + resumo.emJogoPorMes,
      parados: soma.parados + resumo.parados,
      emRisco: soma.emRisco + resumo.emRisco,
      atrasados: soma.atrasados + resumo.atrasados,
      comMix: soma.comMix + resumo.comMix,
      novos: soma.novos + resumo.novos,
    }),
    SEM_ACOES,
  );
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
