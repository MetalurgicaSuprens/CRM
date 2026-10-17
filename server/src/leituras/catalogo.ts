import type { DatabaseSync } from "node:sqlite";
import { podeReceberPedido, type StatusForaDeAtivo } from "dominio/statusDoCadastro";
import type { CatalogoDoCliente } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { COLUNAS_DO_RESUMO, escopo, lerLinhas, numero, numeroOuNulo, resumoDoCliente, texto, textoOuNulo } from "./linhas.ts";

/*
 * O catálogo do cliente para montar o pedido: os preços da lista dele, com a família, a medida e a
 * embalagem de cada produto e se o cliente já comprou. Só de cliente da carteira do login; o
 * cliente fora de ativo no cadastro não recebe pedido e não tem catálogo. O grupo também não: o
 * pedido é sempre de um CNPJ.
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
  return lerLinhas(
    db,
    `SELECT l.produto, p.familia, p.medida, p.embalagem, l.preco_cento, l.part_number,
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
    partNumber: textoOuNulo(linha, "part_number"),
    jaComprou: numero(linha, "ja_comprou") === 1,
  }));
}
