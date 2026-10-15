import { AVISO_DE_PEDIDO_BLOQUEADO, podeReceberPedido } from "dominio/statusDoCadastro";
import { analisesFicticias, clientesFicticios, fichaFicticia, painelFicticio, situacaoDosDadosFicticia } from "./ficticio";
import { PedidoBloqueado, type FonteDeDados } from "./fonteDeDados";
import {
  catalogoDoClienteFicticio,
  enviarRascunhoFicticio,
  excluirRascunhoFicticio,
  painelDePedidosFicticio,
  pedidoEnviadoFicticio,
  pedidosDoCrmNaFicha,
  rascunhoFicticio,
  salvarRascunhoFicticio,
} from "./pedidosFicticios";

/** O protótipo (F1): a carteira fictícia, sem servidor. Os rascunhos ficam só na memória do navegador. */
export const fonteFicticia: FonteDeDados = {
  carregarSituacaoDosDados: () => Promise.resolve(situacaoDosDadosFicticia()),
  carregarPainel: () => Promise.resolve(painelFicticio()),
  carregarClientes: () => Promise.resolve(clientesFicticios()),
  carregarFicha(codigo) {
    const ficha = fichaFicticia(codigo);
    return Promise.resolve(ficha && { ...ficha, pedidos: [...pedidosDoCrmNaFicha(codigo), ...ficha.pedidos] });
  },
  carregarAnalises: () => Promise.resolve(analisesFicticias()),
  carregarCatalogo(codigoCliente) {
    const catalogo = catalogoDoClienteFicticio(codigoCliente);
    if (catalogo && !podeReceberPedido(catalogo.cliente.status)) {
      return Promise.reject(new PedidoBloqueado(AVISO_DE_PEDIDO_BLOQUEADO[catalogo.cliente.status]));
    }
    return Promise.resolve(catalogo);
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
