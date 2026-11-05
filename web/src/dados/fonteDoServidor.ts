import { PedidoBloqueado, type FonteDeDados } from "./fonteDeDados";
import { irParaAEntrada, mensagemDeErro } from "./http";

/*
 * Os dados reais: a API do servidor, que lê a foto do ERP (server/src/rotas.ts). Mesma origem,
 * sem CORS; o representante vem da sessão, nunca daqui. Os rascunhos ficam no app.db do servidor;
 * o envio do pedido ao ERP chega na F5.
 */

const ENVIO_AINDA_NAO = "Com os dados reais, o envio do pedido ao ERP chega na F5. O rascunho está salvo em Pedidos, na aba Rascunhos.";

export const fonteDoServidor: FonteDeDados = {
  carregarSituacaoDosDados: () => buscar("/api/situacao"),
  carregarPainel: () => buscar("/api/painel"),
  carregarClientes: () => buscar("/api/clientes"),
  carregarFicha: (codigo) => buscarOuNulo(`/api/clientes/${encodeURIComponent(codigo)}`),
  carregarAnalises: () => buscar("/api/analises"),
  carregarCatalogo: (codigoCliente) => buscarOuNulo(`/api/clientes/${encodeURIComponent(codigoCliente)}/catalogo`),
  carregarPedidos: () => buscar("/api/pedidos"),
  carregarPedidoEnviado: () => Promise.resolve(null),
  carregarRascunho: (id) => buscarOuNulo(`/api/rascunhos/${encodeURIComponent(id)}`),
  salvarRascunho: ({ id, ...conteudo }, opcoes) => gravar("PUT", `/api/rascunhos/${encodeURIComponent(id)}`, conteudo, opcoes?.aoSairDaPagina),
  excluirRascunho: (id) => gravar("DELETE", `/api/rascunhos/${encodeURIComponent(id)}`),
  enviarPedido: () => Promise.reject(new Error(ENVIO_AINDA_NAO)),
  carregarVisitas: () => buscar("/api/visitas"),
  registrarVisita: (codigo) => mudarVisita("POST", codigo, {}),
  desfazerVisita: (codigo, data) => mudarVisita("DELETE", codigo, { data }),
};

/** O servidor confere que o cliente é da carteira e a data, e devolve as visitas dele. */
async function mudarVisita(metodo: "POST" | "DELETE", codigo: string, corpo: { data?: string }): Promise<string[]> {
  return (await gravar<{ visitas: string[] }>(metodo, `/api/clientes/${encodeURIComponent(codigo)}/visitas`, corpo)).visitas;
}

/**
 * O pedido que muda algo no servidor. Sem corpo, vai sem Content-Type. `manterAoSair` deixa o
 * navegador terminar o envio depois de a página fechar (keepalive).
 */
async function gravar<T>(metodo: "POST" | "PUT" | "DELETE", caminho: string, corpo?: object, manterAoSair = false): Promise<T> {
  const resposta = await fetch(caminho, {
    method: metodo,
    headers: corpo ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    keepalive: manterAoSair,
  });
  if (resposta.status === 401) return irParaAEntrada(resposta);
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return (resposta.status === 204 ? undefined : await resposta.json()) as T;
}

async function buscar<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho, { headers: { Accept: "application/json" } });
  if (resposta.status === 401) return irParaAEntrada(resposta);
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return (await resposta.json()) as T;
}

/**
 * 404 (e o código fora do formato, 400) é "não encontrado": a tela mostra o aviso dela. 409 é o
 * cliente da carteira que não recebe pedido, e a mensagem do servidor é o aviso.
 */
async function buscarOuNulo<T>(caminho: string): Promise<T | null> {
  const resposta = await fetch(caminho, { headers: { Accept: "application/json" } });
  if (resposta.status === 401) return irParaAEntrada(resposta);
  if (resposta.status === 404 || resposta.status === 400) return null;
  if (resposta.status === 409) throw new PedidoBloqueado(await mensagemDeErro(resposta));
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return (await resposta.json()) as T;
}
