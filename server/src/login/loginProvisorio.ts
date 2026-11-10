import { createHash, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyReply } from "fastify";
import { auditar } from "../auditoria.ts";
import { FotoIndisponivel, type FotoAtual } from "../foto/fotoAtual.ts";
import { buscarChave, gravarChave } from "./chaves.ts";
import { cookieDaSessao } from "./cookie.ts";
import type { Portal } from "./portal.ts";
import { abrirSessao } from "./sessoes.ts";
import { criarUsuario, listarUsuarios, trocarCodigos, type Usuario } from "./usuarios.ts";

/*
 * O login provisório do CRM na rede interna (iniciar-crm-servidor.bat), pedido pelo Lucas em
 * 2026-11-10 para testar o CRM com os dados reais no celular. A chave de acesso não funciona ali: o
 * navegador só a libera em https ou em localhost, e o endereço é o IP da máquina, por http. Então a
 * entrada é por uma senha, que abre o login dos códigos da configuração da rede interna.
 *
 * Por ser fraco, ele fica cercado:
 * - só existe com o servidor aberto em modo rede interna (configuracao.ts), que recusa a produção,
 *   usa um app.db só dele e um endereço de rede interna;
 * - depois de MAXIMO_DE_ERROS senhas erradas, trava até o servidor ser aberto de novo;
 * - toda entrada e toda senha errada vão para o registro.
 */

export type LoginProvisorio = {
  senha: string;
  /** Os códigos de representante que o login provisório puxa, conferidos com a foto. */
  codigos: string[];
};

export type DependenciasDoLoginProvisorio = {
  banco: DatabaseSync;
  foto: FotoAtual;
  portal: Portal;
  login: LoginProvisorio;
  agora: () => Date;
};

export const NOME_DO_LOGIN_PROVISORIO = "Login provisório";
export const MAXIMO_DE_ERROS = 10;
/** A sessão precisa de uma chave (sessoes.ts): esta é só a marca de que ela foi aberta pela senha. */
const CHAVE_DA_SENHA = "senha-provisoria";
const LIGADO_POR = "rede interna";

const SENHA_ERRADA = "Senha errada.";
const TRAVADO = "O login provisório travou depois de muitas senhas erradas. Feche e abra o CRM de novo no computador.";
const SEM_FOTO = "Os dados ainda não chegaram do ERP.";

const CORPO = {
  type: "object",
  properties: { senha: { type: "string", minLength: 1, maxLength: 64 } },
  required: ["senha"],
  additionalProperties: false,
} as const;

export function registrarLoginProvisorio(app: FastifyInstance, dependencias: DependenciasDoLoginProvisorio): void {
  const hashDaSenha = hashDe(dependencias.login.senha);
  let erros = 0;

  app.post<{ Body: { senha: string } }>("/api/entrar/senha", { config: { acesso: "publico", limite: "login" }, schema: { body: CORPO } }, (requisicao, resposta) => {
    if (erros >= MAXIMO_DE_ERROS) return resposta.code(429).send({ erro: TRAVADO });
    if (!timingSafeEqual(hashDe(requisicao.body.senha), hashDaSenha)) {
      erros += 1;
      auditar(dependencias.banco, { usuario: null, evento: "entrada_recusada", alvo: CHAVE_DA_SENHA, resultado: `senha provisória errada (${erros} de ${MAXIMO_DE_ERROS})` });
      return resposta.code(erros >= MAXIMO_DE_ERROS ? 429 : 401).send({ erro: erros >= MAXIMO_DE_ERROS ? TRAVADO : SENHA_ERRADA });
    }
    return entrar(dependencias, resposta);
  });
}

function entrar({ banco, foto, portal, login, agora }: DependenciasDoLoginProvisorio, resposta: FastifyReply) {
  const momento = agora();
  let usuario: Usuario;
  try {
    usuario = prepararLoginProvisorio(banco, { codigos: login.codigos, autorizados: autorizadosDa(foto) }, momento);
  } catch (erro) {
    if (erro instanceof FotoIndisponivel) return resposta.code(503).send({ erro: SEM_FOTO });
    throw erro;
  }
  const token = abrirSessao(banco, { usuario: usuario.id, chave: CHAVE_DA_SENHA }, momento);
  auditar(banco, { usuario: usuario.id, evento: "entrada", alvo: CHAVE_DA_SENHA });
  return resposta.code(204).header("Set-Cookie", cookieDaSessao(portal.cookie, token)).send();
}

/** O login provisório com os códigos da configuração: criado na primeira entrada, e acertado se os códigos mudaram. */
export function prepararLoginProvisorio(banco: DatabaseSync, { codigos, autorizados }: { codigos: string[]; autorizados: ReadonlySet<string> }, agora: Date): Usuario {
  const existente = listarUsuarios(banco).find((usuario) => usuario.papel === "representante" && usuario.nome === NOME_DO_LOGIN_PROVISORIO);
  const usuario = existente ?? criarUsuario(banco, { nome: NOME_DO_LOGIN_PROVISORIO, codigos, autorizados, ligadoPor: LIGADO_POR }, agora);
  if (existente && !mesmosCodigos(existente.codigos, codigos)) trocarCodigos(banco, { usuario: usuario.id, codigos, autorizados, ligadoPor: LIGADO_POR }, agora);
  if (!buscarChave(banco, CHAVE_DA_SENHA)) gravarMarcaDaSenha(banco, usuario.id, agora);
  return usuario;
}

function gravarMarcaDaSenha(banco: DatabaseSync, usuario: string, agora: Date): void {
  gravarChave(
    banco,
    { id: CHAVE_DA_SENHA, usuario, chavePublica: new Uint8Array(0), contador: 0, transportes: [], aaguid: "00000000-0000-0000-0000-000000000000", sincronizada: false },
    agora,
  );
}

function autorizadosDa(foto: FotoAtual): Set<string> {
  return new Set(
    foto
      .abrir()
      .prepare("SELECT codigo FROM representante")
      .all()
      .map((linha) => String(linha.codigo)),
  );
}

function mesmosCodigos(atuais: readonly string[], desejados: readonly string[]): boolean {
  return atuais.length === desejados.length && desejados.every((codigo) => atuais.includes(codigo));
}

/** Os hashes têm o mesmo tamanho, o que o timingSafeEqual exige; a comparação não revela onde a senha difere. */
function hashDe(senha: string): Buffer {
  return createHash("sha256").update(senha).digest();
}
