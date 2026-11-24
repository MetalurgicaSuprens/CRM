import type { DatabaseSync } from "node:sqlite";
import { dataDoMomento, isDataDeVerdade, momentoEmBrasilia } from "dominio/datas";
import { arredondarAoCentavo, totalDoPedido, valorDaLinha } from "dominio/pedido";
import type { ClienteResumo, EscolhasDoPedido, ItemDoPedido, PedidoDaFicha, Cotacao, CotacaoParaSalvar } from "../../web/src/dados/tipos.ts";
import { emTransacao } from "./bancoDoApp.ts";
import { clienteDoPedido } from "./leituras/catalogo.ts";
import { lerResumoNaCarteira } from "./leituras/clientes.ts";
import { lerLinhas, numero, texto, textoOuNulo } from "./leituras/linhas.ts";
import type { Sessao } from "./sessao.ts";

/*
 * As cotações de pedido, no app.db (docs/dados-por-tela.md, "O que fica no app.db"): de um login,
 * para um CNPJ da carteira dele (o id opaco da foto), com os itens em peças e o preço do cento que vai
 * no pedido. A tela salva sozinha enquanto o pedido é montado, e a cotação sobrevive a fechar o
 * navegador ou desligar o computador (pedido do Lucas em 2026-11-05). O nome do cliente, a família e o
 * total vêm da foto na leitura: o app.db não guarda nome de cliente. A cotação de cliente que saiu da
 * carteira some, como a ficha.
 */

/** Itens numa cotação: o catálogo de um cliente tem umas 800 linhas, e um pedido de verdade, bem menos. */
export const LIMITE_DE_ITENS = 300;
/** Cotações guardadas por login: acima disso, é enviar ou descartar alguma. */
export const LIMITE_DE_COTACOES = 100;

/** As escolhas são opcionais no corpo: a tela aberta antes de 2026-11-17 não as manda. */
export type ConteudoDoCotacao = Omit<CotacaoParaSalvar, "id" | "escolhas"> & { escolhas?: EscolhasDoPedido | null };
export type RecusaDoCotacao = { status: 400 | 404 | 409; erro: string };

const NAO_ENCONTRADO: RecusaDoCotacao = { status: 404, erro: "Cotação não encontrada." };
const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Cria ou atualiza a cotação com o id que a tela gerou: o mesmo id, salvo de novo, nunca duplica.
 * O id de outro login responde como se não existisse.
 */
export function salvarCotacao(
  banco: DatabaseSync,
  foto: DatabaseSync,
  sessao: Sessao,
  id: string,
  conteudo: ConteudoDoCotacao,
  agora: Date,
): { cotacao: Cotacao; criado: boolean } | RecusaDoCotacao {
  const recusa = recusaDoConteudo(foto, sessao, conteudo);
  if (recusa) return recusa;
  // O salvamento automático que chega depois do envio não ressuscita a cotação.
  if (banco.prepare("SELECT 1 FROM pedidos_enviados WHERE cotacao = ?").get(id)) return { status: 409, erro: "Este pedido já foi enviado." };
  const existente = banco.prepare("SELECT usuario, cliente FROM cotacoes WHERE id = ?").get(id);
  if (existente && String(existente.usuario) !== sessao.idDoUsuario) return NAO_ENCONTRADO;
  if (existente && String(existente.cliente) !== conteudo.codigoCliente) return { status: 409, erro: "Esta cotação é de outro cliente." };
  if (!existente && conteudo.itens.length === 0) return { status: 400, erro: "A cotação começa com pelo menos um produto." };
  if (!existente && quantosCotacoes(banco, sessao) >= LIMITE_DE_COTACOES) {
    return { status: 409, erro: `Você já tem ${LIMITE_DE_COTACOES} cotações. Envie ou descarte alguma para começar outra.` };
  }
  gravar(banco, sessao, id, conteudo, momentoEmBrasilia(agora));
  const cotacao = lerCotacao(banco, foto, sessao, id);
  if (!cotacao) throw new Error("A cotação gravada não voltou na leitura.");
  return { cotacao, criado: !existente };
}

/**
 * O que a foto de agora diz do pedido, ao salvar e de novo ao enviar: o cliente é da carteira e está
 * ativo, os produtos são do catálogo dele, sem preço abaixo da tabela, e a data de entrega existe.
 */
export function recusaDoConteudo(
  foto: DatabaseSync,
  sessao: Sessao,
  conteudo: Pick<ConteudoDoCotacao, "codigoCliente" | "itens" | "entrega">,
): RecusaDoCotacao | null {
  const cliente = clienteDoPedido(foto, sessao, conteudo.codigoCliente);
  if (!cliente) return { status: 404, erro: "Cliente não encontrado na sua carteira." };
  if ("bloqueado" in cliente) return { status: 409, erro: cliente.bloqueado };
  const problema = problemaNosItens(foto, cliente.lista, conteudo.itens) ?? problemaNaEntrega(conteudo.entrega);
  return problema ? { status: 400, erro: problema } : null;
}

/** A cotação do login, com o cliente da foto; null se não existe, é de outro login ou o cliente saiu da carteira. */
export function lerCotacao(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, id: string): Cotacao | null {
  const linha = banco.prepare("SELECT id, cliente, entrega, observacao, escolhas, atualizado_em FROM cotacoes WHERE id = ? AND usuario = ?").get(id, sessao.idDoUsuario);
  return linha ? montarCotacao(banco, foto, sessao, linha) : null;
}

/** As cotações do login, do salvo por último ao mais antigo: a aba Cotações de Pedidos. */
export function cotacoesDoLogin(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao): Cotacao[] {
  return banco
    .prepare("SELECT id, cliente, entrega, observacao, escolhas, atualizado_em FROM cotacoes WHERE usuario = ? ORDER BY atualizado_em DESC")
    .all(sessao.idDoUsuario)
    .flatMap((linha) => montarCotacao(banco, foto, sessao, linha) ?? []);
}

/**
 * As cotações do login como linhas do histórico da ficha: as do cliente ou, na ficha do grupo, as de
 * todos os CNPJs dele, cada um com o seu CNPJ.
 */
export function cotacoesNaFicha(
  banco: DatabaseSync,
  foto: DatabaseSync,
  sessao: Sessao,
  ficha: { codigo: string; cnpjs: readonly ClienteResumo[] | null },
): PedidoDaFicha[] {
  const codigos = new Set(ficha.cnpjs ? ficha.cnpjs.map(({ codigo }) => codigo) : [ficha.codigo]);
  return cotacoesDoLogin(banco, foto, sessao)
    .filter((cotacao) => codigos.has(cotacao.cliente.codigo))
    .map((cotacao) => ({
      id: cotacao.id,
      cnpj: ficha.cnpjs ? { codigo: cotacao.cliente.codigo, nome: cotacao.cliente.nome } : null,
      numero: null,
      status: "cotacao",
      emissao: dataDoMomento(cotacao.atualizadoEm),
      entrega: cotacao.entrega,
      itens: itensNaFicha(foto, cotacao.itens),
      valor: cotacao.totalEstimado,
      valorComIpi: null,
      cfop: null,
      notas: [],
    }));
}

/** Descarta a cotação do login e devolve o cliente dele, para a auditoria; null se não havia. */
export function excluirCotacao(banco: DatabaseSync, sessao: Sessao, id: string): string | null {
  const linha = banco.prepare("SELECT cliente FROM cotacoes WHERE id = ? AND usuario = ?").get(id, sessao.idDoUsuario);
  if (!linha) return null;
  banco.prepare("DELETE FROM cotacoes WHERE id = ? AND usuario = ?").run(id, sessao.idDoUsuario);
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

function quantosCotacoes(banco: DatabaseSync, sessao: Sessao): number {
  return Number(banco.prepare("SELECT COUNT(*) AS quantos FROM cotacoes WHERE usuario = ?").get(sessao.idDoUsuario)?.quantos ?? 0);
}

/** A cotação e os itens, de uma vez: os itens são trocados inteiros a cada salvamento. */
function gravar(banco: DatabaseSync, sessao: Sessao, id: string, conteudo: ConteudoDoCotacao, momento: string): void {
  emTransacao(banco, () => {
    banco
      .prepare(
        `INSERT INTO cotacoes (id, usuario, cliente, entrega, observacao, escolhas, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET entrega = excluded.entrega, observacao = excluded.observacao, escolhas = excluded.escolhas,
                                        atualizado_em = excluded.atualizado_em`,
      )
      .run(id, sessao.idDoUsuario, conteudo.codigoCliente, conteudo.entrega, conteudo.observacao, conteudo.escolhas ? JSON.stringify(conteudo.escolhas) : null, momento, momento);
    banco.prepare("DELETE FROM cotacao_itens WHERE cotacao = ?").run(id);
    const inserir = banco.prepare(
      `INSERT INTO cotacao_itens (cotacao, ordem, produto, quantidade, preco_cento, ordem_de_compra, item_da_ordem_de_compra, part_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    conteudo.itens.forEach((item, i) =>
      inserir.run(id, i + 1, item.codigo, item.quantidade, arredondarAoCentavo(item.precoCento), item.ordemDeCompra, item.itemDaOrdemDeCompra, item.partNumber),
    );
  });
}

function montarCotacao(banco: DatabaseSync, foto: DatabaseSync, sessao: Sessao, linha: Record<string, unknown>): Cotacao | null {
  const cliente = lerResumoNaCarteira(foto, sessao, String(linha.cliente));
  if (!cliente) return null;
  const id = String(linha.id);
  const itens = banco
    .prepare("SELECT produto, quantidade, preco_cento, ordem_de_compra, item_da_ordem_de_compra, part_number FROM cotacao_itens WHERE cotacao = ? ORDER BY ordem")
    .all(id)
    .map((item) => ({
      codigo: String(item.produto),
      quantidade: Number(item.quantidade),
      precoCento: Number(item.preco_cento),
      ordemDeCompra: item.ordem_de_compra === null ? null : String(item.ordem_de_compra),
      itemDaOrdemDeCompra: item.item_da_ordem_de_compra === null ? null : Number(item.item_da_ordem_de_compra),
      partNumber: item.part_number === null ? null : String(item.part_number),
    }));
  return {
    id,
    cliente,
    itens,
    entrega: linha.entrega === null ? null : String(linha.entrega),
    observacao: String(linha.observacao),
    // A cotação salva antes da marca xPed (2026-11-23) não a tem: sem ela, o cliente não exige.
    escolhas: linha.escolhas === null ? null : { clienteXped: false, ...(JSON.parse(String(linha.escolhas)) as Partial<EscolhasDoPedido>) } as EscolhasDoPedido,
    atualizadoEm: String(linha.atualizado_em),
    totalEstimado: totalDoPedido(itens),
  };
}

/** Os itens da cotação como os do ERP na ficha: a família vem da foto, e o valor é o do preço do item. */
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
