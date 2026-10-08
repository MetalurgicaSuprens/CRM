import { diasEntre } from "../formato";
import { diasUteisAte, diasUteisDoMes, hojeIso, mesDe, somarDias, somarMeses, ultimoDiaDoMes } from "../calendario";
import { criarAleatorio, type Aleatorio } from "./aleatorio";
import { sugerirMix, type ClienteNoMix } from "./mix";
import type {
  ClienteResumo,
  DestaqueCliente,
  FaturamentoMensal,
  FichaCliente,
  GrupoDestaque,
  Mercado,
  PainelInicio,
  PedidoEmAberto,
  ProdutoComprado,
  Situacao,
  SituacaoDosDados,
} from "./tipos";

/*
 * Carteira fictícia e determinística para o protótipo (F1). Nenhum nome ou valor é real.
 * As regras de situação seguem docs/plano.md; a versão de verdade será calculada pelo extrator.
 */

const SEMENTE = 1401;
const QUANTIDADE_DE_CLIENTES = 86;
/** Clientes dos outros representantes: só entram na comparação do mix, nunca aparecem na tela. */
const OUTROS_CLIENTES_DA_SUPRENS = 600;
/** Índices de `mensal`: 0..35 são os meses fechados (35 = mês passado); 36 é o mês corrente. */
const MESES_FECHADOS = 36;
const ULTIMO_FECHADO = MESES_FECHADOS - 1;
const DESTAQUES_POR_GRUPO = 5;

const REPRESENTANTE = { codigo: "1401", nome: "Carlos Andrade" };

const RAMOS = [
  "Auto Peças", "Distribuidora", "Comercial", "Mangueiras", "Hidráulica", "Agropeças", "Implementos",
  "Retífica", "Tratorpeças", "Irrigação", "Borrachas", "Industrial", "Ferragens", "Máquinas",
];
const NOMES = [
  "Horizonte", "Vale Sul", "Santa Fé", "Primavera", "Boa Vista", "Serra Azul", "Rio Claro", "São Jorge",
  "Três Lagoas", "Bandeirantes", "Ipê", "Cerrado", "Planalto", "Aurora", "Monte Alto", "Guarani",
  "Pioneira", "Campo Belo", "Vitória", "Estrela", "Mirante", "Nova Era", "Colina", "Jacarandá", "Itapuã",
];
const SUFIXOS = ["Ltda", "Comércio Ltda", "Distribuição Ltda", "S.A.", "Indústria e Comércio Ltda"];
const CIDADES: readonly (readonly [string, string])[] = [
  ["Ribeirão Preto", "SP"], ["Campinas", "SP"], ["Piracicaba", "SP"], ["Bauru", "SP"], ["Franca", "SP"],
  ["Sorocaba", "SP"], ["São José do Rio Preto", "SP"], ["Londrina", "PR"], ["Maringá", "PR"],
  ["Cascavel", "PR"], ["Ponta Grossa", "PR"], ["Joinville", "SC"], ["Chapecó", "SC"], ["Blumenau", "SC"],
  ["Uberlândia", "MG"], ["Uberaba", "MG"], ["Poços de Caldas", "MG"], ["Rio Verde", "GO"],
  ["Campo Grande", "MS"], ["Dourados", "MS"],
];
const FAMILIAS = [
  { nome: "FLEXIL", prefixo: "FAB", popularidade: 0.85 },
  { nome: "PRESIL", prefixo: "PRB", popularidade: 0.7 },
  { nome: "MICRO", prefixo: "MAB", popularidade: 0.55 },
  { nome: "TIGRE", prefixo: "TGR", popularidade: 0.4 },
  { nome: "ZIP", prefixo: "ZIP", popularidade: 0.35 },
  { nome: "SIMPLEX", prefixo: "SPX", popularidade: 0.3 },
  { nome: "RADIAL", prefixo: "ARI", popularidade: 0.25 },
  { nome: "MOLA", prefixo: "AMD", popularidade: 0.2 },
  { nome: "TUCHO CANALETA", prefixo: "TCC", popularidade: 0.2 },
  { nome: "STEPLESS", prefixo: "STP", popularidade: 0.15 },
] as const;
/** Peso de cada mês do ano no faturamento: férias coletivas em dezembro e janeiro. */
const SAZONALIDADE = [0.72, 0.88, 1.04, 1.02, 1.08, 1.04, 0.98, 1.06, 1.04, 1.1, 1.0, 0.78];

type Perfil = "estavel" | "crescendo" | "caindo" | "parou" | "novo" | "irregular";
const PERFIS: readonly (readonly [Perfil, number])[] = [
  ["estavel", 0.44], ["crescendo", 0.14], ["caindo", 0.14], ["parou", 0.1], ["novo", 0.06], ["irregular", 0.12],
];

type Contexto = { hoje: string; mesAtual: string; diaUtil: number; diasUteis: number };

type ClienteFicticio = {
  codigo: string;
  nome: string;
  razaoSocial: string;
  cidade: string;
  uf: string;
  mercado: Mercado;
  precoMedioPeca: number;
  pesosFamilias: Map<string, number>;
  mensal: FaturamentoMensal[];
  datasCompra: string[];
  primeiraCompra: string;
  pedidos: PedidoEmAberto[];
  indicadores: Indicadores;
};

type Indicadores = {
  ultimaCompra: string | null;
  diasSemCompra: number;
  faturamento12m: number;
  faturamento12mAnterior: number;
  faturamento6m: number;
  faturamento6mAnoAnterior: number;
  cicloDias: number | null;
  situacao: Situacao;
};

type Carteira = Contexto & {
  clientes: ClienteFicticio[];
  /** Todos os clientes da Suprens (os da carteira e os dos outros), para comparar o mix. */
  suprens: ClienteNoMix[];
};

let carteiraEmCache: Carteira | null = null;

function carteira(): Carteira {
  carteiraEmCache ??= gerarCarteira(hojeIso());
  return carteiraEmCache;
}

export function situacaoDosDadosFicticia(agora = new Date()): SituacaoDosDados {
  const atualizacao = new Date(agora.getTime() - 14 * 60_000);
  const hora = `${String(atualizacao.getHours()).padStart(2, "0")}:${String(atualizacao.getMinutes()).padStart(2, "0")}`;
  return { atualizadoEm: `${hojeIso(atualizacao)}T${hora}`, hoje: carteira().hoje, representante: REPRESENTANTE };
}

export function clientesFicticios(): ClienteResumo[] {
  return carteira()
    .clientes.map(resumirCliente)
    .sort((a, b) => b.faturamento12m - a.faturamento12m);
}

export function fichaFicticia(codigo: string): FichaCliente | null {
  const dados = carteira();
  const cliente = dados.clientes.find((c) => c.codigo === codigo);
  return cliente ? montarFicha(cliente, dados) : null;
}

export function painelFicticio(): PainelInicio {
  return montarPainel(carteira());
}

// ---------------------------------------------------------------- geração

function gerarCarteira(hoje: string): Carteira {
  const aleatorio = criarAleatorio(SEMENTE);
  const mesAtual = mesDe(hoje);
  const contexto: Contexto = { hoje, mesAtual, diaUtil: diasUteisAte(hoje), diasUteis: diasUteisDoMes(mesAtual) };
  const clientes = Array.from({ length: QUANTIDADE_DE_CLIENTES }, () => gerarCliente(aleatorio, contexto));
  const outros = gerarOutrosClientesDaSuprens(criarAleatorio(SEMENTE + 1));
  return { ...contexto, clientes, suprens: [...clientes.map(paraMix), ...outros] };
}

function gerarCliente(aleatorio: Aleatorio, contexto: Contexto): ClienteFicticio {
  const perfil = sortearComPeso(aleatorio, PERFIS);
  const mercado = sortearMercado(aleatorio);
  const [cidade, uf] = aleatorio.escolher(CIDADES);
  const nome = `${aleatorio.escolher(RAMOS)} ${aleatorio.escolher(NOMES)}`;
  const porteMensal = sortearPorteMensal(aleatorio, mercado);
  const precoMedioPeca = aleatorio.entre(1.6, 5.2);
  const { mensal, datasCompra } = gerarHistorico(aleatorio, perfil, porteMensal, precoMedioPeca, contexto);
  const primeiraCompra = perfil === "novo" ? (datasCompra[0] ?? contexto.hoje) : dataAntiga(aleatorio);
  const codigo = `${aleatorio.inteiro(10_000_000, 99_999_999)}000${aleatorio.inteiro(1, 3)}`;
  const base = {
    codigo,
    nome,
    razaoSocial: `${nome} ${aleatorio.escolher(SUFIXOS)}`,
    cidade,
    uf,
    mercado,
    precoMedioPeca,
    pesosFamilias: sortearFamilias(aleatorio),
    mensal,
    datasCompra,
    primeiraCompra,
    pedidos: perfil === "parou" ? [] : gerarPedidos(aleatorio, porteMensal, contexto),
  };
  return { ...base, indicadores: calcularIndicadores(base, contexto) };
}

function gerarOutrosClientesDaSuprens(aleatorio: Aleatorio): ClienteNoMix[] {
  return Array.from({ length: OUTROS_CLIENTES_DA_SUPRENS }, (_, indice) => {
    const mercado = sortearMercado(aleatorio);
    const faturamento12m = aleatorio.chance(0.88) ? Math.round(sortearPorteMensal(aleatorio, mercado) * 12) : 0;
    const familias = new Set(sortearFamilias(aleatorio).keys());
    return {
      codigo: `outro-${indice}`,
      mercado,
      faturamento12m,
      familias12m: faturamento12m > 0 ? familias : new Set<string>(),
      familias24m: familias,
    };
  });
}

function sortearMercado(aleatorio: Aleatorio): Mercado {
  return sortearComPeso<Mercado>(aleatorio, [["PRACA", 0.8], ["MONTADORA", 0.12], ["EXPORTACAO", 0.08]]);
}

function sortearPorteMensal(aleatorio: Aleatorio, mercado: Mercado): number {
  return Math.exp(aleatorio.entre(Math.log(700), Math.log(16_000))) * (mercado === "MONTADORA" ? 2.5 : 1);
}

function gerarHistorico(
  aleatorio: Aleatorio,
  perfil: Perfil,
  porteMensal: number,
  precoMedioPeca: number,
  contexto: Contexto,
) {
  const intervalo = perfil === "irregular" ? aleatorio.escolher([3, 4, 5]) : perfil === "novo" ? 1 : aleatorio.escolher([1, 1, 1, 2]);
  const fase = aleatorio.inteiro(0, intervalo - 1);
  const mesesParado = aleatorio.inteiro(3, 9);
  const mesesDeVida = aleatorio.inteiro(3, 10);
  const mensal: FaturamentoMensal[] = [];
  const datasCompra: string[] = [];
  for (let indice = 0; indice <= MESES_FECHADOS; indice++) {
    const mesesAtras = MESES_FECHADOS - indice;
    const mes = somarMeses(contexto.mesAtual, -mesesAtras);
    const comprou =
      (perfil !== "parou" || mesesAtras >= mesesParado) &&
      (perfil !== "novo" || mesesAtras <= mesesDeVida) &&
      (perfil === "irregular" ? aleatorio.chance(1 / intervalo) : indice % intervalo === fase);
    // Mês corrente: só a parte já faturada até o dia útil de hoje.
    const parcial = mesesAtras === 0 ? contexto.diaUtil / contexto.diasUteis : 1;
    const valor = comprou ? porteMensal * intervalo * parcial * fatorDoMes(aleatorio, perfil, mes, mesesAtras) : 0;
    mensal.push({ mes, valor: Math.round(valor), pecas: Math.round(valor / precoMedioPeca) });
    if (valor > 0) datasCompra.push(dataNoMes(aleatorio, mes, contexto));
  }
  return { mensal, datasCompra };
}

function fatorDoMes(aleatorio: Aleatorio, perfil: Perfil, mes: string, mesesAtras: number): number {
  const sazonal = SAZONALIDADE[Number(mes.slice(5, 7)) - 1] ?? 1;
  return sazonal * fatorDeTendencia(perfil, mesesAtras) * aleatorio.entre(0.86, 1.14);
}

function fatorDeTendencia(perfil: Perfil, mesesAtras: number): number {
  if (perfil === "crescendo" && mesesAtras <= 12) return 1 + 0.045 * (12 - mesesAtras);
  if (perfil === "caindo" && mesesAtras <= 10) return Math.max(0.3, 1 - 0.075 * (10 - mesesAtras));
  return 1;
}

function gerarPedidos(aleatorio: Aleatorio, porteMensal: number, contexto: Contexto): PedidoEmAberto[] {
  if (!aleatorio.chance(0.3)) return [];
  return Array.from({ length: aleatorio.inteiro(1, 2) }, () => ({
    numero: String(aleatorio.inteiro(1_700_000, 1_850_000)),
    emissao: somarDias(contexto.hoje, -aleatorio.inteiro(1, 25)),
    entrega: somarDias(contexto.hoje, aleatorio.inteiro(2, 60)),
    itens: aleatorio.inteiro(1, 9),
    valor: Math.round(porteMensal * aleatorio.entre(0.35, 1.3)),
  })).sort((a, b) => a.entrega.localeCompare(b.entrega));
}

function sortearFamilias(aleatorio: Aleatorio): Map<string, number> {
  const pesos = new Map<string, number>();
  for (const familia of FAMILIAS) {
    if (aleatorio.chance(familia.popularidade)) pesos.set(familia.nome, aleatorio.entre(0.6, 3));
  }
  if (pesos.size === 0) pesos.set("FLEXIL", 1);
  return pesos;
}

function sortearComPeso<T>(aleatorio: Aleatorio, opcoes: readonly (readonly [T, number])[]): T {
  let sorteio = aleatorio.proximo();
  for (const [opcao, peso] of opcoes) {
    sorteio -= peso;
    if (sorteio < 0) return opcao;
  }
  const ultima = opcoes[opcoes.length - 1];
  if (!ultima) throw new Error("Sem opções para sortear");
  return ultima[0];
}

function dataNoMes(aleatorio: Aleatorio, mes: string, contexto: Contexto): string {
  const diaMaximo = mes === contexto.mesAtual ? Number(contexto.hoje.slice(8, 10)) : Math.min(27, ultimoDiaDoMes(mes));
  return `${mes}-${String(aleatorio.inteiro(Math.min(3, diaMaximo), diaMaximo)).padStart(2, "0")}`;
}

function dataAntiga(aleatorio: Aleatorio): string {
  const mes = String(aleatorio.inteiro(1, 12)).padStart(2, "0");
  return `${aleatorio.inteiro(2008, 2022)}-${mes}-${String(aleatorio.inteiro(1, 28)).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- regras (espelho do plano)

function calcularIndicadores(
  cliente: Pick<ClienteFicticio, "mensal" | "datasCompra" | "primeiraCompra">,
  contexto: Contexto,
): Indicadores {
  const ultimaCompra = cliente.datasCompra.at(-1) ?? null;
  const diasSemCompra = ultimaCompra ? diasEntre(ultimaCompra, contexto.hoje) : Number.POSITIVE_INFINITY;
  const cicloDias = cicloTipico(cliente.mensal);
  const indicadores = {
    ultimaCompra,
    diasSemCompra,
    faturamento12m: somarValores(cliente.mensal, ULTIMO_FECHADO - 11, ULTIMO_FECHADO),
    faturamento12mAnterior: somarValores(cliente.mensal, ULTIMO_FECHADO - 23, ULTIMO_FECHADO - 12),
    faturamento6m: somarValores(cliente.mensal, ULTIMO_FECHADO - 5, ULTIMO_FECHADO),
    faturamento6mAnoAnterior: somarValores(cliente.mensal, ULTIMO_FECHADO - 17, ULTIMO_FECHADO - 12),
    cicloDias,
  };
  return { ...indicadores, situacao: classificar(indicadores, cliente.primeiraCompra, contexto.hoje) };
}

/** Mediana dos intervalos entre compras em 24 meses, entre 30 e 180 dias; null com menos de 4 compras. */
function cicloTipico(mensal: FaturamentoMensal[]): number | null {
  const mesesComCompra = mensal
    .map((mes, indice) => ({ indice, valor: mes.valor }))
    .filter(({ indice, valor }) => indice > ULTIMO_FECHADO - 24 && indice <= ULTIMO_FECHADO && valor > 0)
    .map(({ indice }) => indice);
  if (mesesComCompra.length < 4) return null;
  const intervalos = mesesComCompra.slice(1).map((indice, i) => (indice - (mesesComCompra[i] ?? indice)) * 30.4);
  return Math.min(180, Math.max(30, Math.round(mediana(intervalos))));
}

function classificar(
  indicadores: Omit<Indicadores, "situacao">,
  primeiraCompra: string,
  hoje: string,
): Situacao {
  const limiteParado = indicadores.cicloDias === null ? 180 : Math.max(60, 2 * indicadores.cicloDias);
  if (indicadores.diasSemCompra > limiteParado) return "parado";
  if (diasEntre(primeiraCompra, hoje) <= 365) return "novo";
  const variacao = variacaoSemestre(indicadores);
  if (variacao !== null && variacao <= -0.2) return "em_risco";
  return "ativo";
}

function variacaoSemestre(indicadores: Pick<Indicadores, "faturamento6m" | "faturamento6mAnoAnterior">): number | null {
  if (indicadores.faturamento6mAnoAnterior < 3_000) return null;
  return indicadores.faturamento6m / indicadores.faturamento6mAnoAnterior - 1;
}

// ---------------------------------------------------------------- telas

function resumirCliente(cliente: ClienteFicticio): ClienteResumo {
  const { indicadores } = cliente;
  return {
    codigo: cliente.codigo,
    nome: cliente.nome,
    cidade: cliente.cidade,
    uf: cliente.uf,
    mercado: cliente.mercado,
    situacao: indicadores.situacao,
    ultimaCompra: indicadores.ultimaCompra,
    faturamento12m: indicadores.faturamento12m,
    variacao12m:
      indicadores.faturamento12mAnterior >= 2_000
        ? indicadores.faturamento12m / indicadores.faturamento12mAnterior - 1
        : null,
    evolucao12m: Array.from({ length: 13 }, (_, i) => {
      const fim = ULTIMO_FECHADO - 12 + i;
      return somarValores(cliente.mensal, fim - 11, fim);
    }),
  };
}

function montarFicha(cliente: ClienteFicticio, dados: Carteira): FichaCliente {
  const baseFamilias = cliente.indicadores.faturamento12m || somarValores(cliente.mensal, 0, ULTIMO_FECHADO) / 3;
  const familias = distribuirPorFamilia(cliente, baseFamilias);
  const mix = sugerirMix(paraMix(cliente), dados.suprens);
  return {
    ...resumirCliente(cliente),
    razaoSocial: cliente.razaoSocial,
    primeiraCompra: cliente.primeiraCompra,
    cicloDias: cliente.indicadores.cicloDias,
    mensal: cliente.mensal.slice(ULTIMO_FECHADO - 23),
    familias,
    produtos: produtosDoCliente(cliente, familias),
    oportunidades: mix?.oportunidades ?? [],
    grupoDoMix: mix ? { porte: mix.porte } : null,
    pedidosEmAberto: cliente.pedidos,
  };
}

function distribuirPorFamilia(cliente: ClienteFicticio, base: number) {
  const totalPesos = [...cliente.pesosFamilias.values()].reduce((soma, peso) => soma + peso, 0);
  return [...cliente.pesosFamilias.entries()]
    .map(([familia, peso]) => ({ familia, valor: Math.round((base * peso) / totalPesos), participacao: peso / totalPesos }))
    .sort((a, b) => b.valor - a.valor);
}

function produtosDoCliente(cliente: ClienteFicticio, familias: FichaCliente["familias"]): ProdutoComprado[] {
  const aleatorio = criarAleatorio(Number(cliente.codigo.slice(0, 8)));
  const produtos = familias.flatMap(({ familia, valor }) => {
    const prefixo = FAMILIAS.find((f) => f.nome === familia)?.prefixo ?? "PRD";
    const quantidade = aleatorio.inteiro(1, 3);
    return Array.from({ length: quantidade }, () => {
      const valorDoProduto = Math.round((valor / quantidade) * aleatorio.entre(0.6, 1.4));
      return {
        codigo: `${prefixo}${aleatorio.inteiro(10_000, 99_999)}`,
        familia,
        pecas: Math.round(valorDoProduto / cliente.precoMedioPeca),
        valor: valorDoProduto,
        ultimaCompra: aleatorio.escolher(cliente.datasCompra.slice(-4).length ? cliente.datasCompra.slice(-4) : [cliente.primeiraCompra]),
      };
    });
  });
  return produtos.sort((a, b) => b.valor - a.valor).slice(0, 8);
}

/** No fictício, as famílias de cada cliente não mudam: quem comprou algo no período comprou todas. */
function paraMix(cliente: ClienteFicticio): ClienteNoMix {
  const familias = new Set(cliente.pesosFamilias.keys());
  const comprouEm24Meses = somarValores(cliente.mensal, ULTIMO_FECHADO - 23, ULTIMO_FECHADO) > 0;
  return {
    codigo: cliente.codigo,
    mercado: cliente.mercado,
    faturamento12m: cliente.indicadores.faturamento12m,
    familias12m: cliente.indicadores.faturamento12m > 0 ? familias : new Set<string>(),
    familias24m: comprouEm24Meses ? familias : new Set<string>(),
  };
}

function montarPainel(dados: Carteira): PainelInicio {
  const fracaoDoMes = dados.diaUtil / dados.diasUteis;
  const pedidos = dados.clientes.flatMap((c) => c.pedidos);
  const fimDoMes = `${dados.mesAtual}-${String(ultimoDiaDoMes(dados.mesAtual)).padStart(2, "0")}`;
  const aFaturarNoMes = somar(pedidos.filter((p) => p.entrega <= fimDoMes).map((p) => p.valor));
  return {
    mesAtual: {
      mes: dados.mesAtual,
      faturado: somarMes(dados, MESES_FECHADOS),
      anoAnteriorMesmoDiaUtil: Math.round(somarMes(dados, MESES_FECHADOS - 12) * fracaoDoMes),
      aFaturarNoMes,
      diaUtil: dados.diaUtil,
      diasUteis: dados.diasUteis,
    },
    ano: acumuladoDoAno(dados, fracaoDoMes),
    pedidosEmAberto: { quantidade: pedidos.length, valor: somar(pedidos.map((p) => p.valor)) },
    mensal: mesesDoAno(dados, aFaturarNoMes),
    destaques: destaquesDaCarteira(dados.clientes),
  };
}

function acumuladoDoAno(dados: Carteira, fracaoDoMes: number) {
  const mesesNoAno = Number(dados.mesAtual.slice(5, 7));
  let acumulado = 0;
  let acumuladoAnoAnterior = 0;
  for (let i = 0; i < mesesNoAno; i++) {
    const indice = MESES_FECHADOS - i;
    acumulado += somarMes(dados, indice);
    acumuladoAnoAnterior += somarMes(dados, indice - 12) * (i === 0 ? fracaoDoMes : 1);
  }
  return { acumulado, acumuladoAnoAnterior: Math.round(acumuladoAnoAnterior) };
}

function mesesDoAno(dados: Carteira, aFaturarNoMes: number): PainelInicio["mensal"] {
  const ano = dados.mesAtual.slice(0, 4);
  const mesAtualNumero = Number(dados.mesAtual.slice(5, 7));
  return Array.from({ length: 12 }, (_, i) => {
    const numero = i + 1;
    const indice = MESES_FECHADOS - (mesAtualNumero - numero);
    return {
      mes: `${ano}-${String(numero).padStart(2, "0")}`,
      faturado: numero <= mesAtualNumero ? somarMes(dados, indice) : null,
      anoAnterior: somarMes(dados, indice - 12),
      aFaturar: numero === mesAtualNumero ? aFaturarNoMes : null,
    };
  });
}

function destaquesDaCarteira(clientes: ClienteFicticio[]): PainelInicio["destaques"] {
  const comVariacao = clientes.map((cliente) => ({ cliente, variacao: variacaoSemestre(cliente.indicadores) }));
  const diferenca = (c: ClienteFicticio) => c.indicadores.faturamento6m - c.indicadores.faturamento6mAnoAnterior;
  return {
    pararam: agrupar(
      clientes
        .filter((c) => c.indicadores.situacao === "parado" && c.indicadores.diasSemCompra <= 730)
        .map((c) => destaque(c, perdaMensal(c), null))
        .sort((a, b) => b.valor - a.valor),
    ),
    menos: agrupar(
      comVariacao
        .filter(({ cliente, variacao }) => variacao !== null && variacao <= -0.2 && !["parado", "novo"].includes(cliente.indicadores.situacao))
        .map(({ cliente, variacao }) => destaque(cliente, diferenca(cliente), variacao))
        .sort((a, b) => a.valor - b.valor),
    ),
    mais: agrupar(
      comVariacao
        .filter(({ cliente, variacao }) => variacao !== null && variacao >= 0.2 && cliente.indicadores.situacao !== "novo")
        .map(({ cliente, variacao }) => destaque(cliente, diferenca(cliente), variacao))
        .sort((a, b) => b.valor - a.valor),
    ),
    novos: agrupar(
      clientes
        .filter((c) => c.indicadores.situacao === "novo")
        .map((c) => destaque(c, somarValores(c.mensal, 0, MESES_FECHADOS), null))
        .sort((a, b) => b.valor - a.valor),
    ),
  };
}

/** Faturamento mensal médio nos 12 meses anteriores à última compra. */
function perdaMensal(cliente: ClienteFicticio): number {
  const ultimoComCompra = cliente.mensal.findLastIndex((mes) => mes.valor > 0);
  if (ultimoComCompra < 0) return 0;
  return Math.round(somarValores(cliente.mensal, ultimoComCompra - 11, ultimoComCompra) / 12);
}

function destaque(cliente: ClienteFicticio, valor: number, variacao: number | null): DestaqueCliente {
  return { cliente: resumirCliente(cliente), valor, variacao };
}

function agrupar(itens: DestaqueCliente[]): GrupoDestaque {
  return {
    quantidade: itens.length,
    valorTotal: somar(itens.map((item) => item.valor)),
    itens: itens.slice(0, DESTAQUES_POR_GRUPO),
  };
}

// ---------------------------------------------------------------- contas

function somarMes(dados: Carteira, indice: number): number {
  return somar(dados.clientes.map((c) => c.mensal[indice]?.valor ?? 0));
}

function somarValores(mensal: FaturamentoMensal[], inicio: number, fim: number): number {
  return somar(mensal.slice(Math.max(0, inicio), fim + 1).map((mes) => mes.valor));
}

function somar(valores: number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const centro = ordenados[meio] ?? 0;
  return ordenados.length % 2 ? centro : ((ordenados[meio - 1] ?? centro) + centro) / 2;
}
