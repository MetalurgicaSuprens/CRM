import type { DatabaseSync } from "node:sqlite";
import type { CadastroDoCliente, Classificacao, ClienteResumo, DadosDoPedido, LocalDoCadastro, Uso } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { escopo, lerLinhas, numero, texto, textoOuNulo, type Linha } from "./linhas.ts";

/*
 * Os dados da tela de pedido do cliente: o cadastro que o representante confere e o histórico que deixa
 * as condições já preenchidas (web/src/dados/dadosDoPedido.ts). Só do CNPJ da carteira do login: quem
 * chama já conferiu o cliente (catalogo.ts). As listas de transportadoras e de condições são do ERP
 * inteiro, dado de empresa; as transportadoras do representante, só dos códigos do login.
 */

/** As que o representante mais usa, para o cliente sem histórico: as primeiras bastam. */
const TRANSPORTADORAS_DO_REPRESENTANTE = 5;

/** O cadastro fiscal do CNPJ ou da pessoa física, para a tela de pedido e a ficha; null sem cadastro na foto. */
export function lerCadastro(db: DatabaseSync, cliente: ClienteResumo): CadastroDoCliente | null {
  const [cadastro] = lerLinhas(db, "SELECT * FROM cliente_cadastro WHERE cliente = ?", [cliente.codigo]);
  return cadastro ? montarCadastro(db, cliente, cadastro) : null;
}

export function lerDadosDoPedido(db: DatabaseSync, sessao: Sessao, cliente: ClienteResumo, produtosDaLista: readonly string[]): DadosDoPedido | null {
  const [cadastro] = lerLinhas(db, "SELECT * FROM cliente_cadastro WHERE cliente = ?", [cliente.codigo]);
  if (!cadastro) return null;
  const escolhas = escolhasDoCliente(db, cliente.codigo);
  const condicoesUsadas = escolhas("condicao");
  const parcial = escolhas("parcial");
  const xped = escolhas("xped");
  return {
    cadastro: montarCadastro(db, cliente, cadastro),
    condicaoDoCadastro: textoOuNulo(cadastro, "condicao_pagamento") ?? condicoesUsadas[0]?.valor ?? "",
    condicoes: lerLinhas(db, "SELECT codigo, descricao FROM condicao_pagamento ORDER BY CAST(codigo AS INTEGER)").map((linha) => ({
      codigo: texto(linha, "codigo"),
      descricao: texto(linha, "descricao"),
    })),
    condicoesUsadas,
    classificacoesUsadas: escolhas("classificacao") as Uso<Classificacao>[],
    parcialUsado: { aceita: parcial.find((uso) => uso.valor === "sim")?.pedidos ?? 0, naoAceita: parcial.find((uso) => uso.valor === "nao")?.pedidos ?? 0 },
    xpedUsado: { com: xped.find((uso) => uso.valor === "sim")?.pedidos ?? 0, sem: xped.find((uso) => uso.valor === "nao")?.pedidos ?? 0 },
    transportadoras: lerLinhas(db, "SELECT codigo, nome, cnpj, cidade, uf FROM transportadora ORDER BY nome").map((linha) => ({
      codigo: texto(linha, "codigo"),
      nome: texto(linha, "nome"),
      cnpj: texto(linha, "cnpj"),
      cidade: texto(linha, "cidade"),
      uf: texto(linha, "uf"),
    })),
    transportadorasDoCliente: escolhas("transportadora"),
    transportadorasDoRepresentante: transportadorasDoLogin(db, sessao),
    ipi: numero(cadastro, "base_ipi") === 1 ? aliquotas(db, produtosDaLista) : {},
    ultimoPedido: ultimoPedido(db, cliente.codigo, textoOuNulo(cadastro, "ultimo_pedido_em")),
  };
}

function montarCadastro(db: DatabaseSync, cliente: ClienteResumo, cadastro: Linha): CadastroDoCliente {
  const [linhaDoCliente] = lerLinhas(db, "SELECT razao_social FROM cliente WHERE cliente = ?", [cliente.codigo]);
  const locais = lerLinhas(db, "SELECT * FROM cliente_local WHERE cliente = ?", [cliente.codigo]);
  const local = (tipo: string): LocalDoCadastro | null => {
    const linha = locais.find((outro) => texto(outro, "tipo") === tipo);
    return linha
      ? {
          razaoSocial: texto(linha, "razao_social"),
          documento: texto(linha, "documento"),
          texto: texto(linha, "endereco"),
          bairro: textoOuNulo(linha, "bairro"),
          cidade: texto(linha, "cidade"),
          uf: texto(linha, "uf"),
          cep: textoOuNulo(linha, "cep"),
        }
      : null;
  };
  return {
    razaoSocial: linhaDoCliente ? texto(linhaDoCliente, "razao_social") : cliente.nome,
    documento: texto(cadastro, "documento"),
    inscricaoEstadual: textoOuNulo(cadastro, "inscricao_estadual"),
    suframa: textoOuNulo(cadastro, "suframa"),
    telefone: textoOuNulo(cadastro, "telefone"),
    emailDoXml: textoOuNulo(cadastro, "email_xml"),
    faturamento: {
      texto: textoOuNulo(cadastro, "endereco") ?? "",
      bairro: textoOuNulo(cadastro, "bairro"),
      cidade: cliente.cidade,
      uf: cliente.uf,
      cep: textoOuNulo(cadastro, "cep"),
    },
    cobranca: local("cobranca"),
    entrega: local("entrega"),
  };
}

/** As escolhas de um tipo nos pedidos do cliente, da mais usada à menos usada. */
function escolhasDoCliente(db: DatabaseSync, cliente: string): (tipo: string) => Uso[] {
  const linhas = lerLinhas(db, "SELECT tipo, valor, pedidos FROM cliente_escolha WHERE cliente = ? ORDER BY pedidos DESC, valor", [cliente]);
  return (tipo) => linhas.filter((linha) => texto(linha, "tipo") === tipo).map((linha) => ({ valor: texto(linha, "valor"), pedidos: numero(linha, "pedidos") }));
}

/** Somadas pelos códigos do login: um login pode ter mais de um código. */
function transportadorasDoLogin(db: DatabaseSync, sessao: Sessao): Uso[] {
  const { marcas, codigos } = escopo(sessao);
  return lerLinhas(
    db,
    `SELECT transportadora, SUM(pedidos) AS pedidos FROM representante_transportadora
      WHERE representante IN (${marcas}) GROUP BY transportadora ORDER BY 2 DESC, 1 LIMIT ${TRANSPORTADORAS_DO_REPRESENTANTE}`,
    codigos,
  ).map((linha) => ({ valor: texto(linha, "transportadora"), pedidos: numero(linha, "pedidos") }));
}

function aliquotas(db: DatabaseSync, produtos: readonly string[]): Record<string, number> {
  if (produtos.length === 0) return {};
  const naLista = new Set(produtos);
  return Object.fromEntries(
    lerLinhas(db, "SELECT produto, aliquota FROM produto_ipi")
      .filter((linha) => naLista.has(texto(linha, "produto")))
      .map((linha) => [texto(linha, "produto"), numero(linha, "aliquota")]),
  );
}

function ultimoPedido(db: DatabaseSync, cliente: string, data: string | null): DadosDoPedido["ultimoPedido"] {
  if (data === null) return null;
  const itens = lerLinhas(db, "SELECT produto, pecas FROM ultimo_pedido_item WHERE cliente = ? ORDER BY ordem", [cliente]).map((linha) => ({
    codigo: texto(linha, "produto"),
    quantidade: Math.round(numero(linha, "pecas")),
  }));
  return itens.length > 0 ? { data, itens } : null;
}
