import type { Foto } from "dominio/esquemaDaFoto";
import type { PartNumberDaTabela, PartNumberUsado } from "../erp/tipos.ts";
import { agruparPor } from "./agrupar.ts";

/*
 * O part number com que o item do pedido nasce, por cliente e produto (decisões do Lucas em 2026-11-23).
 * Nos 12 meses até então, sem montadora: o part number da tabela própria do cliente foi mantido em 99,97%
 * dos itens, e o da tabela geral PDR02 foi trocado ou apagado em 43%. O app antigo preenchia o da tabela,
 * qualquer que fosse, e o representante nem sempre o apagava.
 */

/** As tabelas de preço gerais, de muitos clientes: o part number delas não é de cliente nenhum. */
export const TABELAS_GERAIS: readonly string[] = ["PDR01", "PDR02", "EXPOR"];

export type PartNumbersDoItem = { opcoes: string[]; sugerido: string | null };

/**
 * Os part numbers de um produto para um cliente, e o que o item já traz:
 * - o da tabela própria, quando ela tem um só;
 * - com mais de um na tabela, o último que o cliente usou entre eles; sem ele, nenhum, e o representante escolhe;
 * - sem part number na tabela, o último que o cliente usou.
 * `daTabela` já vem sem as tabelas gerais, e `ultimoUsado`, sem os números delas.
 */
export function partNumbersDoItem(daTabela: readonly string[], ultimoUsado: string | null): PartNumbersDoItem {
  const opcoes = [...new Set(ultimoUsado === null ? daTabela : [...daTabela, ultimoUsado])];
  if (daTabela.length === 0) return { opcoes, sugerido: ultimoUsado };
  if (daTabela.length === 1) return { opcoes, sugerido: daTabela[0] ?? null };
  return { opcoes, sugerido: ultimoUsado !== null && daTabela.includes(ultimoUsado) ? ultimoUsado : null };
}

/** Um cliente do catálogo: a tabela de preço escolhida para ele e os produtos da lista dele. */
export type ClienteDosPartNumbers = { id: string; chave: string; tabela: string; produtos: ReadonlySet<string> };

/** As linhas de `cliente_part_number`: só dos produtos da lista de cada cliente. */
export function montarPartNumbersDosClientes(
  clientes: readonly ClienteDosPartNumbers[],
  dados: { daTabela: readonly PartNumberDaTabela[]; usados: readonly PartNumberUsado[] },
): Foto["cliente_part_number"] {
  const porTabela = agruparPor(
    dados.daTabela.filter(({ tabela }) => !TABELAS_GERAIS.includes(tabela)),
    ({ tabela }) => tabela,
  );
  const usadosPorCliente = agruparPor(dados.usados, ({ chave }) => chave);
  return clientes.flatMap(({ id, chave, tabela, produtos }) => {
    const daTabela = agruparPor(porTabela.get(tabela) ?? [], ({ produto }) => produto);
    const usados = new Map((usadosPorCliente.get(chave) ?? []).map(({ produto, partNumber }) => [produto, partNumber]));
    const comPartNumber = [...new Set([...daTabela.keys(), ...usados.keys()])].filter((produto) => produtos.has(produto)).sort();
    return comPartNumber.flatMap((produto) => {
      const { opcoes, sugerido } = partNumbersDoItem(
        (daTabela.get(produto) ?? []).map(({ partNumber }) => partNumber),
        usados.get(produto) ?? null,
      );
      return opcoes.map((partNumber) => ({ cliente: id, produto, part_number: partNumber, is_sugerido: partNumber === sugerido ? 1 : 0 }));
    });
  });
}
