import type { FonteDeDados } from "./fonteDeDados";
import { fonteDoServidor } from "./fonteDoServidor";
import { fonteFicticia } from "./fonteFicticia";

/*
 * Única porta de entrada dos dados nas telas. No modo "real" (npm run dev:real), os dados vêm do
 * servidor, com a foto do ERP, como no "rede-interna"; nos outros, da carteira fictícia do protótipo.
 */

export const isDadosReais = import.meta.env.MODE === "real" || import.meta.env.MODE === "rede-interna";
/** O CRM de teste na rede interna (iniciar-crm-servidor.bat): dados reais, com o login provisório por senha. */
export const isRedeInterna = import.meta.env.MODE === "rede-interna";

const fonte: FonteDeDados = isDadosReais ? fonteDoServidor : fonteFicticia;

export const {
  carregarSituacaoDosDados,
  carregarPainel,
  carregarClientes,
  carregarFicha,
  carregarAnalises,
  carregarCatalogo,
  carregarPedidos,
  carregarPedidoEnviado,
  carregarRascunho,
  salvarRascunho,
  excluirRascunho,
  enviarPedido,
  carregarVisitas,
  registrarVisita,
  desfazerVisita,
} = fonte;
