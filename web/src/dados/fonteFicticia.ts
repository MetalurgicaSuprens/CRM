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

/** As visitas do protótipo, de cada cliente, da mais recente à mais antiga: só na memória, como os rascunhos. */
const visitasFicticias = new Map<string, string[]>();

function mudarVisitaFicticia(codigo: string, mudar: (datas: string[]) => string[]): Promise<string[]> {
  const datas = mudar(visitasFicticias.get(codigo) ?? []).sort().reverse();
  visitasFicticias.set(codigo, datas);
  return Promise.resolve(datas);
}

/** O protótipo (F1): a carteira fictícia, sem servidor. Os rascunhos e as visitas ficam só na memória do navegador. */
export const fonteFicticia: FonteDeDados = {
  carregarSituacaoDosDados: () => Promise.resolve(situacaoDosDadosFicticia()),
  carregarPainel: () => Promise.resolve(painelFicticio()),
  carregarClientes: () => Promise.resolve(clientesFicticios()),
  carregarFicha(codigo) {
    const ficha = fichaFicticia(codigo);
    return Promise.resolve(ficha && { ...ficha, pedidos: [...pedidosDoCrmNaFicha(codigo), ...ficha.pedidos], visitas: visitasFicticias.get(codigo) ?? [] });
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
  carregarVisitas: () => Promise.resolve(Object.fromEntries([...visitasFicticias].flatMap(([codigo, [ultima]]) => (ultima ? [[codigo, ultima]] : [])))),
  registrarVisita: (codigo) => mudarVisitaFicticia(codigo, (datas) => [...new Set([situacaoDosDadosFicticia().hoje, ...datas])]),
  desfazerVisita: (codigo, data) => mudarVisitaFicticia(codigo, (datas) => datas.filter((outra) => outra !== data)),
};
