import type { DatabaseSync } from "node:sqlite";
import { AVISO_DE_PEDIDO_BLOQUEADO, AVISO_DE_SEM_TABELA, podeReceberPedido } from "dominio/statusDoCadastro";
import type { CatalogoDoCliente, ClienteResumo, ProdutoDoCatalogo } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { lerResumoNaCarteira } from "./clientes.ts";
import { lerDadosDoPedido } from "./dadosDoPedido.ts";
import { lerLinhas, numero, numeroOuNulo, texto, textoOuNulo, type Linha } from "./linhas.ts";

/*
 * O catálogo do cliente para montar o pedido: os preços da lista dele, com a família, a medida, a
 * embalagem e os part numbers da Bíblia Montadora de cada produto, e a última compra do cliente, que
 * dá o preço com que o item entra no pedido. Só de cliente da carteira do login; o cliente fora de
 * ativo no cadastro não recebe pedido e não tem catálogo. O grupo também não: o pedido é sempre de um CNPJ.
 */

/** Sem embalagem cadastrada (produto sem EAN), qualquer quantidade de peças. */
const EMBALAGEM_SEM_CADASTRO = 1;

/** O cliente que é do login mas não recebe pedido: o aviso para a tela, com o motivo. */
export type PedidoBloqueado = { bloqueado: string };

export type ResultadoDoCatalogo = { catalogo: CatalogoDoCliente } | PedidoBloqueado | null;

/** O CNPJ que recebe pedido, com a tabela de preço e a lista de preços dele na foto. */
export type ClienteDoPedido = { resumo: ClienteResumo; tabela: string; lista: number | null };

export function lerCatalogo(db: DatabaseSync, sessao: Sessao, codigoDoCliente: string): ResultadoDoCatalogo {
  const cliente = clienteDoPedido(db, sessao, codigoDoCliente);
  if (!cliente || "bloqueado" in cliente) return cliente;
  const produtos = lerProdutos(db, codigoDoCliente, cliente.lista);
  const dadosDoPedido = lerDadosDoPedido(db, sessao, cliente.resumo, produtos.map(({ codigo }) => codigo));
  return { catalogo: { cliente: cliente.resumo, tabela: cliente.tabela, produtos, dadosDoPedido, representante: representanteDoCliente(db, codigoDoCliente) } };
}

/** O dono do cliente no ERP, com o nome do cadastro de representantes da foto. */
function representanteDoCliente(db: DatabaseSync, codigoDoCliente: string): CatalogoDoCliente["representante"] {
  const [linha] = lerLinhas(db, "SELECT r.codigo, r.nome FROM cliente c JOIN representante r ON r.codigo = c.representante WHERE c.cliente = ?", [codigoDoCliente]);
  return linha ? { codigo: texto(linha, "codigo"), nome: texto(linha, "nome") } : null;
}

/**
 * O cliente do pedido, no catálogo e na cotação: um CNPJ da carteira do login (fora dela e no grupo,
 * null) que esteja ativo no cadastro e tenha a tabela de preço principal (senão, o aviso com o motivo).
 */
export function clienteDoPedido(db: DatabaseSync, sessao: Sessao, codigoDoCliente: string): ClienteDoPedido | PedidoBloqueado | null {
  const resumo = lerResumoNaCarteira(db, sessao, codigoDoCliente);
  if (!resumo) return null;
  if (!podeReceberPedido(resumo.status)) return { bloqueado: AVISO_DE_PEDIDO_BLOQUEADO[resumo.status] };
  const [linha = {}] = lerLinhas(db, "SELECT c.tabela_preco, c.lista_de_precos FROM cliente c WHERE c.cliente = ?", [codigoDoCliente]);
  const lista = numeroOuNulo(linha, "lista_de_precos");
  if (lista === null) return { bloqueado: AVISO_DE_SEM_TABELA };
  return { resumo, tabela: textoOuNulo(linha, "tabela_preco") ?? "", lista };
}

function lerProdutos(db: DatabaseSync, codigoDoCliente: string, lista: number | null): CatalogoDoCliente["produtos"] {
  if (lista === null) return [];
  const partNumbers = partNumbersDaLista(db, lista);
  return lerLinhas(
    db,
    `SELECT l.produto, p.familia, p.medida, p.embalagem, p.peso_kg, l.preco_cento, l.part_numbers,
            j.produto IS NOT NULL AS ja_comprou, j.ultima_compra, j.preco_cento_na_ultima
       FROM lista_de_precos l JOIN produto p ON p.produto = l.produto
       LEFT JOIN produto_comprado j ON j.cliente = ? AND j.produto = l.produto
      WHERE l.lista = ?
      ORDER BY l.produto`,
    [codigoDoCliente, lista],
  ).map((linha) => ({
    codigo: texto(linha, "produto"),
    familia: texto(linha, "familia"),
    medida: textoOuNulo(linha, "medida"),
    embalagem: numeroOuNulo(linha, "embalagem") ?? EMBALAGEM_SEM_CADASTRO,
    precoDaTabela: numero(linha, "preco_cento"),
    ultimaCompra: ultimaCompraDa(linha),
    partNumbers: partNumbers.get(texto(linha, "produto")) ?? [],
    partNumbersDoCliente: textoOuNulo(linha, "part_numbers"),
    pesoKg: numeroOuNulo(linha, "peso_kg"),
    jaComprou: numero(linha, "ja_comprou") === 1,
  }));
}

/** A última compra com preço; sem ela (não comprou, ou só bonificação), null. */
function ultimaCompraDa(linha: Linha): ProdutoDoCatalogo["ultimaCompra"] {
  const data = textoOuNulo(linha, "ultima_compra");
  const precoCento = numeroOuNulo(linha, "preco_cento_na_ultima");
  return data !== null && precoCento !== null ? { precoCento, data } : null;
}

/** Os part numbers de cada produto da lista, em ordem. */
function partNumbersDaLista(db: DatabaseSync, lista: number): Map<string, string[]> {
  const porProduto = new Map<string, string[]>();
  const linhas = lerLinhas(
    db,
    `SELECT b.produto, b.part_number FROM produto_part_number b
      WHERE b.produto IN (SELECT l.produto FROM lista_de_precos l WHERE l.lista = ?)
      ORDER BY b.produto, b.part_number`,
    [lista],
  );
  for (const linha of linhas) {
    const produto = texto(linha, "produto");
    porProduto.set(produto, [...(porProduto.get(produto) ?? []), texto(linha, "part_number")]);
  }
  return porProduto;
}
