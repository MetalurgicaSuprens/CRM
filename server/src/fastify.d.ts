import "fastify";
import type { Acesso } from "./acesso.ts";
import type { Sessao } from "./sessao.ts";

declare module "fastify" {
  interface FastifyContextConfig {
    acesso?: Acesso;
  }

  interface FastifyRequest {
    sessao: Sessao | null;
  }

  interface FastifyInstance {
    /** As rotas registradas, para o teste de escopo percorrer todas. */
    rotasRegistradas: { metodo: string; url: string }[];
  }
}
