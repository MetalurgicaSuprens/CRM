import type { DatabaseSync } from "node:sqlite";
import { momentoEmBrasilia } from "dominio/datas";
import type { SituacaoDosDados } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { lerDadosDaFoto, texto } from "./linhas.ts";

/** A hora do dado, a data e o semestre da foto, o relógio de Brasília e o login da sessão. */
export function lerSituacao(db: DatabaseSync, sessao: Sessao, agora = new Date()): SituacaoDosDados {
  const foto = lerDadosDaFoto(db);
  return {
    atualizadoEm: texto(foto, "gerada_em"),
    hoje: texto(foto, "data_ref"),
    semestre: { inicio: texto(foto, "semestre_inicio"), fim: texto(foto, "semestre_fim") },
    relogio: momentoEmBrasilia(agora),
    representante: { nome: sessao.nome, codigos: sessao.codigos },
  };
}
