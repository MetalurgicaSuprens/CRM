import fs from "node:fs";
import path from "node:path";
import { isPedidoNoSgi, lerCadastroDoPedido, lerEnderecoDaTransportadora, lerHojeNoOracle, lerPrecosMinimos, lerProdutosDoPedido, lerProximoNumeroDePedido } from "../erp/dadosDaGravacao.ts";
import type { Oracle } from "../oracle.ts";
import { montarChamadas, type Chamada, type DadosDaGravacao } from "./chamadasDoSgi.ts";
import type { PedidoNoErp } from "./conferencia.ts";
import { lerPedidoRecebido } from "./formato.ts";

/*
 * A gravação no SGI dos pedidos conferidos (F5, etapa 4), um por vez, cada um numa transação: o
 * cabeçalho como COTACAO, os itens e a efetivação, que o deixa PEDIDO BLOQUEADO. Só confirma no fim; o
 * erro no meio desfaz tudo.
 * - O número é o do SGI6R, o maior + 1. A tela do SGI pode pegar o mesmo número no meio: a chave
 *   repetida (ORA-00001) faz tentar o seguinte.
 * - Antes da transação, o número fica anotado em andamento/. Se a passada cair depois de confirmar e
 *   antes de anotar o fim, a seguinte acha o pedido no SGI por esse número e não grava de novo.
 * - A recusa do SGI (o pedido para o mesmo cliente em menos de 4 minutos, por exemplo) fica para a
 *   passada seguinte; na sexta tentativa, o pedido vai para a quarentena, com o motivo.
 * - A queda da conexão com o Oracle para a passada inteira.
 * Gravado, o pedido vai para gravados/, com o número do SGI ao lado (<número CRM>.sgi.json): é por ele
 * que a situação no SGI volta ao CRM.
 */

export const CONFERIDOS = "conferidos";
export const GRAVADOS = "gravados";
const QUARENTENA = "quarentena";
const ANDAMENTO = "andamento";
export const TENTATIVAS_ANTES_DA_QUARENTENA = 6;
const TENTATIVAS_DE_NUMERO = 5;
const NOME_DO_PEDIDO = /^CRM-\d{5,9}\.json$/;
const QUEDA_DA_CONEXAO = /NJS-|DPI-|ORA-03113|ORA-03114|ORA-03135|ORA-12\d{3}/;
const NUMERO_REPETIDO = /ORA-00001/;

export type ResumoDaGravacao = {
  gravados: { pedido: string; numeroNoSgi: number }[];
  adiados: { pedido: string; motivo: string }[];
  quarentena: { pedido: string; motivo: string }[];
};

/** O que fica anotado entre as passadas: as tentativas e o número que estava sendo gravado. */
type Andamento = { tentativas: number; ultimoErro: string | null; numeroEmGravacao: number | null };

/** O SGI não aceitou o pedido como está e não vai aceitar na próxima passada: vai direto para a quarentena. */
class PedidoRecusado extends Error {}

/** Os conferidos ainda não gravados, em ordem de número. */
export function pedidosParaGravar(pastaDosPedidos: string): string[] {
  const pasta = path.join(pastaDosPedidos, CONFERIDOS);
  if (!fs.existsSync(pasta)) return [];
  return fs
    .readdirSync(pasta)
    .filter((nome) => NOME_DO_PEDIDO.test(nome))
    .sort((a, b) => numeroDe(a) - numeroDe(b));
}

export async function gravarConferidos(pastaDosPedidos: string, oracle: Oracle): Promise<ResumoDaGravacao> {
  const resumo: ResumoDaGravacao = { gravados: [], adiados: [], quarentena: [] };
  for (const nome of pedidosParaGravar(pastaDosPedidos)) {
    const pedido = nome.replace(".json", "");
    try {
      const numeroNoSgi = await gravarPedido(pastaDosPedidos, nome, oracle);
      concluir(pastaDosPedidos, nome, numeroNoSgi);
      resumo.gravados.push({ pedido, numeroNoSgi });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message.split("\n")[0] ?? "" : String(erro);
      if (QUEDA_DA_CONEXAO.test(motivo)) throw erro;
      const tentativas = erro instanceof PedidoRecusado ? TENTATIVAS_ANTES_DA_QUARENTENA : anotarTentativa(pastaDosPedidos, nome, motivo);
      if (tentativas >= TENTATIVAS_ANTES_DA_QUARENTENA) {
        porEmQuarentena(pastaDosPedidos, nome, `na gravação no SGI: ${motivo}`);
        resumo.quarentena.push({ pedido, motivo });
      } else {
        resumo.adiados.push({ pedido, motivo });
      }
    }
  }
  return resumo;
}

async function gravarPedido(pastaDosPedidos: string, nome: string, oracle: Oracle): Promise<number> {
  const { pedido, erp } = lerConferido(pastaDosPedidos, nome);
  const andamento = lerAndamento(pastaDosPedidos, nome);
  if (andamento.numeroEmGravacao !== null && (await isPedidoNoSgi(oracle, andamento.numeroEmGravacao, erp.cliente))) return andamento.numeroEmGravacao;
  const dados = await lerDadosDaGravacao(oracle, pedido, erp);
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_NUMERO; tentativa++) {
    const numero = await lerProximoNumeroDePedido(oracle);
    gravarAndamento(pastaDosPedidos, nome, { ...andamento, numeroEmGravacao: numero });
    try {
      for (const chamada of montarChamadas({ ...dados, numero })) await executar(oracle, chamada);
      await oracle.confirmar();
      return numero;
    } catch (erro) {
      await oracle.desfazer();
      if (!(erro instanceof Error && NUMERO_REPETIDO.test(erro.message))) throw erro;
    }
  }
  throw new Error(`não achei número de pedido livre no SGI em ${TENTATIVAS_DE_NUMERO} tentativas`);
}

/** O que a gravação lê do ERP, conferido de novo: o cadastro pode ter mudado desde a conferência. */
async function lerDadosDaGravacao(oracle: Oracle, pedido: DadosDaGravacao["pedido"], erp: PedidoNoErp): Promise<Omit<DadosDaGravacao, "numero">> {
  const cadastro = await lerCadastroDoPedido(oracle, erp.empresa, erp.cliente);
  if (!cadastro) throw new PedidoRecusado("o cliente não tem mais a tabela de preço PRINCIPAL");
  if (cadastro.tabela !== erp.tabela) throw new PedidoRecusado(`a tabela do cliente mudou de ${erp.tabela} para ${cadastro.tabela} depois da conferência`);
  const codigos = pedido.itens.map(({ codigo }) => codigo);
  const produtos = await lerProdutosDoPedido(oracle, erp.cliente, cadastro.tabela, codigos);
  const fora = codigos.filter((codigo) => !produtos.has(codigo));
  if (fora.length > 0) throw new PedidoRecusado(`produto fora da tabela do cliente: ${fora.join(", ")}`);
  return {
    pedido,
    erp,
    cadastro,
    produtos,
    minimos: await lerPrecosMinimos(oracle, codigos),
    enderecoDaTransportadora: await lerEnderecoDaTransportadora(oracle, erp.transportadora),
    hoje: await lerHojeNoOracle(oracle),
  };
}

/** A chamada da procedure, com os parâmetros pelo nome; a data vai como texto e vira DATE no Oracle. */
export function blocoDaChamada({ procedure, parametros }: Chamada): { plsql: string; binds: Record<string, unknown> } {
  const argumentos = parametros.map(([nome, valor]) => (valor !== null && typeof valor === "object" ? `${nome} => TO_DATE(:${nome}, 'YYYY-MM-DD')` : `${nome} => :${nome}`));
  const binds = Object.fromEntries(parametros.map(([nome, valor]) => [nome, valor !== null && typeof valor === "object" ? valor.data : valor]));
  return { plsql: `BEGIN ABC71.${procedure}(${argumentos.join(", ")}); END;`, binds };
}

async function executar(oracle: Oracle, chamada: Chamada): Promise<void> {
  const { plsql, binds } = blocoDaChamada(chamada);
  await oracle.executar(plsql, binds);
}

function lerConferido(pastaDosPedidos: string, nome: string): { pedido: DadosDaGravacao["pedido"]; erp: PedidoNoErp } {
  const pasta = path.join(pastaDosPedidos, CONFERIDOS);
  const leitura = lerPedidoRecebido(fs.readFileSync(path.join(pasta, nome), "utf8"), nome);
  if (!leitura.ok) throw new PedidoRecusado(`o pedido conferido não está mais no formato: ${leitura.motivo}`);
  const erp = JSON.parse(fs.readFileSync(path.join(pasta, nome.replace(".json", ".erp.json")), "utf8")) as PedidoNoErp;
  return { pedido: leitura.pedido, erp };
}

/** O que fica ao lado do pedido gravado (<número CRM>.sgi.json): o número no SGI e quando entrou lá. */
export type RegistroDaGravacao = { numeroNoSgi: number; gravadoEm: string };

/** O registro do pedido gravado, para o andamento (pedidos/andamento.ts); null se ele não foi gravado. */
export function lerRegistroDaGravacao(pastaDosPedidos: string, numeroCrm: string): RegistroDaGravacao | null {
  const arquivo = path.join(pastaDosPedidos, GRAVADOS, `${numeroCrm}.sgi.json`);
  return fs.existsSync(arquivo) ? (JSON.parse(fs.readFileSync(arquivo, "utf8")) as RegistroDaGravacao) : null;
}

/** Gravado: o pedido e o que a LAN sabe dele vão para gravados/, com o número do SGI ao lado. */
function concluir(pastaDosPedidos: string, nome: string, numeroNoSgi: number): void {
  const base = nome.replace(".json", "");
  const destino = path.join(pastaDosPedidos, GRAVADOS);
  fs.mkdirSync(destino, { recursive: true });
  const registro: RegistroDaGravacao = { numeroNoSgi, gravadoEm: new Date().toISOString() };
  gravarInteiro(path.join(destino, `${base}.sgi.json`), JSON.stringify(registro));
  for (const arquivo of [`${base}.erp.json`, nome]) fs.renameSync(path.join(pastaDosPedidos, CONFERIDOS, arquivo), path.join(destino, arquivo));
  fs.rmSync(path.join(pastaDosPedidos, ANDAMENTO, nome), { force: true });
}

function porEmQuarentena(pastaDosPedidos: string, nome: string, motivo: string): void {
  const base = nome.replace(".json", "");
  const destino = path.join(pastaDosPedidos, QUARENTENA);
  fs.mkdirSync(destino, { recursive: true });
  gravarInteiro(path.join(destino, `${base}.motivo.txt`), `${motivo}\n`);
  fs.rmSync(path.join(pastaDosPedidos, CONFERIDOS, `${base}.erp.json`), { force: true });
  fs.renameSync(path.join(pastaDosPedidos, CONFERIDOS, nome), path.join(destino, nome));
  fs.rmSync(path.join(pastaDosPedidos, ANDAMENTO, nome), { force: true });
}

function anotarTentativa(pastaDosPedidos: string, nome: string, motivo: string): number {
  const andamento = lerAndamento(pastaDosPedidos, nome);
  const tentativas = andamento.tentativas + 1;
  gravarAndamento(pastaDosPedidos, nome, { ...andamento, tentativas, ultimoErro: motivo });
  return tentativas;
}

function lerAndamento(pastaDosPedidos: string, nome: string): Andamento {
  const arquivo = path.join(pastaDosPedidos, ANDAMENTO, nome);
  return fs.existsSync(arquivo) ? (JSON.parse(fs.readFileSync(arquivo, "utf8")) as Andamento) : { tentativas: 0, ultimoErro: null, numeroEmGravacao: null };
}

function gravarAndamento(pastaDosPedidos: string, nome: string, andamento: Andamento): void {
  const pasta = path.join(pastaDosPedidos, ANDAMENTO);
  fs.mkdirSync(pasta, { recursive: true });
  gravarInteiro(path.join(pasta, nome), JSON.stringify(andamento));
}

function gravarInteiro(arquivo: string, conteudo: string): void {
  fs.writeFileSync(`${arquivo}.part`, conteudo);
  fs.renameSync(`${arquivo}.part`, arquivo);
}

function numeroDe(nome: string): number {
  return Number(/\d+/.exec(nome)?.[0] ?? 0);
}
