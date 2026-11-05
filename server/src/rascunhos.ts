import type { DatabaseSync } from "node:sqlite";
import { dataDoMomento, isDataDeVerdade, momentoEmBrasilia } from "dominio/datas";
import { arredondarAoCentavo, totalDoPedido, valorDaLinha } from "dominio/pedido";
import { AVISO_DE_PEDIDO_BLOQUEADO } from "dominio/statusDoCadastro";
import type { ClienteResumo, ItemDoPedido, PedidoDaFicha, Rascunho, RascunhoParaSalvar } from "../../web/src/dados/tipos.ts";
import { emTransacao } from "./bancoDoApp.ts";
import { clienteDoPedido } from "./leituras/catalogo.ts";
import { lerResumoNaCarteira } from "./leituras/clientes.ts";
import { lerLinhas, numero, texto, textoOuNulo } from "./leituras/linhas.ts";
import type { Sessao } from "./sessao.ts";

/*
 * Os rascunhos de pedido, no app.db (docs/dados-por-tela.md, "O que fica no app.db"): de um login,
 * para um CNPJ da carteira dele (o id opaco da foto), com os itens em peças e o preço do cento que vai
 * no pedido. A tela salva sozinha enquanto o pedido é montado, e o rascunho sobrevive a fechar o
 * navegador ou desligar o computador (pedido do Lucas em 2026-11-05). O nome do cliente, a família e o
 * total vêm da foto na leitura: o app.db não guarda nome de cliente. O rascunho de cliente que saiu da
 * carteira some, como a ficha.
 */

/** Itens num rascunho: o catálogo de um cliente tem umas 800 linhas, e um pedido de verdade, bem menos. */
export const LIMITE_DE_ITENS = 300;
/** Rascunhos guardados por login: acima disso, é enviar ou descartar algum. */
export const LIMITE_DE_RASCUNHOS = 100;

export type ConteudoDoRascunho = Omit<RascunhoParaSalvar, "id">;
export type RecusaDoRascunho = { status: 400 | 404 | 409; erro: string };

const NAO_ENCONTRADO: RecusaDoRascunho = { status: 404, erro: "Rascunho não encontrado." };
const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Cria ou atualiza o rascunho com o id que a tela gerou: o mesmo id, salvo de novo, nunca duplica.
 * O id de outro login responde como se não existisse.
 */
export function salvarRascunho(
  banco: DatabaseSync,
  foto: DatabaseSync,
  sessao: Sessao,
  id: string,
  conteudo: ConteudoDoRascunho,
  agora: Date,
): { rascunho: Rascunho; criado: boolean } | RecusaDoRascunho {
  const cliente = clienteDoPedido(foto, sessao, conteudo.codigoCliente);
  if (!cliente) return { status: 404, erro: "Cliente não encontrado na sua carteira." };
  if ("foraDeAtivo" in cliente) return { status: 409, erro: AVISO_DE_PEDIDO_BLOQUEADO[cliente.foraDeAtivo] };
  const problema = problemaNosItens(foto, cliente.lista, conteudo.itens) ?? problemaNaEntrega(conteudo.entrega);
  if (problema) return { status: 400, erro: problema };
  const existente = banco.prepare("SELECT usuario, cliente FROM rascunhos WHERE id = ?").get(id);
  if (existente && String(existente.usuario) !== sessao.idDoUsuario) return NAO_ENCONTRADO;
  if (existente && String(existente.cliente) !== conteudo.codigoCliente) return { status: 409, erro: "Este rascunho é de outro cliente." };
  if (!existente && conteudo.itens.length === 0) return { status: 400, erro: "O rascunho começa com pelo menos um produto." };
  if (!existente && quantosRascunhos(banco, sessao) >= LIMITE_DE_RASCUNHOS) {
    return { status: 409, erro: `Você já tem ${LIMITE_DE_RASCUNHOS} rascunhos. Envie ou descarte algum para começar outro.` };
  }
  gravar(banco, sessao, id, conteudo, momentoEmBrasilia(agora));
  const rascunho = lerRascunho(banco, foto, sessao, id);
  if (!rascunho) throw new Error("O rascunho gravado não voltou na leitura.");
  return { rascunho, criado: !existente };
}

/** O rascunho do login, com o cliente da foto; null se não existe, é de outro login ou o cliente saiu da carteira. */
export function lerRascunho(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, id: string): Rascunho | null {
  const linha = banco.prepare("SELECT id, cliente, entrega, observacao, atualizado_em FROM rascunhos WHERE id = ? AND usuario = ?").get(id, sessao.idDoUsuario);
  return linha ? montarRascunho(banco, foto, sessao, linha) : null;
}

/** Os rascunhos do login, do salvo por último ao mais antigo: a aba Rascunhos de Pedidos. */
export function rascunhosDoLogin(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao): Rascunho[] {
  return banco
    .prepare("SELECT id, cliente, entrega, observacao, atualizado_em FROM rascunhos WHERE usuario = ? ORDER BY atualizado_em DESC")
    .all(sessao.idDoUsuario)
    .flatMap((linha) => montarRascunho(banco, foto, sessao, linha) ?? []);
}

/**
 * Os rascunhos do login como linhas do histórico da ficha: os do cliente ou, na ficha do grupo, os de
 * todos os CNPJs dele, cada um com o seu CNPJ.
 */
export function rascunhosNaFicha(
  banco: DatabaseSync,
  foto: DatabaseSync,
  sessao: Sessao,
  ficha: { codigo: string; cnpjs: readonly ClienteResumo[] | null },
): PedidoDaFicha[] {
  const codigos = new Set(ficha.cnpjs ? ficha.cnpjs.map(({ codigo }) => codigo) : [ficha.codigo]);
  return rascunhosDoLogin(banco, foto, sessao)
    .filter((rascunho) => codigos.has(rascunho.cliente.codigo))
    .map((rascunho) => ({
      id: rascunho.id,
      cnpj: ficha.cnpjs ? { codigo: rascunho.cliente.codigo, nome: rascunho.cliente.nome } : null,
      numero: null,
      status: "rascunho",
      emissao: dataDoMomento(rascunho.atualizadoEm),
      entrega: rascunho.entrega,
      itens: itensNaFicha(foto, rascunho.itens),
      valor: rascunho.totalEstimado,
    }));
}

/** Descarta o rascunho do login e devolve o cliente dele, para a auditoria; null se não havia. */
export function excluirRascunho(banco: DatabaseSync, sessao: Sessao, id: string): string | null {
  const linha = banco.prepare("SELECT cliente FROM rascunhos WHERE id = ? AND usuario = ?").get(id, sessao.idDoUsuario);
  if (!linha) return null;
  banco.prepare("DELETE FROM rascunhos WHERE id = ? AND usuario = ?").run(id, sessao.idDoUsuario);
  return String(linha.cliente);
}

/** O produto tem de estar na lista do cliente, uma vez só, e o preço não fica abaixo da tabela dele. */
function problemaNosItens(foto: DatabaseSync, lista: number | null, itens: readonly ItemDoPedido[]): string | null {
  const codigos = itens.map(({ codigo }) => codigo);
  if (new Set(codigos).size !== codigos.length) return "O mesmo produto veio duas vezes no pedido.";
  if (itens.length === 0) return null;
  const precosDaTabela = new Map(
    lerLinhas(foto, `SELECT produto, preco_cento FROM lista_de_precos WHERE lista = ? AND produto IN (${codigos.map(() => "?").join(", ")})`, [
      lista ?? -1,
      ...codigos,
    ]).map((linha) => [texto(linha, "produto"), numero(linha, "preco_cento")]),
  );
  for (const item of itens) {
    const minimo = precosDaTabela.get(item.codigo);
    if (minimo === undefined) return `O produto ${item.codigo} não está no catálogo deste cliente.`;
    if (emCentavos(item.precoCento) < emCentavos(minimo)) return `O preço do cento de ${item.codigo} está abaixo da tabela do cliente, ${REAIS.format(minimo)}.`;
  }
  return null;
}

/** A entrega desejada fica como pedida; só não pode ser uma data que não existe. */
function problemaNaEntrega(entrega: string | null): string | null {
  return entrega === null || isDataDeVerdade(entrega) ? null : "Essa data de entrega não existe.";
}

function quantosRascunhos(banco: DatabaseSync, sessao: Sessao): number {
  return Number(banco.prepare("SELECT COUNT(*) AS quantos FROM rascunhos WHERE usuario = ?").get(sessao.idDoUsuario)?.quantos ?? 0);
}

/** O rascunho e os itens, de uma vez: os itens são trocados inteiros a cada salvamento. */
function gravar(banco: DatabaseSync, sessao: Sessao, id: string, conteudo: ConteudoDoRascunho, momento: string): void {
  emTransacao(banco, () => {
    banco
      .prepare(
        `INSERT INTO rascunhos (id, usuario, cliente, entrega, observacao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET entrega = excluded.entrega, observacao = excluded.observacao, atualizado_em = excluded.atualizado_em`,
      )
      .run(id, sessao.idDoUsuario, conteudo.codigoCliente, conteudo.entrega, conteudo.observacao, momento, momento);
    banco.prepare("DELETE FROM rascunho_itens WHERE rascunho = ?").run(id);
    const inserir = banco.prepare("INSERT INTO rascunho_itens (rascunho, ordem, produto, quantidade, preco_cento) VALUES (?, ?, ?, ?, ?)");
    conteudo.itens.forEach((item, i) => inserir.run(id, i + 1, item.codigo, item.quantidade, arredondarAoCentavo(item.precoCento)));
  });
}

function montarRascunho(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, linha: Record<string, unknown>): Rascunho | null {
  const cliente = lerResumoNaCarteira(foto, sessao, String(linha.cliente));
  if (!cliente) return null;
  const id = String(linha.id);
  const itens = banco
    .prepare("SELECT produto, quantidade, preco_cento FROM rascunho_itens WHERE rascunho = ? ORDER BY ordem")
    .all(id)
    .map((item) => ({ codigo: String(item.produto), quantidade: Number(item.quantidade), precoCento: Number(item.preco_cento) }));
  return {
    id,
    cliente,
    itens,
    entrega: linha.entrega === null ? null : String(linha.entrega),
    observacao: String(linha.observacao),
    atualizadoEm: String(linha.atualizado_em),
    totalEstimado: totalDoPedido(itens),
  };
}

/** Os itens do rascunho como os do ERP na ficha: a família vem da foto, e o valor é o do preço do item. */
function itensNaFicha(foto: DatabaseSync, itens: readonly ItemDoPedido[]): PedidoDaFicha["itens"] {
  if (itens.length === 0) return [];
  const familias = new Map(
    lerLinhas(foto, `SELECT produto, familia FROM produto WHERE produto IN (${itens.map(() => "?").join(", ")})`, itens.map(({ codigo }) => codigo)).map(
      (linha) => [texto(linha, "produto"), textoOuNulo(linha, "familia")],
    ),
  );
  return itens.map((item, i) => ({
    ordem: i + 1,
    codigo: item.codigo,
    familia: familias.get(item.codigo) ?? "",
    pecas: item.quantidade,
    valor: valorDaLinha(item),
    entrega: null,
  }));
}

function emCentavos(valor: number): number {
  return Math.round(valor * 100);
}
