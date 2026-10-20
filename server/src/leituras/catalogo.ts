import type { DatabaseSync } from "node:sqlite";
import { podeReceberPedido, type StatusForaDeAtivo } from "dominio/statusDoCadastro";
import type { CatalogoDoCliente } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { COLUNAS_DO_RESUMO, escopo, lerLinhas, numero, numeroOuNulo, resumoDoCliente, texto, textoOuNulo } from "./linhas.ts";

/*
 * O catálogo do cliente para montar o pedido: os preços da lista dele, com a família, a medida, a
 * embalagem e os part numbers da Bíblia Montadora de cada produto e se o cliente já comprou. Só de
 * cliente da carteira do login; o cliente fora de ativo no cadastro não recebe pedido e não tem
 * catálogo. O grupo também não: o pedido é sempre de um CNPJ.
 */

/** Sem embalagem cadastrada (produto sem EAN), qualquer quantidade de peças. */
const EMBALAGEM_SEM_CADASTRO = 1;

export type ResultadoDoCatalogo = { catalogo: CatalogoDoCliente } | { foraDeAtivo: StatusForaDeAtivo } | null;

export function lerCatalogo(db: DatabaseSync, sessao: Sessao, codigoDoCliente: string): ResultadoDoCatalogo {
  const { marcas, codigos } = escopo(sessao);
  const [cliente] = lerLinhas(
    db,
    `SELECT ${COLUNAS_DO_RESUMO}, c.tabela_preco, c.lista_de_precos
       FROM cliente c WHERE c.cliente = ? AND c.cnpjs IS NULL AND c.representante IN (${marcas})`,
    [codigoDoCliente, ...codigos],
  );
  if (!cliente) return null;
  const resumo = resumoDoCliente(cliente);
  if (!podeReceberPedido(resumo.status)) return { foraDeAtivo: resumo.status };
  return {
    catalogo: {
      cliente: resumo,
      tabela: textoOuNulo(cliente, "tabela_preco") ?? "",
      produtos: lerProdutos(db, codigoDoCliente, numeroOuNulo(cliente, "lista_de_precos")),
    },
  };
}

function lerProdutos(db: DatabaseSync, codigoDoCliente: string, lista: number | null): CatalogoDoCliente["produtos"] {
  if (lista === null) return [];
  const partNumbers = partNumbersDaLista(db, lista);
  return lerLinhas(
    db,
    `SELECT l.produto, p.familia, p.medida, p.embalagem, l.preco_cento,
            EXISTS (SELECT 1 FROM produto_comprado j WHERE j.cliente = ? AND j.produto = l.produto) AS ja_comprou
       FROM lista_de_precos l JOIN produto p ON p.produto = l.produto
      WHERE l.lista = ?
      ORDER BY l.produto`,
    [codigoDoCliente, lista],
  ).map((linha) => ({
    codigo: texto(linha, "produto"),
    familia: texto(linha, "familia"),
    medida: textoOuNulo(linha, "medida"),
    embalagem: numeroOuNulo(linha, "embalagem") ?? EMBALAGEM_SEM_CADASTRO,
    precoCento: numero(linha, "preco_cento"),
    partNumbers: partNumbers.get(texto(linha, "produto")) ?? [],
    jaComprou: numero(linha, "ja_comprou") === 1,
  }));
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
