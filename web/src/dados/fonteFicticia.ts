import { AVISO_DE_PEDIDO_BLOQUEADO, AVISO_DE_SEM_TABELA, podeReceberPedido } from "dominio/statusDoCadastro";
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

/** Tempo que o protótipo finge esperar o aparelho liberar a chave de acesso no envio. */
const ESPERA_DA_CHAVE_MS = 1_200;

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
    if (catalogo && catalogo.tabela === "") return Promise.reject(new PedidoBloqueado(AVISO_DE_SEM_TABELA));
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
  async enviarPedido(idDoRascunho) {
    await new Promise((resolver) => window.setTimeout(resolver, ESPERA_DA_CHAVE_MS));
    const pedido = enviarRascunhoFicticio(idDoRascunho);
    if (!pedido) throw new Error("Cotação não encontrada");
    return pedido;
  },
  carregarVisitas: () => Promise.resolve(Object.fromEntries([...visitasFicticias].flatMap(([codigo, [ultima]]) => (ultima ? [[codigo, ultima]] : [])))),
  registrarVisita: (codigo) => mudarVisitaFicticia(codigo, (datas) => [...new Set([situacaoDosDadosFicticia().hoje, ...datas])]),
  desfazerVisita: (codigo, data) => mudarVisitaFicticia(codigo, (datas) => datas.filter((outra) => outra !== data)),
};
