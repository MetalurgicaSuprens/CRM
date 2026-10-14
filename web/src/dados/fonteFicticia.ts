import { AVISO_DE_CLIENTE_NEGATIVO } from "dominio/clienteNegativo";
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
  carregarCatalogo(codigoCliente) {
    const catalogo = catalogoDoClienteFicticio(codigoCliente);
    // O cliente negativo não recebe pedido: a montagem mostra o aviso no lugar do catálogo.
    return catalogo?.cliente.isNegativo ? Promise.reject(new Error(AVISO_DE_CLIENTE_NEGATIVO)) : Promise.resolve(catalogo);
  },
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
