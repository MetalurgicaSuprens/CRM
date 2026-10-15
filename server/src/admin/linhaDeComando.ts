import { parseArgs } from "node:util";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { lerConfiguracao } from "../configuracao.ts";
import { criarFotoAtual, FotoIndisponivel } from "../foto/fotoAtual.ts";
import { UsuarioRecusado } from "../login/usuarios.ts";
import { ComandoRecusado, convidar, desativar, listar, novoConvite, revogar, type Contexto } from "./comandos.ts";

/*
 * npm run admin -- <comando>: as ações de admin, no servidor, por SSH (comandos.ts).
 */

const AJUDA = `Uso: npm run admin -- <comando>
  convidar --nome "Star Vendas" --codigos 1401,1402   cria o login, com os códigos, e o convite
  novo-convite --usuario <id>                         convite novo, para aparelho novo ou perdido
  usuarios                                            lista os logins, os códigos e as chaves
  revogar --usuario <id>                              revoga as chaves e encerra as sessões
  desativar --usuario <id>                            desativa o login, as chaves, as sessões e os convites`;

type Opcoes = { nome?: string; codigos?: string; usuario?: string };

const COMANDOS: Readonly<Record<string, (contexto: Contexto, opcoes: Opcoes) => string>> = {
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
  try {
    console.log(executar({ banco, origem: configuracao.origem, autorizados: () => lerAutorizados(configuracao.pastaDasFotos), agora: new Date() }, pedido.opcoes));
  } catch (erro) {
    if (!(erro instanceof ComandoRecusado || erro instanceof UsuarioRecusado || erro instanceof FotoIndisponivel)) throw erro;
    console.error(erro.message);
    process.exitCode = 1;
  } finally {
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
  if (!valor?.trim()) throw new ComandoRecusado(`Falta ${opcao}.\n\n${AJUDA}`);
  return valor;
}

function listaDeCodigos(texto: string): string[] {
  return texto
    .split(",")
    .map((codigo) => codigo.trim())
    .filter((codigo) => codigo !== "");
}

/** A lista de autorizados é a tabela de representantes da foto mais nova (CLAUDE.md, regra 4). */
function lerAutorizados(pastaDasFotos: string): Set<string> {
  const foto = criarFotoAtual(pastaDasFotos);
  try {
    return new Set(
      foto
        .abrir()
        .prepare("SELECT codigo FROM representante")
        .all()
        .map((linha) => String(linha.codigo)),
    );
  } finally {
    foto.fechar();
  }
}
