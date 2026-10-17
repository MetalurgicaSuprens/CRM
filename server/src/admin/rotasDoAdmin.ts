import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { momentoEmBrasilia } from "dominio/datas";
import type { SituacaoDaAdministracao } from "../../../web/src/admin/tipos.ts";
import type { FotoAtual } from "../foto/fotoAtual.ts";
import { FotoIndisponivel } from "../foto/fotoAtual.ts";
import { UsuarioRecusado } from "../login/usuarios.ts";
import type { Sessao } from "../sessao.ts";
import {
  AcaoRecusada,
  bloquearChave,
  bloquearChaves,
  criarLogin,
  desativarLogin,
  encerrarSessoes,
  gerarConvite,
  LoginNaoEncontrado,
  trocarCodigosDoLogin,
  verLogin,
  verLogins,
  verRegistro,
  verRepresentantes,
  type Contexto,
} from "./gestao.ts";

/*
 * As rotas da administração (gestao.ts). Todas são de admin: só respondem na API da administração,
 * com a sessão de um login de admin (app.ts). A que liga códigos a um login é a exceção da regra 4
 * do CLAUDE.md: o código vem do navegador, é conferido contra a lista de autorizados da foto e a
 * ação vai para a auditoria.
 */

export type DependenciasDoAdmin = { foto: FotoAtual; banco: DatabaseSync; origens: Contexto["origens"]; agora: () => Date };

const DO_ADMIN = { config: { acesso: "admin" as const } };
const CODIGOS = { type: "array", items: { type: "string", pattern: "^\\d{1,9}$" }, minItems: 1, maxItems: 20 } as const;
const PARAMETRO_LOGIN = {
  type: "object",
  properties: { id: { type: "string", pattern: "^[0-9a-f]{16}$" } },
  required: ["id"],
  additionalProperties: false,
} as const;
const PARAMETRO_CHAVE = {
  type: "object",
  properties: { id: { type: "string", pattern: "^[A-Za-z0-9_-]{1,1364}$" } },
  required: ["id"],
  additionalProperties: false,
} as const;
const CORPO_DO_LOGIN = {
  type: "object",
  properties: { nome: { type: "string", minLength: 1, maxLength: 80 }, codigos: CODIGOS },
  required: ["nome", "codigos"],
  additionalProperties: false,
} as const;
const CORPO_DOS_CODIGOS = { type: "object", properties: { codigos: CODIGOS }, required: ["codigos"], additionalProperties: false } as const;
const BUSCA_DO_REGISTRO = {
  type: "object",
  properties: { antes: { type: "integer", minimum: 1 }, login: { type: "string", pattern: "^[0-9a-f]{16}$" } },
  additionalProperties: false,
} as const;

type ComLogin = { Params: { id: string } };

export function registrarRotasDoAdmin(app: FastifyInstance, dependencias: DependenciasDoAdmin): void {
  const contexto = (): Contexto => ({ banco: dependencias.banco, agora: dependencias.agora(), foto: () => dependencias.foto.abrir(), origens: dependencias.origens });

  app.get("/api/admin/situacao", DO_ADMIN, (requisicao): SituacaoDaAdministracao => {
    const admin = sessaoDa(requisicao);
    return { admin: { id: admin.idDoUsuario, nome: admin.nome }, relogio: momentoEmBrasilia(dependencias.agora()), foto: situacaoDaFoto(dependencias.foto) };
  });

  app.get("/api/admin/logins", DO_ADMIN, () => verLogins(contexto()));

  app.get<ComLogin>("/api/admin/logins/:id", { ...DO_ADMIN, schema: { params: PARAMETRO_LOGIN } }, (requisicao, resposta) => {
    return verLogin(contexto(), requisicao.params.id) ?? resposta.code(404).send({ erro: "Login não encontrado." });
  });

  app.get("/api/admin/representantes", DO_ADMIN, () => verRepresentantes(contexto()));

  app.get<{ Querystring: { antes?: number; login?: string } }>("/api/admin/registro", { ...DO_ADMIN, schema: { querystring: BUSCA_DO_REGISTRO } }, (requisicao) =>
    verRegistro(contexto(), { antesDe: requisicao.query.antes ?? null, login: requisicao.query.login ?? null }),
  );

  app.post<{ Body: { nome: string; codigos: string[] } }>("/api/admin/logins", { ...DO_ADMIN, schema: { body: CORPO_DO_LOGIN } }, (requisicao, resposta) =>
    executar(resposta, () => resposta.code(201).send(criarLogin(contexto(), requisicao.body, autor(requisicao)))),
  );

  app.post<ComLogin>("/api/admin/logins/:id/convite", { ...DO_ADMIN, schema: { params: PARAMETRO_LOGIN } }, (requisicao, resposta) =>
    executar(resposta, () => gerarConvite(contexto(), requisicao.params.id, autor(requisicao))),
  );

  app.post<ComLogin & { Body: { codigos: string[] } }>(
    "/api/admin/logins/:id/codigos",
    { ...DO_ADMIN, schema: { params: PARAMETRO_LOGIN, body: CORPO_DOS_CODIGOS } },
    (requisicao, resposta) => executar(resposta, () => ({ codigos: trocarCodigosDoLogin(contexto(), requisicao.params.id, requisicao.body.codigos, autor(requisicao)) })),
  );

  app.post<ComLogin>("/api/admin/logins/:id/bloquear-chaves", { ...DO_ADMIN, schema: { params: PARAMETRO_LOGIN } }, (requisicao, resposta) =>
    executar(resposta, () => ({ bloqueadas: bloquearChaves(contexto(), requisicao.params.id, autor(requisicao)) })),
  );

  app.post<ComLogin>("/api/admin/logins/:id/encerrar-sessoes", { ...DO_ADMIN, schema: { params: PARAMETRO_LOGIN } }, (requisicao, resposta) =>
    executar(resposta, () => ({ encerradas: encerrarSessoes(contexto(), requisicao.params.id, autor(requisicao)) })),
  );

  app.post<ComLogin>("/api/admin/logins/:id/desativar", { ...DO_ADMIN, schema: { params: PARAMETRO_LOGIN } }, (requisicao, resposta) =>
    executar(resposta, () => {
      desativarLogin(contexto(), requisicao.params.id, autor(requisicao));
      return resposta.code(204).send();
    }),
  );

  app.post<ComLogin>("/api/admin/chaves/:id/bloquear", { ...DO_ADMIN, schema: { params: PARAMETRO_CHAVE } }, (requisicao, resposta) =>
    executar(resposta, () => {
      bloquearChave(contexto(), requisicao.params.id, autor(requisicao));
      return resposta.code(204).send();
    }),
  );
}

/** A recusa da ação volta com a mensagem, para a tela mostrar: 404 se o login não existe, 409 no resto. */
function executar<T>(resposta: FastifyReply, acao: () => T): T | FastifyReply {
  try {
    return acao();
  } catch (erro) {
    if (erro instanceof LoginNaoEncontrado) return resposta.code(404).send({ erro: erro.message });
    if (erro instanceof AcaoRecusada || erro instanceof UsuarioRecusado) return resposta.code(409).send({ erro: erro.message });
    throw erro;
  }
}

function situacaoDaFoto(foto: FotoAtual): SituacaoDaAdministracao["foto"] {
  try {
    const banco = foto.abrir();
    const dados = banco.prepare("SELECT gerada_em, data_ref FROM foto").get();
    const contar = (sql: string) => Number(banco.prepare(sql).get()?.quantos ?? 0);
    return {
      geradaEm: String(dados?.gerada_em),
      dataRef: String(dados?.data_ref),
      representantes: contar("SELECT COUNT(*) AS quantos FROM representante"),
      // Os clientes são os CNPJs: a linha de um grupo do SGI não conta.
      clientes: contar("SELECT COUNT(*) AS quantos FROM cliente WHERE cnpjs IS NULL"),
    };
  } catch (erro) {
    if (erro instanceof FotoIndisponivel) return null;
    throw erro;
  }
}

/** A rota de admin só chega aqui com a sessão do admin (app.ts barra antes com 401). */
function sessaoDa(requisicao: FastifyRequest): Sessao {
  if (!requisicao.sessao) throw new Error("Rota de admin sem sessão.");
  return requisicao.sessao;
}

function autor(requisicao: FastifyRequest): string {
  return sessaoDa(requisicao).idDoUsuario;
}
