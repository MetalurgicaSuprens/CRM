import { parseArgs } from "node:util";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { lerConfiguracao } from "../configuracao.ts";
import { criarFotoAtual } from "../foto/fotoAtual.ts";
import { UsuarioRecusado } from "../login/usuarios.ts";
import { convidar, criarAdmin, desativar, listar, novoConvite, revogar } from "./comandos.ts";
import { AcaoRecusada, type Contexto } from "./gestao.ts";

/*
 * npm run admin -- <comando>: as ações de admin, no servidor, por SSH (comandos.ts). O dia a dia
 * fica na tela da administração; aqui nasce o primeiro admin.
 */

const AJUDA = `Uso: npm run admin -- <comando>
  criar-admin --nome "Seu nome"                       cria o seu login de admin e o convite da administração
  convidar --nome "Star Vendas" --codigos 1401,1402   cria o login de um representante, com os códigos, e o convite
  novo-convite --usuario <id>                         convite novo, para aparelho novo ou perdido
  usuarios                                            lista os logins, os códigos e as chaves
  revogar --usuario <id>                              bloqueia as chaves e encerra as sessões
  desativar --usuario <id>                            desativa o login, as chaves, as sessões e os convites`;

type Opcoes = { nome?: string; codigos?: string; usuario?: string };

class OpcaoFaltando extends Error {}

const COMANDOS: Readonly<Record<string, (contexto: Contexto, opcoes: Opcoes) => string>> = {
  "criar-admin": (contexto, opcoes) => criarAdmin(contexto, { nome: exigir(opcoes.nome, "--nome") }),
  convidar: (contexto, opcoes) => convidar(contexto, { nome: exigir(opcoes.nome, "--nome"), codigos: listaDeCodigos(exigir(opcoes.codigos, "--codigos")) }),
  "novo-convite": (contexto, opcoes) => novoConvite(contexto, exigir(opcoes.usuario, "--usuario")),
  usuarios: (contexto) => listar(contexto),
  revogar: (contexto, opcoes) => revogar(contexto, exigir(opcoes.usuario, "--usuario")),
  desativar: (contexto, opcoes) => desativar(contexto, exigir(opcoes.usuario, "--usuario")),
};

const pedido = lerPedido();
const executar = pedido ? COMANDOS[pedido.comando] : undefined;
if (!pedido || !executar) {
  console.log(AJUDA);
} else {
  const configuracao = lerConfiguracao();
  const banco = abrirBancoDoApp(configuracao.arquivoDoApp);
  const foto = criarFotoAtual(configuracao.pastaDasFotos);
  try {
    const contexto: Contexto = { banco, agora: new Date(), foto: () => foto.abrir(), origens: { crm: configuracao.origem, admin: configuracao.origemDoAdmin } };
    console.log(executar(contexto, pedido.opcoes));
  } catch (erro) {
    if (!(erro instanceof AcaoRecusada || erro instanceof UsuarioRecusado || erro instanceof OpcaoFaltando)) throw erro;
    console.error(erro.message);
    process.exitCode = 1;
  } finally {
    foto.fechar();
    banco.close();
  }
}

function lerPedido(): { comando: string; opcoes: Opcoes } | null {
  try {
    const { positionals, values } = parseArgs({ allowPositionals: true, options: { nome: { type: "string" }, codigos: { type: "string" }, usuario: { type: "string" } } });
    return positionals[0] ? { comando: positionals[0], opcoes: values } : null;
  } catch {
    return null;
  }
}

function exigir(valor: string | undefined, opcao: string): string {
  if (!valor?.trim()) throw new OpcaoFaltando(`Falta ${opcao}.\n\n${AJUDA}`);
  return valor;
}

function listaDeCodigos(texto: string): string[] {
  return texto
    .split(",")
    .map((codigo) => codigo.trim())
    .filter((codigo) => codigo !== "");
}
