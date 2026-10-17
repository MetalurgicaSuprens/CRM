import type { ClienteNoMix } from "dominio/mix";
import type { ClienteDaCarteira, DatasDeCompra, FamiliaDoCliente, ProdutoDoCliente, VendaDoMes } from "../erp/tipos.ts";
import { agruparPor } from "./agrupar.ts";

/*
 * Os grupos do SGI na carteira: os clientes com o mesmo texto no campo Grupo do cadastro
 * (erp/carteira.ts), digitado ou não. Duas empresas sem relação com o mesmo nome fantasia também
 * viram um grupo, e quem as separa é o cadastro do SGI (decisão do Lucas em 2026-10-17). O grupo
 * existe dentro da carteira de cada representante: os CNPJs dele que estão com outro representante
 * são clientes de outra carteira e ficam de fora (CLAUDE.md, regra 4). Com um CNPJ só na carteira,
 * não há grupo, e o cliente aparece sozinho, como os outros.
 */

/** As compras de um cliente, ou as de todos os CNPJs de um grupo somadas: o que as regras analisam. */
export type Compras = {
  datas: DatasDeCompra;
  /** Faturado e peças por mês, na janela de 36 meses. */
  vendas: VendaDoMes[];
  /** Faturado por família nos 24 meses fechados. */
  familias: FamiliaDoCliente[];
  /** Os produtos dos 12 meses fechados. */
  produtos: ProdutoDoCliente[];
  temPedidoEmAberto: boolean;
  /** O cliente como a regra de mix o compara com os parecidos de toda a Suprens. */
  noMix: ClienteNoMix;
};

export type GrupoNaCarteira<T> = { nome: string; representante: string; membros: T[] };

/** Os grupos com dois ou mais CNPJs na carteira do mesmo representante, na ordem da carteira. */
export function formarGrupos<T extends { cliente: ClienteDaCarteira }>(clientes: readonly T[]): GrupoNaCarteira<T>[] {
  const porGrupo = agruparPor(
    clientes.filter(({ cliente }) => cliente.grupo !== null),
    ({ cliente }) => `${cliente.representante}/${cliente.grupo}`,
  );
  return [...porGrupo.values()].flatMap(([primeiro, ...outros]) =>
    primeiro?.cliente.grupo && outros.length > 0
      ? [{ nome: primeiro.cliente.grupo, representante: primeiro.cliente.representante, membros: [primeiro, ...outros] }]
      : [],
  );
}

/** As compras dos CNPJs de um grupo somadas, como se fossem de um cliente só, com o código do grupo. */
export function juntarCompras(codigo: string, compras: readonly Compras[]): Compras {
  return {
    datas: juntarDatas(compras.map(({ datas }) => datas)),
    vendas: somarVendas(codigo, compras.flatMap(({ vendas }) => vendas)),
    familias: compras.flatMap(({ familias }) => familias.map((familia) => ({ ...familia, chave: codigo }))),
    produtos: somarProdutos(codigo, compras.flatMap(({ produtos }) => produtos)),
    temPedidoEmAberto: compras.some(({ temPedidoEmAberto }) => temPedidoEmAberto),
    noMix: juntarNoMix(codigo, compras.map(({ noMix }) => noMix)),
  };
}

/** A primeira compra de todas, a última antes da janela e os dias com nota de qualquer CNPJ. */
function juntarDatas(datas: readonly DatasDeCompra[]): DatasDeCompra {
  const antesDaJanela = datas.flatMap(({ ultimaAntesDaJanela }) => (ultimaAntesDaJanela ? [ultimaAntesDaJanela] : []));
  return {
    primeiraCompra: datas.map(({ primeiraCompra }) => primeiraCompra).reduce(maisAntiga),
    ultimaAntesDaJanela: antesDaJanela.length > 0 ? antesDaJanela.reduce(maisRecente) : null,
    datas: [...new Set(datas.flatMap((doCnpj) => doCnpj.datas))].sort(),
  };
}

function somarVendas(codigo: string, vendas: readonly VendaDoMes[]): VendaDoMes[] {
  return [...agruparPor(vendas, ({ mes }) => mes).entries()].map(([mes, doMes]) => ({
    chave: codigo,
    mes,
    valor: somar(doMes.map(({ valor }) => valor)),
    pecas: somar(doMes.map(({ pecas }) => pecas)),
  }));
}

function somarProdutos(codigo: string, produtos: readonly ProdutoDoCliente[]): ProdutoDoCliente[] {
  return [...agruparPor(produtos, ({ produto }) => produto).entries()].map(([produto, doProduto]) => ({
    chave: codigo,
    produto,
    familia: doProduto.find(({ familia }) => familia !== null)?.familia ?? null,
    pecas: somar(doProduto.map(({ pecas }) => pecas)),
    valor: somar(doProduto.map(({ valor }) => valor)),
    ultimaCompra: doProduto.map(({ ultimaCompra }) => ultimaCompra).reduce(maisRecente),
  }));
}

/** O mercado do grupo é o do CNPJ que mais fatura; as famílias, as de qualquer um deles. */
function juntarNoMix(codigo: string, clientes: readonly ClienteNoMix[]): ClienteNoMix {
  const principal = clientes.reduce((maior, cliente) => (cliente.faturamento12m > maior.faturamento12m ? cliente : maior));
  return {
    codigo,
    mercado: principal.mercado,
    faturamento12m: somar(clientes.map(({ faturamento12m }) => faturamento12m)),
    familias12m: new Set(clientes.flatMap(({ familias12m }) => [...familias12m])),
    familias24m: new Set(clientes.flatMap(({ familias24m }) => [...familias24m])),
  };
}

function maisAntiga(a: string, b: string): string {
  return b < a ? b : a;
}

function maisRecente(a: string, b: string): string {
  return b > a ? b : a;
}

function somar(valores: readonly number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}
