import { createHash } from "node:crypto";
import { isDataDeVerdade } from "dominio/datas";
import { conteudoCanonico, type ConteudoDoPedido } from "dominio/conteudoDoPedido";
import { LIMITE_DA_OBSERVACAO, LIMITE_DA_ORDEM_DE_COMPRA, MAIOR_ITEM_DA_ORDEM_DE_COMPRA } from "dominio/pedido";

/*
 * O pedido que chegou da caixa de saída do servidor do CRM é entrada hostil (CLAUDE.md, regra 5): a
 * máquina do extrator confere o formato inteiro antes de qualquer consulta ao Oracle, com os mesmos
 * limites do schema do servidor (server/src/rotas.ts e envio/caixaDeSaida.ts). Campo a mais, a menos ou
 * fora do formato recusa o pedido. Por último, o hash: o conteúdo tem de ser o que a chave de acesso
 * confirmou no CRM.
 */

export type PedidoRecebido = ConteudoDoPedido & {
  versao: 1;
  /** "CRM-00106" */
  numero: string;
  /** No relógio de Brasília, "2026-11-19T09:30:00". */
  enviadoEm: string;
  /** O id do login que enviou. */
  usuario: string;
  /** Os códigos de representante do login, da sessão no servidor. */
  codigos: string[];
  hash: string;
};

export type LeituraDoPedido = { ok: true; pedido: PedidoRecebido } | { ok: false; motivo: string };

/** Tamanho máximo do arquivo: um pedido de 300 itens tem uns 20 KB. */
export const TAMANHO_MAXIMO_DO_ARQUIVO = 64 * 1024;
const LIMITE_DE_ITENS = 300;
const MAXIMO_DE_PECAS = 10_000_000;
const MAXIMO_DO_PRECO_DO_CENTO = 10_000_000;
const MAXIMO_DE_CODIGOS = 20;

const NUMERO_DO_CRM = /^CRM-\d{5,9}$/;
const MOMENTO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const ID_DO_LOGIN = /^[0-9a-f]{16}$/;
const ID_DO_CLIENTE = /^[0-9a-f]{16}$/;
const CODIGO_DE_REPRESENTANTE = /^\d{1,9}$/;
const CODIGO_DO_PRODUTO = /^[A-Za-z0-9][A-Za-z0-9./-]{0,19}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HASH = /^[0-9a-f]{64}$/;
const CONDICAO = /^\d{1,6}$/;
const CODIGO_DA_TRANSPORTADORA = /^\d{1,15}$/;
const CNPJ = /^\d{14}$/;
const UF = /^[A-Z]{2}$/;
const CLASSIFICACOES = new Set(["comercializacao", "industrializacao", "uso_consumo"]);
/** Uma linha de texto, sem caractere de controle. */
const LINHA = /^[^\u0000-\u001F\u007F]*$/;
/** A observação aceita a quebra de linha e nenhum outro caractere de controle. */
const OBSERVACAO = /^[^\u0000-\u0009\u000B-\u001F\u007F]*$/;

const CAMPOS_DO_PEDIDO = ["versao", "numero", "enviadoEm", "usuario", "codigos", "cliente", "itens", "entrega", "observacao", "escolhas", "hash"];
const CAMPOS_DO_ITEM = ["codigo", "quantidade", "precoCento", "ordemDeCompra", "itemDaOrdemDeCompra"];
const CAMPOS_DAS_ESCOLHAS = ["condicaoDePagamento", "classificacao", "pedidoDoCliente", "aceitaParcial", "clienteXped", "transportadora"];
const CAMPOS_DA_TRANSPORTADORA_NOVA = ["cnpj", "nome", "cidade", "uf"];

class ForaDoFormato extends Error {}

/** O pedido do arquivo `nomeDoArquivo` ("CRM-00106.json"), conferido; ou o motivo da recusa, para a quarentena. */
export function lerPedidoRecebido(conteudo: string, nomeDoArquivo: string): LeituraDoPedido {
  if (Buffer.byteLength(conteudo) > TAMANHO_MAXIMO_DO_ARQUIVO) return { ok: false, motivo: `arquivo com mais de ${TAMANHO_MAXIMO_DO_ARQUIVO / 1024} KB` };
  let json: unknown;
  try {
    json = JSON.parse(conteudo);
  } catch {
    return { ok: false, motivo: "o arquivo não é JSON" };
  }
  try {
    const pedido = conferirPedido(json);
    if (`${pedido.numero}.json` !== nomeDoArquivo) return { ok: false, motivo: `o número ${pedido.numero} não é o do arquivo` };
    if (createHash("sha256").update(conteudoCanonico(pedido)).digest("hex") !== pedido.hash) {
      return { ok: false, motivo: "o conteúdo não é o que a chave de acesso confirmou (hash diferente)" };
    }
    return { ok: true, pedido };
  } catch (erro) {
    if (erro instanceof ForaDoFormato) return { ok: false, motivo: erro.message };
    throw erro;
  }
}

function conferirPedido(json: unknown): PedidoRecebido {
  const pedido = objeto(json, CAMPOS_DO_PEDIDO, "pedido");
  if (pedido.versao !== 1) throw new ForaDoFormato(`versão do arquivo desconhecida: ${String(pedido.versao)}`);
  const codigos = lista(pedido.codigos, "codigos", 1, MAXIMO_DE_CODIGOS).map((codigo) => texto(codigo, CODIGO_DE_REPRESENTANTE, "código de representante"));
  return {
    versao: 1,
    numero: texto(pedido.numero, NUMERO_DO_CRM, "numero"),
    enviadoEm: momento(pedido.enviadoEm),
    usuario: texto(pedido.usuario, ID_DO_LOGIN, "usuario"),
    codigos,
    cliente: texto(pedido.cliente, ID_DO_CLIENTE, "cliente"),
    itens: conferirItens(pedido.itens),
    entrega: pedido.entrega === null ? null : data(pedido.entrega, "entrega"),
    observacao: textoLivre(pedido.observacao, OBSERVACAO, LIMITE_DA_OBSERVACAO, "observacao"),
    escolhas: conferirEscolhas(pedido.escolhas),
    hash: texto(pedido.hash, HASH, "hash"),
  };
}

function conferirItens(valor: unknown): PedidoRecebido["itens"] {
  const itens = lista(valor, "itens", 1, LIMITE_DE_ITENS).map((item) => {
    const campos = objeto(item, CAMPOS_DO_ITEM, "item");
    return {
      codigo: texto(campos.codigo, CODIGO_DO_PRODUTO, "código do produto"),
      quantidade: inteiro(campos.quantidade, 1, MAXIMO_DE_PECAS, "quantidade"),
      precoCento: preco(campos.precoCento),
      ordemDeCompra: campos.ordemDeCompra === null ? null : textoLivre(campos.ordemDeCompra, LINHA, LIMITE_DA_ORDEM_DE_COMPRA, "ordem de compra do item", 1),
      itemDaOrdemDeCompra: campos.itemDaOrdemDeCompra === null ? null : inteiro(campos.itemDaOrdemDeCompra, 1, MAIOR_ITEM_DA_ORDEM_DE_COMPRA, "item da ordem de compra"),
    };
  });
  if (new Set(itens.map(({ codigo }) => codigo)).size !== itens.length) throw new ForaDoFormato("o mesmo produto veio duas vezes");
  return itens;
}

function conferirEscolhas(valor: unknown): PedidoRecebido["escolhas"] {
  const escolhas = objeto(valor, CAMPOS_DAS_ESCOLHAS, "escolhas");
  if (typeof escolhas.aceitaParcial !== "boolean") throw new ForaDoFormato("aceitaParcial fora do formato");
  if (typeof escolhas.clienteXped !== "boolean") throw new ForaDoFormato("clienteXped fora do formato");
  const classificacao = texto(escolhas.classificacao, LINHA, "classificacao");
  if (!CLASSIFICACOES.has(classificacao)) throw new ForaDoFormato(`classificação desconhecida: ${classificacao}`);
  return {
    condicaoDePagamento: texto(escolhas.condicaoDePagamento, CONDICAO, "condicaoDePagamento"),
    classificacao,
    pedidoDoCliente: textoLivre(escolhas.pedidoDoCliente, LINHA, LIMITE_DA_ORDEM_DE_COMPRA, "pedidoDoCliente"),
    aceitaParcial: escolhas.aceitaParcial,
    clienteXped: escolhas.clienteXped,
    transportadora: conferirTransportadora(escolhas.transportadora),
  };
}

/** A transportadora é obrigatória no envio: a do cadastro do ERP ou uma nova, que espera o cadastro de vendas. */
function conferirTransportadora(valor: unknown): NonNullable<PedidoRecebido["escolhas"]["transportadora"]> {
  if (valor !== null && typeof valor === "object" && "codigo" in valor) {
    return { codigo: texto(objeto(valor, ["codigo"], "transportadora").codigo, CODIGO_DA_TRANSPORTADORA, "código da transportadora") };
  }
  const nova = objeto(objeto(valor, ["nova"], "transportadora").nova, CAMPOS_DA_TRANSPORTADORA_NOVA, "transportadora nova");
  return {
    nova: {
      cnpj: texto(nova.cnpj, CNPJ, "CNPJ da transportadora"),
      nome: textoLivre(nova.nome, LINHA, 60, "nome da transportadora", 2),
      cidade: textoLivre(nova.cidade, LINHA, 40, "cidade da transportadora", 2),
      uf: texto(nova.uf, UF, "UF da transportadora"),
    },
  };
}

/** Um objeto com exatamente estes campos. */
function objeto(valor: unknown, campos: readonly string[], nome: string): Record<string, unknown> {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) throw new ForaDoFormato(`${nome} não é um objeto`);
  const chaves = Object.keys(valor);
  const sobrando = chaves.filter((chave) => !campos.includes(chave));
  const faltando = campos.filter((campo) => !chaves.includes(campo));
  if (sobrando.length > 0) throw new ForaDoFormato(`${nome} com campo a mais: ${sobrando.join(", ")}`);
  if (faltando.length > 0) throw new ForaDoFormato(`${nome} sem o campo ${faltando.join(", ")}`);
  return valor as Record<string, unknown>;
}

function lista(valor: unknown, nome: string, minimo: number, maximo: number): unknown[] {
  if (!Array.isArray(valor) || valor.length < minimo || valor.length > maximo) throw new ForaDoFormato(`${nome}: de ${minimo} a ${maximo}`);
  return valor;
}

function texto(valor: unknown, formato: RegExp, nome: string): string {
  if (typeof valor !== "string" || !formato.test(valor)) throw new ForaDoFormato(`${nome} fora do formato`);
  return valor;
}

function textoLivre(valor: unknown, formato: RegExp, maximo: number, nome: string, minimo = 0): string {
  const conferido = texto(valor, formato, nome);
  if (conferido.length < minimo || conferido.length > maximo) throw new ForaDoFormato(`${nome}: de ${minimo} a ${maximo} caracteres`);
  return conferido;
}

function inteiro(valor: unknown, minimo: number, maximo: number, nome: string): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < minimo || valor > maximo) throw new ForaDoFormato(`${nome} fora do limite`);
  return valor;
}

function preco(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor > MAXIMO_DO_PRECO_DO_CENTO) throw new ForaDoFormato("preço do cento fora do limite");
  return valor;
}

function data(valor: unknown, nome: string): string {
  const dia = texto(valor, DATA, nome);
  if (!isDataDeVerdade(dia)) throw new ForaDoFormato(`${nome}: essa data não existe`);
  return dia;
}

function momento(valor: unknown): string {
  const enviadoEm = texto(valor, MOMENTO, "enviadoEm");
  if (!isDataDeVerdade(enviadoEm.slice(0, 10))) throw new ForaDoFormato("enviadoEm: essa data não existe");
  return enviadoEm;
}
