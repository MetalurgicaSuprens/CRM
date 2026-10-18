import type { FonteDeDados } from "./fonteDeDados";
import { fonteDoServidor } from "./fonteDoServidor";
import { fonteFicticia } from "./fonteFicticia";

/*
 * Única porta de entrada dos dados nas telas. No modo "real" (npm run dev:real), os dados vêm do
 * servidor, com a foto do ERP; nos outros, da carteira fictícia do protótipo.
 */

export const isDadosReais = import.meta.env.MODE === "real";

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
