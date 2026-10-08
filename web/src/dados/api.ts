import { analisesFicticias, clientesFicticios, fichaFicticia, painelFicticio, situacaoDosDadosFicticia } from "./ficticio";
import type { Analises, ClienteResumo, FichaCliente, PainelInicio, SituacaoDosDados } from "./tipos";

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
