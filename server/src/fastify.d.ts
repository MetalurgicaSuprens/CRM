import "fastify";
import type { Acesso } from "./acesso.ts";
import type { Sessao } from "./sessao.ts";

declare module "fastify" {
  interface FastifyContextConfig {
    acesso?: Acesso;
    /** "login": a rota conta no limite de requisições por IP do login e dos convites (app.ts). */
    limite?: "login";
  }

  interface FastifyRequest {
    sessao: Sessao | null;
  }

  interface FastifyInstance {
    /** As rotas registradas, para o teste de escopo percorrer todas. */
    rotasRegistradas: { metodo: string; url: string; acesso: Acesso }[];
  }
}
