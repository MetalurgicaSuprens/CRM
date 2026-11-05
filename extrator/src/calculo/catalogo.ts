import type { Foto } from "dominio/esquemaDaFoto";
import type { Mercado } from "dominio/tipos";
import type { ClienteDaCarteira, DadosDoErp, PartNumberDaBiblia, PrecoDoCliente, ProdutoDaTabela, TabelaDoCliente } from "../erp/tipos.ts";
import { agruparPor } from "./agrupar.ts";
import { SEM_FAMILIA } from "./produtos.ts";

/*
 * O catálogo de cada cliente da carteira: a tabela escolhida e os preços dela. Clientes com a mesma
 * tabela e os mesmos descontos têm preços iguais e dividem uma lista, para o catálogo não se repetir
 * cliente a cliente na foto. O part number é do produto, o mesmo em toda lista: vem da Bíblia Montadora.
 */

/** O nome da tabela de preço do cliente e a lista dele em `lista_de_precos`. */
export type TabelaEListaDoCliente = { tabela: string; lista: number };

export type CatalogoDosClientes = Pick<Foto, "lista_de_precos" | "produto_comprado" | "produto_part_number"> & {
  /** Id do cliente → tabela e lista dele. Cliente sem tabela usável fica de fora. */
  porCliente: Map<string, TabelaEListaDoCliente>;
  /** Os produtos de alguma lista, com medida e embalagem. */
  produtos: Foto["produto"];
};

type ClienteDoCatalogo = { id: string; cliente: ClienteDaCarteira };

type DadosDoCatalogo = Pick<DadosDoErp, "tabelas" | "precos" | "partNumbers" | "produtosDasTabelas" | "jaComprados">;

const MEDIDA = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * A tabela de preço do cliente. Só em real, porque a tela mostra R$; na montadora, só a ativa, como
 * o SGI exige. Entre essas, a principal; sem ela, a que não é secundária; sem essa, a que sobrar.
 */
export function escolherTabela(tabelas: readonly TabelaDoCliente[], mercado: Mercado): TabelaDoCliente | null {
  const usaveis = tabelas
    .filter((tabela) => tabela.moeda === "REAL" && (mercado !== "MONTADORA" || tabela.situacao === "ATIVO"))
    .sort((a, b) => a.tabela.localeCompare(b.tabela));
  return usaveis.find((t) => t.papel === "PRINCIPAL") ?? usaveis.find((t) => t.papel !== "SECUNDARIA") ?? usaveis[0] ?? null;
}

export function montarCatalogo(clientes: readonly ClienteDoCatalogo[], dados: DadosDoCatalogo): CatalogoDosClientes {
  const { porCliente, linhas } = montarListas(clientes, dados);
  const produtosDasListas = new Set(linhas.map((linha) => linha.produto));
  return {
    porCliente,
    lista_de_precos: linhas,
    produto_comprado: produtosComprados(clientes, porCliente, linhas, dados.jaComprados),
    produto_part_number: partNumbersDosProdutos(dados.partNumbers, produtosDasListas),
    produtos: dados.produtosDasTabelas.filter(({ produto }) => produtosDasListas.has(produto)).map(linhaDoProduto),
  };
}

/** "14–22 mm"; sem as duas medidas, nenhuma (kits, molas e outras famílias sem faixa de aperto). */
export function formatarMedida(minimaMm: number | null, maximaMm: number | null): string | null {
  return minimaMm && maximaMm ? `${MEDIDA.format(minimaMm)}–${MEDIDA.format(maximaMm)} mm` : null;
}

function montarListas(clientes: readonly ClienteDoCatalogo[], dados: DadosDoCatalogo) {
  const tabelasPorCliente = agruparPor(dados.tabelas, (tabela) => String(tabela.cliente));
  const precosPorTabela = agruparPor(dados.precos, (preco) => `${preco.cliente}/${preco.tabela}`);
  const listaPorAssinatura = new Map<string, number>();
  const porCliente = new Map<string, TabelaEListaDoCliente>();
  const linhas: Foto["lista_de_precos"] = [];
  for (const { id, cliente } of [...clientes].sort((a, b) => a.id.localeCompare(b.id))) {
    const tabela = escolherTabela(tabelasPorCliente.get(String(cliente.cliente)) ?? [], cliente.mercado);
    const precos = tabela ? (precosPorTabela.get(`${cliente.cliente}/${tabela.tabela}`) ?? []) : [];
    if (!tabela || precos.length === 0) continue;
    const ordenados = [...precos].sort((a, b) => a.produto.localeCompare(b.produto));
    const assinatura = assinaturaDosPrecos(ordenados);
    let lista = listaPorAssinatura.get(assinatura);
    if (lista === undefined) {
      lista = listaPorAssinatura.size + 1;
      listaPorAssinatura.set(assinatura, lista);
      for (const { produto, precoCento } of ordenados) linhas.push({ lista, produto, preco_cento: precoCento });
    }
    porCliente.set(id, { tabela: tabela.nome ?? tabela.tabela, lista });
  }
  return { porCliente, linhas };
}

function assinaturaDosPrecos(precos: readonly PrecoDoCliente[]): string {
  return precos.map(({ produto, precoCento }) => `${produto}=${precoCento}`).join("|");
}

/** Os part numbers da Bíblia só dos produtos de alguma lista: a foto não leva o resto. */
function partNumbersDosProdutos(partNumbers: readonly PartNumberDaBiblia[], produtos: ReadonlySet<string>): Foto["produto_part_number"] {
  const unicos = new Map<string, Foto["produto_part_number"][number]>();
  for (const { produto, partNumber } of partNumbers) {
    if (produtos.has(produto)) unicos.set(JSON.stringify([produto, partNumber]), { produto, part_number: partNumber });
  }
  return [...unicos.values()].sort((a, b) => a.produto.localeCompare(b.produto) || a.part_number.localeCompare(b.part_number));
}

/** Só os produtos comprados que estão na lista do cliente: são eles que a aba "Já comprados" mostra. */
function produtosComprados(
  clientes: readonly ClienteDoCatalogo[],
  porCliente: CatalogoDosClientes["porCliente"],
  linhas: Foto["lista_de_precos"],
  jaComprados: DadosDoCatalogo["jaComprados"],
): Foto["produto_comprado"] {
  const produtosPorLista = new Map<number, Set<string>>();
  for (const { lista, produto } of linhas) {
    produtosPorLista.set(lista, (produtosPorLista.get(lista) ?? new Set()).add(produto));
  }
  const compradosPorChave = agruparPor(jaComprados, (comprado) => comprado.chave);
  return clientes.flatMap(({ id, cliente }) => {
    const produtosDaLista = produtosPorLista.get(porCliente.get(id)?.lista ?? 0);
    if (!produtosDaLista) return [];
    return (compradosPorChave.get(cliente.chave) ?? [])
      .filter(({ produto }) => produtosDaLista.has(produto))
      .map(({ produto, ultimaCompra }) => ({
        cliente: id,
        produto,
        ultima_compra: ultimaCompra?.data ?? null,
        preco_cento_na_ultima: ultimaCompra?.precoCento ?? null,
      }));
  });
}

function linhaDoProduto(produto: ProdutoDaTabela): Foto["produto"][number] {
  return {
    produto: produto.produto,
    familia: produto.familia ?? SEM_FAMILIA,
    medida: formatarMedida(produto.medidaMinimaMm, produto.medidaMaximaMm),
    embalagem: produto.embalagem === null ? null : Math.round(produto.embalagem),
  };
}
