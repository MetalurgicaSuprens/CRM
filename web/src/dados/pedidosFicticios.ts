import { momentoEmBrasilia } from "../calendario";
import { criarAleatorio } from "./aleatorio";
import { catalogoFicticio } from "./catalogoFicticio";
import { clientesFicticios, fichaFicticia, notasFaturadasFicticias, pedidosNoErpFicticios } from "./ficticio";
import { totalDoPedido } from "./pedido";
import { ROTULOS_DE_MERCADO } from "./rotulos";
import type {
  CatalogoDoCliente,
  ClienteResumo,
  EtapaDoPedido,
  FichaCliente,
  ItemDoPedido,
  ItemEnviado,
  PainelDePedidos,
  PedidoEnviado,
  Rascunho,
  RascunhoParaSalvar,
} from "./tipos";

/*
 * Pedidos do protótipo (F1). Os rascunhos e os pedidos enviados ficam só na memória do navegador:
 * somem ao recarregar a página. Na F5, quem guarda é o servidor (app.db).
 */

const rascunhos = new Map<string, Rascunho>();
const enviadosNaSessao: PedidoEnviado[] = [];
let proximoRascunho = 1;
let proximoNumero = 109;
let exemplosEmCache: PedidoEnviado[] | null = null;

export function catalogoDoClienteFicticio(codigoCliente: string): CatalogoDoCliente | null {
  const ficha = fichaFicticia(codigoCliente);
  if (!ficha) return null;
  const aleatorio = criarAleatorio(Number(codigoCliente.slice(0, 8)) + 7);
  const fatorDaTabela = aleatorio.entre(0.9, 1.1);
  const comprados = new Set(ficha.produtos.map((produto) => produto.codigo));
  const sigla = siglaDe(ficha.nome);
  return {
    cliente: resumoDe(ficha),
    tabela: `Tabela ${aleatorio.inteiro(10, 40)} · ${ROTULOS_DE_MERCADO[ficha.mercado]}`,
    produtos: catalogoFicticio().map((produto) => {
      const jaComprou = comprados.has(produto.codigo);
      return {
        codigo: produto.codigo,
        familia: produto.familia,
        medida: produto.medida,
        embalagem: produto.embalagem,
        precoCento: Math.round(produto.precoBase * fatorDaTabela),
        codigoNoCliente: jaComprou && aleatorio.chance(0.6) ? `${sigla}-${aleatorio.inteiro(1_000, 9_999)}` : null,
        jaComprou,
      };
    }),
  };
}

export function painelDePedidosFicticio(): PainelDePedidos {
  garantirRascunhoDeExemplo();
  return {
    enviados: [...enviadosNaSessao, ...pedidosDeExemplo()],
    rascunhos: [...rascunhos.values()].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)),
    emAberto: pedidosNoErpFicticios(),
    faturados: notasFaturadasFicticias(),
  };
}

export function pedidoEnviadoFicticio(numero: string): PedidoEnviado | null {
  return [...enviadosNaSessao, ...pedidosDeExemplo()].find((pedido) => pedido.numero === numero) ?? null;
}

export function rascunhoFicticio(id: string): Rascunho | null {
  garantirRascunhoDeExemplo();
  return rascunhos.get(id) ?? null;
}

export function salvarRascunhoFicticio(dados: RascunhoParaSalvar): Rascunho | null {
  const catalogo = catalogoDoClienteFicticio(dados.codigoCliente);
  if (!catalogo) return null;
  const id = dados.id ?? `R${proximoRascunho++}`;
  const itens = dados.itens.filter((item) => item.quantidade > 0);
  const rascunho: Rascunho = {
    id,
    cliente: catalogo.cliente,
    itens,
    entrega: dados.entrega,
    observacao: dados.observacao,
    atualizadoEm: momentoEmBrasilia(),
    totalEstimado: totalDoPedido(linhasDe(itens, catalogo)),
  };
  rascunhos.set(id, rascunho);
  return rascunho;
}

export function excluirRascunhoFicticio(id: string): void {
  rascunhos.delete(id);
}

/** O rascunho vira pedido enviado, com número CRM; a partir daqui ninguém o altera no CRM. */
export function enviarRascunhoFicticio(id: string): PedidoEnviado | null {
  const rascunho = rascunhos.get(id);
  const catalogo = rascunho ? catalogoDoClienteFicticio(rascunho.cliente.codigo) : null;
  if (!rascunho || !catalogo) return null;
  const agora = momentoEmBrasilia();
  const pedido: PedidoEnviado = {
    numero: numeroCrm(proximoNumero++),
    cliente: rascunho.cliente,
    enviadoEm: agora,
    entrega: rascunho.entrega,
    observacao: rascunho.observacao,
    itens: itensEnviados(rascunho.itens, catalogo),
    totalEstimado: rascunho.totalEstimado,
    totalSgi: null,
    numeroSgi: null,
    numeroErp: null,
    etapa: "enviado",
    motivoRecusa: null,
    historico: [{ etapa: "enviado", em: agora }],
  };
  enviadosNaSessao.unshift(pedido);
  rascunhos.delete(id);
  return pedido;
}

// ---------------------------------------------------------------- exemplos

const EXEMPLOS: { numero: number; etapa: EtapaDoPedido; minutosAtras: number }[] = [
  { numero: 108, etapa: "enviado", minutosAtras: 25 },
  { numero: 107, etapa: "recebido", minutosAtras: 3 * 60 },
  { numero: 106, etapa: "em_aprovacao", minutosAtras: 26 * 60 },
  { numero: 105, etapa: "aprovado", minutosAtras: 2 * 24 * 60 },
  { numero: 104, etapa: "no_erp", minutosAtras: 4 * 24 * 60 },
  { numero: 103, etapa: "faturado_parcial", minutosAtras: 7 * 24 * 60 },
  { numero: 101, etapa: "recusado", minutosAtras: 9 * 24 * 60 },
  { numero: 102, etapa: "faturado", minutosAtras: 12 * 24 * 60 },
];

/** Minutos depois do envio em que o pedido chega a cada etapa, nos exemplos. */
const MINUTOS_ATE: Record<EtapaDoPedido, number> = {
  enviado: 0,
  recebido: 6,
  recusado: 6,
  em_aprovacao: 12,
  aprovado: 20 * 60,
  no_erp: 26 * 60,
  faturado_parcial: 3 * 24 * 60,
  faturado: 5 * 24 * 60,
  cancelado: 2 * 24 * 60,
};

const CAMINHOS: Record<EtapaDoPedido, EtapaDoPedido[]> = {
  enviado: ["enviado"],
  recebido: ["enviado", "recebido"],
  recusado: ["enviado", "recusado"],
  em_aprovacao: ["enviado", "recebido", "em_aprovacao"],
  aprovado: ["enviado", "recebido", "em_aprovacao", "aprovado"],
  no_erp: ["enviado", "recebido", "em_aprovacao", "aprovado", "no_erp"],
  faturado_parcial: ["enviado", "recebido", "em_aprovacao", "aprovado", "no_erp", "faturado_parcial"],
  faturado: ["enviado", "recebido", "em_aprovacao", "aprovado", "no_erp", "faturado"],
  cancelado: ["enviado", "recebido", "em_aprovacao", "cancelado"],
};

function pedidosDeExemplo(): PedidoEnviado[] {
  exemplosEmCache ??= gerarExemplos();
  return exemplosEmCache;
}

function gerarExemplos(): PedidoEnviado[] {
  const aleatorio = criarAleatorio(1_408);
  const ativos = clientesFicticios().filter((cliente) => cliente.situacao === "ativo" || cliente.situacao === "em_risco");
  const agora = Date.now();
  return EXEMPLOS.flatMap(({ numero, etapa, minutosAtras }, indice) => {
    const cliente = ativos[indice * 2];
    const catalogo = cliente ? catalogoDoClienteFicticio(cliente.codigo) : null;
    if (!catalogo) return [];
    const comprados = catalogo.produtos.filter((produto) => produto.jaComprou);
    const itens = comprados.slice(0, aleatorio.inteiro(2, 4)).map((produto) => ({
      codigo: produto.codigo,
      quantidade: produto.embalagem * aleatorio.inteiro(2, 20),
    }));
    const enviadoEm = agora - minutosAtras * 60_000;
    const caminho = CAMINHOS[etapa];
    const passou = (alvo: EtapaDoPedido) => caminho.includes(alvo);
    const totalEstimado = totalDoPedido(linhasDe(itens, catalogo));
    return [
      {
        numero: numeroCrm(numero),
        cliente: catalogo.cliente,
        enviadoEm: momentoEmBrasilia(new Date(enviadoEm)),
        entrega: null,
        observacao: "",
        itens: itensEnviados(itens, catalogo),
        totalEstimado,
        totalSgi: passou("em_aprovacao") ? Math.round(totalEstimado * aleatorio.entre(0.985, 1.025)) : null,
        numeroSgi: passou("recebido") ? String(aleatorio.inteiro(2_800_000, 2_899_999)) : null,
        numeroErp: passou("no_erp") ? String(aleatorio.inteiro(1_800_000, 1_850_000)) : null,
        etapa,
        motivoRecusa: etapa === "recusado" ? `O produto ${itens[0]?.codigo ?? ""} saiu de linha. Troque por outro e envie de novo.` : null,
        historico: caminho.map((passo) => ({ etapa: passo, em: momentoEmBrasilia(new Date(enviadoEm + MINUTOS_ATE[passo] * 60_000)) })),
      },
    ];
  });
}

function garantirRascunhoDeExemplo(): void {
  if (proximoRascunho > 1) return;
  const cliente = clientesFicticios().find((resumo) => resumo.situacao === "ativo");
  const catalogo = cliente ? catalogoDoClienteFicticio(cliente.codigo) : null;
  if (!catalogo) return;
  const itens = catalogo.produtos
    .filter((produto) => produto.jaComprou)
    .slice(0, 2)
    .map((produto) => ({ codigo: produto.codigo, quantidade: produto.embalagem * 4 }));
  salvarRascunhoFicticio({ id: null, codigoCliente: catalogo.cliente.codigo, itens, entrega: null, observacao: "" });
}

// ---------------------------------------------------------------- apoio

function linhasDe(itens: ItemDoPedido[], catalogo: CatalogoDoCliente) {
  return itens.flatMap((item) => {
    const produto = catalogo.produtos.find((candidato) => candidato.codigo === item.codigo);
    return produto ? [{ ...item, embalagem: produto.embalagem, precoCento: produto.precoCento }] : [];
  });
}

function itensEnviados(itens: ItemDoPedido[], catalogo: CatalogoDoCliente): ItemEnviado[] {
  return itens.flatMap((item) => {
    const produto = catalogo.produtos.find((candidato) => candidato.codigo === item.codigo);
    return produto ? [{ ...item, familia: produto.familia, medida: produto.medida, precoCento: produto.precoCento }] : [];
  });
}

function resumoDe(ficha: FichaCliente): ClienteResumo {
  const { codigo, codigoErp, nome, cidade, uf, mercado, situacao, ultimaCompra, faturamento12m, variacao12m, evolucao12m } = ficha;
  return { codigo, codigoErp, nome, cidade, uf, mercado, situacao, ultimaCompra, faturamento12m, variacao12m, evolucao12m };
}

function numeroCrm(numero: number): string {
  return `CRM-${String(numero).padStart(5, "0")}`;
}

/** "Retífica Três Lagoas" → "RTL" */
function siglaDe(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/\s+/)
    .map((palavra) => palavra.charAt(0).toUpperCase())
    .join("")
    .slice(0, 3);
}
