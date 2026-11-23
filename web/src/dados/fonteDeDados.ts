import type {
  Analises,
  CatalogoDoCliente,
  ClienteResumo,
  FichaCliente,
  PainelDePedidos,
  PainelInicio,
  PedidoEnviado,
  Cotacao,
  CotacaoParaSalvar,
  SituacaoDosDados,
  UltimasVisitas,
} from "./tipos";

/**
 * Recusa do catálogo do cliente que está na carteira, mas fora de ativo no cadastro
 * (dominio/statusDoCadastro.ts). A mensagem é o aviso que a montagem do pedido mostra.
 */
export class PedidoBloqueado extends Error {}

/** Ao fechar a página ou ela sair da tela: o navegador termina de mandar a cotação mesmo depois de ela sair. */
export type OpcoesDoSalvamento = { aoSairDaPagina?: boolean };

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
  carregarCotacao(id: string): Promise<Cotacao | null>;
  salvarCotacao(dados: CotacaoParaSalvar, opcoes?: OpcoesDoSalvamento): Promise<Cotacao>;
  excluirCotacao(id: string): Promise<void>;
  /** O envio leva junto a confirmação da chave de acesso, ligada ao conteúdo do pedido. */
  enviarPedido(idDoCotacao: string): Promise<PedidoEnviado>;
  carregarVisitas(): Promise<UltimasVisitas>;
  /** Marca a visita de hoje e devolve as visitas do cliente, da mais recente à mais antiga. */
  registrarVisita(codigoCliente: string): Promise<string[]>;
  desfazerVisita(codigoCliente: string, data: string): Promise<string[]>;
};
