import { analisesFicticias, clientesFicticios, fichaFicticia, painelFicticio, situacaoDosDadosFicticia } from "./ficticio";
import {
  catalogoDoClienteFicticio,
  enviarRascunhoFicticio,
  excluirRascunhoFicticio,
  painelDePedidosFicticio,
  pedidoEnviadoFicticio,
  rascunhoFicticio,
  salvarRascunhoFicticio,
} from "./pedidosFicticios";
import type {
  Analises,
  CatalogoDoCliente,
  ClienteResumo,
  FichaCliente,
  PainelDePedidos,
  PainelInicio,
  PedidoEnviado,
  Rascunho,
  RascunhoParaSalvar,
  SituacaoDosDados,
} from "./tipos";

/*
 * Única porta de entrada dos dados nas telas.
 * F1 (protótipo): devolve a carteira fictícia. A partir da F3, chama a API do servidor.
 */

export function carregarSituacaoDosDados(): Promise<SituacaoDosDados> {
  return Promise.resolve(situacaoDosDadosFicticia());
}

export function carregarPainel(): Promise<PainelInicio> {
  return Promise.resolve(painelFicticio());
}

export function carregarClientes(): Promise<ClienteResumo[]> {
  return Promise.resolve(clientesFicticios());
}

export function carregarFicha(codigo: string): Promise<FichaCliente | null> {
  return Promise.resolve(fichaFicticia(codigo));
}

export function carregarAnalises(): Promise<Analises> {
  return Promise.resolve(analisesFicticias());
}

// ---------------------------------------------------------------- pedidos

export function carregarCatalogo(codigoCliente: string): Promise<CatalogoDoCliente | null> {
  return Promise.resolve(catalogoDoClienteFicticio(codigoCliente));
}

export function carregarPedidos(): Promise<PainelDePedidos> {
  return Promise.resolve(painelDePedidosFicticio());
}

export function carregarPedidoEnviado(numero: string): Promise<PedidoEnviado | null> {
  return Promise.resolve(pedidoEnviadoFicticio(numero));
}

export function carregarRascunho(id: string): Promise<Rascunho | null> {
  return Promise.resolve(rascunhoFicticio(id));
}

export function salvarRascunho(dados: RascunhoParaSalvar): Promise<Rascunho> {
  const rascunho = salvarRascunhoFicticio(dados);
  return rascunho ? Promise.resolve(rascunho) : Promise.reject(new Error("Cliente fora da carteira"));
}

export function excluirRascunho(id: string): Promise<void> {
  excluirRascunhoFicticio(id);
  return Promise.resolve();
}

/** Na F5, o envio leva junto a confirmação da chave de acesso, ligada ao conteúdo do pedido. */
export function enviarPedido(idDoRascunho: string): Promise<PedidoEnviado> {
  const pedido = enviarRascunhoFicticio(idDoRascunho);
  return pedido ? Promise.resolve(pedido) : Promise.reject(new Error("Rascunho não encontrado"));
}
