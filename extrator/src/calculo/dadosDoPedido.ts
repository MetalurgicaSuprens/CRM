import type { Foto } from "dominio/esquemaDaFoto";
import type { CadastroDoErp, DadosDoPedidoDoErp, EscolhasDoErp, PrecoDoCliente, TransportadoraDoErp } from "../erp/tipos.ts";
import { cepDoErp } from "../localizacao/endereco.ts";

/*
 * As tabelas da tela de pedido na foto: o cadastro que o representante confere, as listas de
 * transportadoras e de condições e o histórico de escolhas de cada cliente. Só dos clientes da carteira,
 * pelo id: a chave do ERP não sai da LAN.
 */

export type TabelasDoPedido = Pick<
  Foto,
  | "cliente_cadastro"
  | "cliente_local"
  | "cliente_escolha"
  | "ultimo_pedido_item"
  | "transportadora"
  | "representante_transportadora"
  | "condicao_pagamento"
  | "produto_ipi"
>;

/**
 * O nome que o representante reconhece. O código da retirada no ERP tem o nome soletrado ("R E T I R A -"):
 * fica "Cliente retira", como o SGI6R trata (frete do código 78499999: 'S', sem frete).
 */
const NOMES_FIXOS: Readonly<Record<string, string>> = { "78499999": "Cliente retira" };

export const CLASSIFICACOES: Readonly<Record<string, string>> = {
  COMERCIALIZACAO: "comercializacao",
  INDUSTRIALIZACAO: "industrializacao",
  "USO/CONSUMO": "uso_consumo",
};

const FRETE_PARCIAL: Readonly<Record<string, string>> = { "ACEITA FRETE PARCIAL": "sim", "NAO ACEITA FRETE PARCIAL": "nao" };

export function montarTabelasDoPedido(
  dados: DadosDoPedidoDoErp,
  precos: readonly PrecoDoCliente[],
  produtosDasListas: ReadonlySet<string>,
  idNaCarteira: (chave: string) => string | null,
): TabelasDoPedido {
  const ultimoPedidoEm = new Map(dados.ultimosPedidos.map((item) => [item.chave, item.dia]));
  return {
    cliente_cadastro: dados.cadastros.flatMap((cadastro) => {
      const id = idNaCarteira(cadastro.chave);
      return id ? [linhaDoCadastro(id, cadastro, ultimoPedidoEm.get(cadastro.chave) ?? null)] : [];
    }),
    cliente_local: dados.locais.flatMap((local) => {
      const id = idNaCarteira(local.chave);
      if (!id) return [];
      const { razaoSocial, documento, endereco, bairro, cidade, uf, cep, tipo, inscricaoEstadual } = local;

      return [{ cliente: id, tipo, razao_social: razaoSocial, documento: formatarDocumento(documento), inscricao_estadual: inscricaoEstadual, endereco, bairro, cidade, uf, cep: cepDoErp(cep) }];
    }),
    cliente_escolha: somarEscolhas(dados.escolhas, idNaCarteira),
    ultimo_pedido_item: dados.ultimosPedidos.flatMap((item, i, todos) => {
      const id = idNaCarteira(item.chave);
      const ordem = todos.slice(0, i).filter((anterior) => anterior.chave === item.chave).length + 1;
      return id && item.pecas > 0 ? [{ cliente: id, ordem, produto: item.produto, pecas: item.pecas }] : [];
    }),
    transportadora: [...dados.transportadoras.map((transportadora) => linhaDaTransportadora(transportadora, 1)), ...dados.transportadorasInativas.map((transportadora) => linhaDaTransportadora(transportadora, 0))],
    representante_transportadora: dados.transportadorasDosRepresentantes.map(({ representante, transportadora, pedidos }) => ({ representante, transportadora, pedidos })),
    condicao_pagamento: [...new Map(dados.condicoes.map((condicao) => [condicao.codigo, condicao])).values()]
      .filter((condicao) => condicao.descricao)
      .map(({ codigo, descricao }) => ({ codigo, descricao })),
    produto_ipi: aliquotasDosProdutos(precos, produtosDasListas),
  };
}

function linhaDoCadastro(id: string, cadastro: CadastroDoErp, ultimoPedidoEm: string | null): Foto["cliente_cadastro"][number] {
  return {
    cliente: id,
    documento: formatarDocumento(cadastro.documento, cadastro.isPessoaFisica),
    inscricao_estadual: cadastro.inscricaoEstadual,
    suframa: cadastro.suframa,
    telefone: formatarTelefone(cadastro.ddd, cadastro.telefone),
    email_xml: cadastro.emailDoXml?.toLowerCase() ?? null,
    endereco: cadastro.endereco === null ? null : semEspacosSobrando(cadastro.endereco),
    bairro: cadastro.bairro === null ? null : semEspacosSobrando(cadastro.bairro),
    cep: cepDoErp(cadastro.cep),
    condicao_pagamento: cadastro.condicaoDePagamento,
    base_ipi: cadastro.isBaseDoIpi ? 1 : 0,
    ultimo_pedido_em: ultimoPedidoEm,
  };
}

function linhaDaTransportadora(transportadora: TransportadoraDoErp, isAtiva: number): Foto["transportadora"][number] {
  return {
    codigo: transportadora.codigo,
    nome: nomeDaTransportadora(transportadora),
    razao_social: transportadora.razaoSocial,
    cnpj: formatarDocumento(transportadora.documento),
    endereco: transportadora.endereco,
    bairro: transportadora.bairro,
    cep: cepDoErp(transportadora.cep),
    cidade: transportadora.cidade,
    uf: transportadora.uf,
    is_ativa: isAtiva,
  };
}

/** O nome que as telas mostram: o fantasia ou, sem ele, a razão social; o código de "cliente retira" tem nome fixo. */
export function nomeDaTransportadora({ codigo, fantasia, razaoSocial }: { codigo: string; fantasia: string | null; razaoSocial: string | null }): string {
  return NOMES_FIXOS[codigo] ?? semEspacosSobrando(fantasia ?? razaoSocial ?? codigo);
}

/** Os pedidos de cada cliente, somados por escolha: o mesmo pedido conta uma vez em cada tipo. */
export function somarEscolhas(escolhas: readonly EscolhasDoErp[], idNaCarteira: (chave: string) => string | null): Foto["cliente_escolha"] {
  const soma = new Map<string, Foto["cliente_escolha"][number]>();
  const somar = (cliente: string, tipo: string, valor: string | null | undefined, pedidos: number) => {
    if (!valor) return;
    const chave = `${cliente}|${tipo}|${valor}`;
    const atual = soma.get(chave);
    soma.set(chave, { cliente, tipo, valor, pedidos: (atual?.pedidos ?? 0) + pedidos });
  };
  for (const escolha of escolhas) {
    const id = idNaCarteira(escolha.chave);
    if (!id) continue;
    somar(id, "transportadora", escolha.transportadora, escolha.pedidos);
    somar(id, "condicao", escolha.condicao, escolha.pedidos);
    somar(id, "classificacao", CLASSIFICACOES[escolha.classificacao ?? ""], escolha.pedidos);
    somar(id, "parcial", FRETE_PARCIAL[escolha.freteParcial ?? ""], escolha.pedidos);
    somar(id, "xped", escolha.isComItemDaOrdemDeCompra ? "sim" : "nao", escolha.pedidos);
  }
  return [...soma.values()];
}

/** A alíquota de cada produto de alguma lista: a view repete o produto por cliente, sempre com a mesma. */
function aliquotasDosProdutos(precos: readonly PrecoDoCliente[], produtos: ReadonlySet<string>): Foto["produto_ipi"] {
  const porProduto = new Map<string, number>();
  for (const { produto, aliquotaIpi } of precos) {
    if (produtos.has(produto)) porProduto.set(produto, Math.max(porProduto.get(produto) ?? 0, aliquotaIpi));
  }
  return [...porProduto].map(([produto, aliquota]) => ({ produto, aliquota }));
}

/**
 * "12.345.678/0001-90" ou "123.456.789-01". O ERP guarda o documento como número e perde os zeros da
 * esquerda; com 12 dígitos ou mais (ou da empresa) é CNPJ, com menos é CPF.
 */
export function formatarDocumento(digitos: string, isPessoaFisica = digitos.replace(/\D/g, "").length <= 11): string {
  const numeros = digitos.replace(/\D/g, "");
  if (!numeros) return "";
  if (isPessoaFisica) {
    const cpf = numeros.padStart(11, "0");
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }
  const cnpj = numeros.padStart(14, "0");
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/** "(98) 9846-7193" ou "(41) 99876-5432"; sem número, null. */
export function formatarTelefone(ddd: number, numero: number): string | null {
  if (numero <= 0) return null;
  const texto = String(numero);
  const meio = texto.length - 4;
  const corpo = `${texto.slice(0, meio)}-${texto.slice(meio)}`;
  return ddd > 0 ? `(${ddd}) ${corpo}` : corpo;
}

function semEspacosSobrando(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}
