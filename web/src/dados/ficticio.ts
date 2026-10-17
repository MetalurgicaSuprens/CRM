import {
  dataDoMomento,
  diasEntre,
  mesDe,
  momentoEmBrasilia,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
} from "dominio/datas";
import { diaUtilDoMes, diasUteisDoMes } from "dominio/calendario";
import { criarAleatorio, type Aleatorio } from "./aleatorio";
import { catalogoFicticio, FAMILIAS } from "./catalogoFicticio";
import { PECAS_POR_CENTO } from "./pedido";
import { analisarCliente, semestreDoRitmo, type HistoricoDoCliente, type MudancaDeRitmo } from "dominio/analises";
import { cicloTipico, comprasDasNotas } from "dominio/ciclo";
import { evolucao12m, variacao12m } from "dominio/indicadores";
import { MESES_DO_RITMO, projetarMes } from "dominio/projecao";
import { sugerirMix, type ClienteNoMix } from "dominio/mix";
import type {
  Analises,
  ClienteResumo,
  DestaqueCliente,
  FaturamentoMensal,
  FichaCliente,
  GrupoDestaque,
  ItemDoErp,
  ItemEmAberto,
  Mercado,
  NotaFaturada,
  PainelInicio,
  PedidoDaFicha,
  PedidoEmAberto,
  PedidoNoErp,
  ProdutoComprado,
  Situacao,
  SituacaoDosDados,
  StatusDoCadastro,
} from "./tipos";

/*
 * Carteira fictícia e determinística para o protótipo (F1). Nenhum nome ou valor é real.
 * As regras de situação seguem docs/plano.md; a versão de verdade será calculada pelo extrator.
 */

const SEMENTE = 1401;
const QUANTIDADE_DE_CLIENTES = 86;
/** Clientes dos outros representantes: só entram na comparação do mix, nunca aparecem na tela. */
const OUTROS_CLIENTES_DA_SUPRENS = 600;
/** Gerados à parte (outra semente) para não mudar os 86 clientes que já existiam no protótipo. */
const CLIENTES_QUE_VOLTARAM = 3;
/** Índices de `mensal`: 0..35 são os meses fechados (35 = mês passado); 36 é o mês corrente. */
const MESES_FECHADOS = 36;
const ULTIMO_FECHADO = MESES_FECHADOS - 1;
const DESTAQUES_POR_GRUPO = 5;
const SERIE_DAS_NOTAS = "1";
const PRIMEIRO_NUMERO_DE_NOTA = 180_000;
/** Entrega dos outros itens do pedido, em dias depois da mais próxima. */
const DIAS_A_MAIS_NA_ENTREGA = [0, 0, 7, 14, 21];
/** A foto fictícia começa a ser lida 14 minutos antes da primeira consulta. */
const ATRASO_DA_FOTO_MS = 14 * 60_000;

const REPRESENTANTE = { nome: "Carlos Andrade", codigos: ["1401", "1402"] };

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
/** Como no ERP, há pessoas físicas na carteira, todas do mercado praça. */
const PESSOAS_FISICAS = ["Rogério Tavares", "Sandra Moreira", "Valter Nunes"];
const CLIENTES_DA_PRACA_ENTRE_PESSOAS_FISICAS = 15;
/**
 * Como no SGI, alguns clientes estão fora de ativo no cadastro: um a cada 29 da carteira, a partir
 * do 8º, alternando inativo e substituído.
 */
const CLIENTES_ENTRE_FORA_DE_ATIVO = 29;
const PRIMEIRO_FORA_DE_ATIVO = 7;
/** Cidade, UF e código IBGE do município, que liga o cliente ao mapa. */
const CIDADES: readonly (readonly [string, string, string])[] = [
  ["Ribeirão Preto", "SP", "3543402"], ["Campinas", "SP", "3509502"], ["Piracicaba", "SP", "3538709"],
  ["Bauru", "SP", "3506003"], ["Franca", "SP", "3516200"], ["Sorocaba", "SP", "3552205"],
  ["São José do Rio Preto", "SP", "3549805"], ["Londrina", "PR", "4113700"], ["Maringá", "PR", "4115200"],
  ["Cascavel", "PR", "4104808"], ["Ponta Grossa", "PR", "4119905"], ["Joinville", "SC", "4209102"],
  ["Chapecó", "SC", "4204202"], ["Blumenau", "SC", "4202404"], ["Uberlândia", "MG", "3170206"],
  ["Uberaba", "MG", "3170107"], ["Poços de Caldas", "MG", "3151800"], ["Rio Verde", "GO", "5218805"],
  ["Campo Grande", "MS", "5002704"], ["Dourados", "MS", "5003702"],
];
/** Peso de cada mês do ano no faturamento: férias coletivas em dezembro e janeiro. */
const SAZONALIDADE = [0.72, 0.88, 1.04, 1.02, 1.08, 1.04, 0.98, 1.06, 1.04, 1.1, 1.0, 0.78];

/** "voltou" fica fora do sorteio: só os clientes reativados, gerados à parte, usam. */
type Perfil = "estavel" | "crescendo" | "caindo" | "parou" | "novo" | "irregular" | "voltou";
const PERFIS: readonly (readonly [Perfil, number])[] = [
  ["estavel", 0.44], ["crescendo", 0.14], ["caindo", 0.14], ["parou", 0.1], ["novo", 0.06], ["irregular", 0.12],
];

type Contexto = { hoje: string; mesAtual: string; diaUtil: number; diasUteis: number };

type MesFicticio = FaturamentoMensal & { pecas: number };

type ClienteFicticio = {
  codigo: string;
  codigoErp: string | null;
  nome: string;
  razaoSocial: string;
  cidade: string;
  uf: string;
  municipio: string;
  mercado: Mercado;
  status: StatusDoCadastro;
  precoMedioPeca: number;
  pesosFamilias: Map<string, number>;
  mensal: MesFicticio[];
  datasCompra: string[];
  primeiraCompra: string;
  pedidos: PedidoEmAberto[];
  indicadores: Indicadores;
};

type Indicadores = {
  ultimaCompra: string | null;
  faturamento12m: number;
  cicloDias: number | null;
  situacao: Situacao;
  /** Só no cliente em risco: a variação do semestre que o pôs em risco. */
  quedaNoSemestre: number | null;
};

type Carteira = Contexto & {
  /** Início da leitura que gerou a foto, em Brasília. A data dele é o `hoje`. */
  atualizadoEm: string;
  clientes: ClienteFicticio[];
  /** Todos os clientes da Suprens (os da carteira e os dos outros), para comparar o mix. */
  suprens: ClienteNoMix[];
};

let carteiraEmCache: Carteira | null = null;

/** A foto fictícia é tirada uma vez, como o extrator faria em Brasília; só o relógio anda. */
function carteira(): Carteira {
  carteiraEmCache ??= gerarCarteira(momentoEmBrasilia(new Date(Date.now() - ATRASO_DA_FOTO_MS)));
  return carteiraEmCache;
}

export function situacaoDosDadosFicticia(agora = new Date()): SituacaoDosDados {
  const { atualizadoEm, hoje, mesAtual } = carteira();
  return { atualizadoEm, hoje, semestre: semestreDoRitmo(mesAtual), relogio: momentoEmBrasilia(agora), representante: REPRESENTANTE };
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

export function analisesFicticias(): Analises {
  return montarAnalises(carteira());
}

/** Pedidos em aberto no ERP de todos os clientes da carteira, do mais próximo da entrega ao mais longe. */
export function pedidosNoErpFicticios(): PedidoNoErp[] {
  return carteira()
    .clientes.flatMap((cliente) =>
      cliente.pedidos.map((pedido) => ({
        ...pedido,
        cliente: resumirCliente(cliente),
        itensEmAberto: itensDoPedido(pedido, cliente.pesosFamilias),
      })),
    )
    .sort((a, b) => a.entrega.localeCompare(b.entrega));
}

/**
 * Notas dos últimos 45 dias, da mais recente à mais antiga. Os números crescem com a emissão, como
 * no ERP, e nunca se repetem na mesma série.
 */
export function notasFaturadasFicticias(): NotaFaturada[] {
  const { clientes, hoje } = carteira();
  const aleatorio = criarAleatorio(SEMENTE + 3);
  let numero = PRIMEIRO_NUMERO_DE_NOTA;
  return clientes
    .flatMap((cliente) =>
      cliente.datasCompra
        .filter((data) => diasEntre(data, hoje) <= 45)
        .map((data) => ({
          emissao: data,
          cliente: resumirCliente(cliente),
          valor: cliente.mensal.find((mes) => mes.mes === data.slice(0, 7))?.valor ?? 0,
          familias: cliente.pesosFamilias,
        })),
    )
    .sort((a, b) => a.emissao.localeCompare(b.emissao))
    .map(({ familias, ...nota }) => {
      numero += aleatorio.inteiro(1, 40);
      return { id: `${SERIE_DAS_NOTAS}-${numero}`, numero: String(numero), ...nota, ...detalheDaNota(numero, nota.valor, familias) };
    })
    .reverse();
}

/*
 * Os itens de cada pedido e de cada nota saem de um sorteio só deles, com a semente do número:
 * assim os clientes, os pedidos e as notas da carteira continuam os mesmos.
 */

/** O primeiro item tem a entrega do pedido, a mais próxima. */
function itensDoPedido(pedido: PedidoEmAberto, familias: ReadonlyMap<string, number>): ItemEmAberto[] {
  const aleatorio = criarAleatorio(Number(pedido.numero));
  return sortearItens(aleatorio, pedido.valor, pedido.itens, familias).map((item, i) => ({
    ...item,
    entrega: i === 0 ? pedido.entrega : somarDias(pedido.entrega, aleatorio.escolher(DIAS_A_MAIS_NA_ENTREGA)),
  }));
}

function detalheDaNota(numero: number, valor: number, familias: ReadonlyMap<string, number>): Pick<NotaFaturada, "pedidos" | "itens"> {
  const aleatorio = criarAleatorio(numero);
  return {
    pedidos: [String(aleatorio.inteiro(1_700_000, 1_850_000))],
    itens: sortearItens(aleatorio, valor, aleatorio.inteiro(2, 12), familias),
  };
}

/** Itens que somam o valor, com produtos das famílias que o cliente compra, em embalagens fechadas. */
function sortearItens(aleatorio: Aleatorio, valor: number, quantidade: number, familias: ReadonlyMap<string, number>): ItemDoErp[] {
  const sorteados = catalogoFicticio()
    .filter((produto) => familias.has(produto.familia))
    .map((produto) => ({ produto, ordem: aleatorio.proximo(), peso: aleatorio.entre(0.5, 2) }))
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, quantidade);
  const somaDosPesos = somar(sorteados.map(({ peso }) => peso));
  let restante = valor;
  return sorteados.map(({ produto, peso }, i) => {
    const valorDoItem = i === sorteados.length - 1 ? restante : Math.round((valor * peso) / somaDosPesos);
    restante -= valorDoItem;
    const embalagens = Math.max(1, Math.round((valorDoItem / produto.precoBase) * (PECAS_POR_CENTO / produto.embalagem)));
    return { ordem: i + 1, codigo: produto.codigo, familia: produto.familia, pecas: embalagens * produto.embalagem, valor: valorDoItem };
  });
}

// ---------------------------------------------------------------- geração

function gerarCarteira(atualizadoEm: string): Carteira {
  const aleatorio = criarAleatorio(SEMENTE);
  const hoje = dataDoMomento(atualizadoEm);
  const mesAtual = mesDe(hoje);
  const contexto: Contexto = { hoje, mesAtual, diaUtil: diaUtilDoMes(hoje), diasUteis: diasUteisDoMes(mesAtual) };
  const clientes = Array.from({ length: QUANTIDADE_DE_CLIENTES }, () => gerarCliente(aleatorio, contexto));
  const aleatorioDosQueVoltaram = criarAleatorio(SEMENTE + 2);
  clientes.push(...Array.from({ length: CLIENTES_QUE_VOLTARAM }, () => gerarCliente(aleatorioDosQueVoltaram, contexto, "voltou")));
  const outros = gerarOutrosClientesDaSuprens(criarAleatorio(SEMENTE + 1));
  const carteira = comStatusForaDeAtivo(comPessoasFisicas(clientes));
  return { ...contexto, atualizadoEm, clientes: carteira, suprens: [...carteira.map(paraMix), ...outros] };
}

function gerarCliente(aleatorio: Aleatorio, contexto: Contexto, perfilFixo?: Perfil): ClienteFicticio {
  const perfil = perfilFixo ?? sortearComPeso(aleatorio, PERFIS);
  const mercado = sortearMercado(aleatorio);
  const [cidade, uf, municipio] = aleatorio.escolher(CIDADES);
  const nome = `${aleatorio.escolher(RAMOS)} ${aleatorio.escolher(NOMES)}`;
  const porteMensal = sortearPorteMensal(aleatorio, mercado);
  const precoMedioPeca = aleatorio.entre(1.6, 5.2);
  const { mensal, datasCompra } = gerarHistorico(aleatorio, perfil, porteMensal, precoMedioPeca, contexto);
  const primeiraCompra = perfil === "novo" ? (datasCompra[0] ?? contexto.hoje) : dataAntiga(aleatorio);
  const codigo = `${aleatorio.inteiro(10_000_000, 99_999_999)}000${aleatorio.inteiro(1, 3)}`;
  const base = {
    codigo,
    codigoErp: codigo,
    nome,
    razaoSocial: `${nome} ${aleatorio.escolher(SUFIXOS)}`,
    cidade,
    uf,
    municipio,
    mercado,
    status: "ativo" as const,
    precoMedioPeca,
    pesosFamilias: sortearFamilias(aleatorio),
    mensal,
    datasCompra,
    primeiraCompra,
    pedidos: perfil === "parou" ? [] : gerarPedidos(aleatorio, porteMensal, contexto),
  };
  return { ...base, indicadores: calcularIndicadores(base, contexto) };
}

/** Troca algumas empresas da praça por pessoas físicas: nome de gente e nenhum código do ERP. */
function comPessoasFisicas(clientes: ClienteFicticio[]): ClienteFicticio[] {
  const daPraca = clientes.filter((cliente) => cliente.mercado === "PRACA");
  const nomes = new Map(
    PESSOAS_FISICAS.map((nome, i) => [daPraca[(i + 1) * CLIENTES_DA_PRACA_ENTRE_PESSOAS_FISICAS], nome]),
  );
  return clientes.map((cliente) => {
    const nome = nomes.get(cliente);
    return nome ? { ...cliente, nome, razaoSocial: nome, codigoErp: null } : cliente;
  });
}

/** Tira alguns clientes de ativo no cadastro, sem sorteio novo: o resto da carteira não muda. */
function comStatusForaDeAtivo(clientes: ClienteFicticio[]): ClienteFicticio[] {
  return clientes.map((cliente, i) => {
    if (i % CLIENTES_ENTRE_FORA_DE_ATIVO !== PRIMEIRO_FORA_DE_ATIVO) return cliente;
    const ordem = Math.floor(i / CLIENTES_ENTRE_FORA_DE_ATIVO);
    return { ...cliente, status: ordem % 2 === 0 ? "inativo" : "substituido" };
  });
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
  // Só quem voltou sorteia a pausa: a sequência dos outros perfis não muda.
  const pausa = perfil === "voltou" ? { mesesDesdeAVolta: aleatorio.inteiro(2, 9), duracao: aleatorio.inteiro(13, 18) } : null;
  const mensal: MesFicticio[] = [];
  const datasCompra: string[] = [];
  for (let indice = 0; indice <= MESES_FECHADOS; indice++) {
    const mesesAtras = MESES_FECHADOS - indice;
    const mes = somarMeses(contexto.mesAtual, -mesesAtras);
    const comprou =
      (perfil !== "parou" || mesesAtras >= mesesParado) &&
      (perfil !== "novo" || mesesAtras <= mesesDeVida) &&
      (pausa === null || mesesAtras <= pausa.mesesDesdeAVolta || mesesAtras > pausa.mesesDesdeAVolta + pausa.duracao) &&
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

type BaseDoCliente = Pick<ClienteFicticio, "mensal" | "datasCompra" | "primeiraCompra" | "pedidos">;

function calcularIndicadores(cliente: BaseDoCliente, contexto: Contexto): Indicadores {
  const historico = historicoParaAnalise(cliente, contexto.hoje);
  const { situacao, ritmo } = analisarCliente(historico, contexto.hoje);
  return {
    ultimaCompra: cliente.datasCompra.at(-1) ?? null,
    faturamento12m: somarValores(cliente.mensal, ULTIMO_FECHADO - 11, ULTIMO_FECHADO),
    cicloDias: historico.cicloDias,
    situacao,
    quedaNoSemestre: ritmo?.direcao === "menos" ? ritmo.variacao : null,
  };
}

function historicoParaAnalise(cliente: BaseDoCliente, hoje: string): HistoricoDoCliente {
  return {
    mensal: cliente.mensal.slice(0, MESES_FECHADOS),
    compras: cliente.datasCompra,
    primeiraCompra: cliente.primeiraCompra,
    cicloDias: cicloTipico(comprasDasNotas(cliente.datasCompra), hoje),
    temPedidoEmAberto: cliente.pedidos.length > 0,
  };
}


// ---------------------------------------------------------------- telas

function resumirCliente(cliente: ClienteFicticio): ClienteResumo {
  const { indicadores } = cliente;
  const evolucao = evolucao12m(cliente.mensal.slice(0, MESES_FECHADOS).map((mes) => mes.valor));
  return {
    codigo: cliente.codigo,
    codigoErp: cliente.codigoErp,
    nome: cliente.nome,
    cidade: cliente.cidade,
    uf: cliente.uf,
    municipio: cliente.municipio,
    mercado: cliente.mercado,
    situacao: indicadores.situacao,
    status: cliente.status,
    ultimaCompra: indicadores.ultimaCompra,
    faturamento12m: indicadores.faturamento12m,
    variacao12m: variacao12m(evolucao),
    evolucao12m: evolucao,
    quedaNoSemestre: indicadores.quedaNoSemestre,
    // Os grupos vêm do cadastro do SGI: a carteira fictícia não tem.
    cnpjs: null,
  };
}

function montarFicha(cliente: ClienteFicticio, dados: Carteira): FichaCliente {
  const baseFamilias = cliente.indicadores.faturamento12m || somarValores(cliente.mensal, 0, ULTIMO_FECHADO) / 3;
  const familias = distribuirPorFamilia(cliente, baseFamilias);
  const mix = sugerirMix(paraMix(cliente), dados.suprens);
  return {
    ...resumirCliente(cliente),
    razaoSocial: cliente.razaoSocial,
    // Na carteira fictícia todo cliente já comprou um dia; o null fica para a foto de verdade.
    clienteDesde: Number(cliente.primeiraCompra.slice(0, 4)),
    cicloDias: cliente.indicadores.cicloDias,
    mensal: cliente.mensal.map(({ mes, valor }) => ({ mes, valor })),
    familias,
    produtos: produtosDoCliente(cliente, familias),
    oportunidades: mix?.oportunidades ?? [],
    grupoDoMix: mix ? { porte: mix.porte } : null,
    pedidos: pedidosDaFicha(cliente, dados),
    grupo: null,
  };
}

function pedidosDaFicha(cliente: ClienteFicticio, contexto: Contexto): PedidoDaFicha[] {
  const emAberto = cliente.pedidos.map(
    (pedido): PedidoDaFicha => ({
      id: pedido.numero,
      cnpj: null,
      numero: pedido.numero,
      status: "em_aberto",
      emissao: pedido.emissao,
      entrega: pedido.entrega,
      itens: itensDoPedido(pedido, cliente.pesosFamilias),
      valor: pedido.valor,
    }),
  );
  return [...emAberto, ...pedidosFaturados(cliente, contexto)];
}

/**
 * Um pedido faturado por compra dos 12 meses fechados e do corrente, emitido alguns dias antes da
 * nota. O valor divide o do mês entre as compras dele, para a soma bater com o faturado.
 */
function pedidosFaturados(cliente: ClienteFicticio, { hoje, mesAtual }: Contexto): PedidoDaFicha[] {
  const aleatorio = criarAleatorio(Number(cliente.codigo.slice(0, 8)) + 11);
  const inicio = `${somarMeses(mesAtual, -12)}-01`;
  const compras = cliente.datasCompra.filter((data) => data >= inicio && data <= hoje);
  let numero = aleatorio.inteiro(1_500_000, 1_600_000);
  return compras.map((data) => {
    const mes = mesDe(data);
    const comprasDoMes = compras.filter((outra) => mesDe(outra) === mes).length;
    const valor = Math.round((cliente.mensal.find((mensal) => mensal.mes === mes)?.valor ?? 0) / comprasDoMes);
    numero += aleatorio.inteiro(50, 900);
    return {
      id: String(numero),
      cnpj: null,
      numero: String(numero),
      status: "faturado",
      emissao: somarDias(data, -aleatorio.inteiro(2, 12)),
      entrega: data,
      itens: sortearItens(aleatorio, valor, aleatorio.inteiro(2, 14), cliente.pesosFamilias).map((item) => ({ ...item, entrega: null })),
      valor,
    };
  });
}

function distribuirPorFamilia(cliente: ClienteFicticio, base: number) {
  const totalPesos = [...cliente.pesosFamilias.values()].reduce((soma, peso) => soma + peso, 0);
  return [...cliente.pesosFamilias.entries()]
    .map(([familia, peso]) => {
      const valor = Math.round((base * peso) / totalPesos);
      return { familia, valor, participacao: peso / totalPesos, pecas: Math.round(valor / cliente.precoMedioPeca) };
    })
    .sort((a, b) => b.valor - a.valor);
}

/** Produtos do catálogo que o cliente comprou, de 1 a 3 por família, sem repetir. */
function produtosDoCliente(cliente: ClienteFicticio, familias: FichaCliente["familias"]): ProdutoComprado[] {
  const aleatorio = criarAleatorio(Number(cliente.codigo.slice(0, 8)));
  const catalogo = catalogoFicticio();
  const produtos = familias.flatMap(({ familia, valor }) => {
    const daFamilia = catalogo.filter((produto) => produto.familia === familia);
    const quantidade = Math.min(aleatorio.inteiro(1, 3), daFamilia.length);
    const inicio = aleatorio.inteiro(0, daFamilia.length - 1);
    return Array.from({ length: quantidade }, (_, i) => daFamilia[(inicio + i) % daFamilia.length]).flatMap((produto) => {
      if (!produto) return [];
      const valorDoProduto = Math.round((valor / quantidade) * aleatorio.entre(0.6, 1.4));
      return [
        {
          codigo: produto.codigo,
          familia,
          pecas: Math.round(valorDoProduto / cliente.precoMedioPeca),
          valor: valorDoProduto,
          ultimaCompra: aleatorio.escolher(cliente.datasCompra.slice(-4).length ? cliente.datasCompra.slice(-4) : [cliente.primeiraCompra]),
        },
      ];
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
  const faturado = somarMes(dados, MESES_FECHADOS);
  return {
    mesAtual: {
      mes: dados.mesAtual,
      faturado,
      anoAnteriorMesmoDiaUtil: Math.round(somarMes(dados, MESES_FECHADOS - 12) * fracaoDoMes),
      aFaturarNoMes,
      projecao: projetarMes({
        faturado,
        ritmoPorDiaUtil: ritmoDosUltimosMeses(dados),
        diasUteisRestantes: dados.diasUteis - dados.diaUtil,
        aFaturarNoMes,
      }),
      diaUtil: dados.diaUtil,
      diasUteis: dados.diasUteis,
    },
    ano: acumuladoDoAno(dados, fracaoDoMes),
    pedidosEmAberto: { quantidade: pedidos.length, valor: somar(pedidos.map((p) => p.valor)) },
    mensal: mesesDoAno(dados, aFaturarNoMes),
    destaques: destaquesDasAnalises(montarAnalises(dados)),
  };
}

/** Faturado da carteira por dia útil (segunda a sexta) nos 6 meses fechados. */
function ritmoDosUltimosMeses(dados: Carteira): number {
  const indices = Array.from({ length: MESES_DO_RITMO }, (_, i) => MESES_FECHADOS - 1 - i);
  const faturado = somar(indices.map((indice) => somarMes(dados, indice)));
  const diasUteis = somar(indices.map((indice) => diasUteisDoMes(somarMeses(dados.mesAtual, indice - MESES_FECHADOS))));
  return faturado / diasUteis;
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

/** As listas das análises; o Início mostra os primeiros de cada uma, com as mesmas contas. */
function montarAnalises(dados: Carteira): Analises {
  const linhas = dados.clientes.map((cliente) => {
    const historico = historicoParaAnalise(cliente, dados.hoje);
    return { cliente, historico, resumo: resumirCliente(cliente), analise: analisarCliente(historico, dados.hoje) };
  });
  const comVariacao = (cliente: ClienteResumo, ritmo: MudancaDeRitmo) => ({
    cliente,
    semestre: ritmo.semestre,
    semestreAnoAnterior: ritmo.semestreAnoAnterior,
    variacao: ritmo.variacao,
    variacaoPecas: ritmo.variacaoPecas,
  });
  const comRitmo = (direcao: MudancaDeRitmo["direcao"]) =>
    linhas.flatMap(({ analise, resumo }) => (analise.ritmo?.direcao === direcao ? [comVariacao(resumo, analise.ritmo)] : []));
  const diferenca = (item: { semestre: number; semestreAnoAnterior: number }) => item.semestre - item.semestreAnoAnterior;
  return {
    semestre: semestreDoRitmo(dados.mesAtual),
    pararam: linhas
      .flatMap(({ analise, historico, resumo }) =>
        analise.parada ? [{ cliente: resumo, ...analise.parada, cicloDias: historico.cicloDias }] : [],
      )
      .sort((a, b) => b.perdaMensal - a.perdaMensal),
    menos: comRitmo("menos").sort((a, b) => diferenca(a) - diferenca(b)),
    mais: comRitmo("mais").sort((a, b) => diferenca(b) - diferenca(a)),
    novos: linhas
      .flatMap(({ analise, cliente, resumo }) =>
        analise.entrada ? [{ cliente: resumo, ...analise.entrada, faturadoDesde: faturadoDesde(cliente, analise.entrada.desde) }] : [],
      )
      .sort((a, b) => b.faturadoDesde - a.faturadoDesde),
    mix: linhas
      .filter(({ analise }) => analise.isAtivo)
      .flatMap(({ cliente, resumo }) => {
        const mix = sugerirMix(paraMix(cliente), dados.suprens);
        return mix && mix.oportunidades.length > 0 ? [{ cliente: resumo, porte: mix.porte, oportunidades: mix.oportunidades }] : [];
      })
      .sort((a, b) => b.cliente.faturamento12m - a.cliente.faturamento12m),
  };
}

/** Inclui o mês corrente, até hoje. */
function faturadoDesde(cliente: ClienteFicticio, data: string): number {
  const mesDaData = data.slice(0, 7);
  return somar(cliente.mensal.filter((mes) => mes.mes >= mesDaData).map((mes) => mes.valor));
}

function destaquesDasAnalises(analises: Analises): PainelInicio["destaques"] {
  const variacao = (item: Analises["menos"][number]): DestaqueCliente => ({
    cliente: item.cliente,
    valor: item.semestre - item.semestreAnoAnterior,
    variacao: item.variacao,
  });
  return {
    pararam: agrupar(analises.pararam.map((item) => ({ cliente: item.cliente, valor: item.perdaMensal, variacao: null }))),
    menos: agrupar(analises.menos.map(variacao)),
    mais: agrupar(analises.mais.map(variacao)),
    novos: agrupar(analises.novos.map((item) => ({ cliente: item.cliente, valor: item.faturadoDesde, variacao: null }))),
  };
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

function somarValores(mensal: MesFicticio[], inicio: number, fim: number): number {
  return somar(mensal.slice(Math.max(0, inicio), fim + 1).map((mes) => mes.valor));
}

function somar(valores: number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}
