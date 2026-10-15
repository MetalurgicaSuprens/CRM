import { PedidoBloqueado, type FonteDeDados } from "./fonteDeDados";

/*
 * Os dados reais: a API do servidor, que lê a foto do ERP (server/src/rotas.ts). Mesma origem,
 * sem CORS; o representante vem da sessão, nunca daqui.
 * Rascunhos e envio chegam nas próximas fases (app.db na F3 e F5).
 */

const AINDA_SEM_PEDIDOS = "Com os dados reais, os pedidos ainda não são gravados. Isso chega com o login (F3) e os pedidos (F5).";

export const fonteDoServidor: FonteDeDados = {
  carregarSituacaoDosDados: () => buscar("/api/situacao"),
  carregarPainel: () => buscar("/api/painel"),
  carregarClientes: () => buscar("/api/clientes"),
  carregarFicha: (codigo) => buscarOuNulo(`/api/clientes/${encodeURIComponent(codigo)}`),
  carregarAnalises: () => buscar("/api/analises"),
  carregarCatalogo: (codigoCliente) => buscarOuNulo(`/api/clientes/${encodeURIComponent(codigoCliente)}/catalogo`),
  carregarPedidos: () => buscar("/api/pedidos"),
  carregarPedidoEnviado: () => Promise.resolve(null),
  carregarRascunho: () => Promise.resolve(null),
  salvarRascunho: () => Promise.reject(new Error(AINDA_SEM_PEDIDOS)),
  excluirRascunho: () => Promise.reject(new Error(AINDA_SEM_PEDIDOS)),
  enviarPedido: () => Promise.reject(new Error(AINDA_SEM_PEDIDOS)),
};

async function buscar<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho, { headers: { Accept: "application/json" } });
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return (await resposta.json()) as T;
}

/**
 * 404 (e o código fora do formato, 400) é "não encontrado": a tela mostra o aviso dela. 409 é o
 * cliente da carteira que não recebe pedido, e a mensagem do servidor é o aviso.
 */
async function buscarOuNulo<T>(caminho: string): Promise<T | null> {
  const resposta = await fetch(caminho, { headers: { Accept: "application/json" } });
  if (resposta.status === 404 || resposta.status === 400) return null;
  if (resposta.status === 409) throw new PedidoBloqueado(await mensagemDeErro(resposta));
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return (await resposta.json()) as T;
}

async function mensagemDeErro(resposta: Response): Promise<string> {
  const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
  return corpo?.erro ?? `O servidor respondeu ${resposta.status}.`;
}
