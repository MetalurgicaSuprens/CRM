import { analisesFicticias, clientesFicticios, fichaFicticia, painelFicticio, situacaoDosDadosFicticia } from "./ficticio";
import type { FonteDeDados } from "./fonteDeDados";
import {
  catalogoDoClienteFicticio,
  enviarRascunhoFicticio,
  excluirRascunhoFicticio,
  painelDePedidosFicticio,
  pedidoEnviadoFicticio,
  rascunhoFicticio,
  salvarRascunhoFicticio,
} from "./pedidosFicticios";

/** O protótipo (F1): a carteira fictícia, sem servidor. Os rascunhos ficam só na memória do navegador. */
export const fonteFicticia: FonteDeDados = {
  carregarSituacaoDosDados: () => Promise.resolve(situacaoDosDadosFicticia()),
  carregarPainel: () => Promise.resolve(painelFicticio()),
  carregarClientes: () => Promise.resolve(clientesFicticios()),
  carregarFicha: (codigo) => Promise.resolve(fichaFicticia(codigo)),
  carregarAnalises: () => Promise.resolve(analisesFicticias()),
  carregarCatalogo: (codigoCliente) => Promise.resolve(catalogoDoClienteFicticio(codigoCliente)),
  carregarPedidos: () => Promise.resolve(painelDePedidosFicticio()),
  carregarPedidoEnviado: (numero) => Promise.resolve(pedidoEnviadoFicticio(numero)),
  carregarRascunho: (id) => Promise.resolve(rascunhoFicticio(id)),
  salvarRascunho(dados) {
    const rascunho = salvarRascunhoFicticio(dados);
    return rascunho ? Promise.resolve(rascunho) : Promise.reject(new Error("Cliente fora da carteira"));
  },
  excluirRascunho(id) {
    excluirRascunhoFicticio(id);
    return Promise.resolve();
  },
  enviarPedido(idDoRascunho) {
    const pedido = enviarRascunhoFicticio(idDoRascunho);
    return pedido ? Promise.resolve(pedido) : Promise.reject(new Error("Rascunho não encontrado"));
  },
};
