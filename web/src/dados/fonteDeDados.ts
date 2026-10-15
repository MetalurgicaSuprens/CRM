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

/**
 * Recusa do catálogo do cliente que está na carteira, mas fora de ativo no cadastro
 * (dominio/statusDoCadastro.ts). A mensagem é o aviso que a montagem do pedido mostra.
 */
export class PedidoBloqueado extends Error {}

/** O que as telas pedem, venha dos dados fictícios (fonteFicticia) ou do servidor (fonteDoServidor). */
export type FonteDeDados = {
  carregarSituacaoDosDados(): Promise<SituacaoDosDados>;
  carregarPainel(): Promise<PainelInicio>;
  carregarClientes(): Promise<ClienteResumo[]>;
  carregarFicha(codigo: string): Promise<FichaCliente | null>;
  carregarAnalises(): Promise<Analises>;
  carregarCatalogo(codigoCliente: string): Promise<CatalogoDoCliente | null>;
  carregarPedidos(): Promise<PainelDePedidos>;
  carregarPedidoEnviado(numero: string): Promise<PedidoEnviado | null>;
  carregarRascunho(id: string): Promise<Rascunho | null>;
  salvarRascunho(dados: RascunhoParaSalvar): Promise<Rascunho>;
  excluirRascunho(id: string): Promise<void>;
  /** Na F5, o envio leva junto a confirmação da chave de acesso, ligada ao conteúdo do pedido. */
  enviarPedido(idDoRascunho: string): Promise<PedidoEnviado>;
};
