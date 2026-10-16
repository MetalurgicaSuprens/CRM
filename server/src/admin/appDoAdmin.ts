import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { criarApi } from "../app.ts";
import type { FotoAtual } from "../foto/fotoAtual.ts";
import { PORTAL_DO_ADMIN } from "../login/portal.ts";
import { registrarRotasDoAdmin } from "./rotasDoAdmin.ts";

/*
 * A API da administração: as mesmas regras de segurança da do CRM (app.ts), com o cookie e o login
 * do admin, as rotas de admin e um endereço só seu, que nunca fica na internet (docs/plano.md,
 * "server/"). Só o login de admin entra nela.
 */

export type DependenciasDoAppDoAdmin = {
  foto: FotoAtual;
  banco: DatabaseSync;
  /** O endereço da administração (esquema, domínio e porta), como o navegador o declara. */
  origem: string;
  /** O endereço do CRM, para o link do convite dos representantes. */
  origemDoCrm: string;
  agora?: () => Date;
};

export function criarAppDoAdmin({ foto, banco, origem, origemDoCrm, agora = () => new Date() }: DependenciasDoAppDoAdmin): FastifyInstance {
  return criarApi({ banco, origem, portal: PORTAL_DO_ADMIN, agora }, (app) =>
    registrarRotasDoAdmin(app, { foto, banco, origens: { crm: origemDoCrm, admin: origem }, agora }),
  );
}
