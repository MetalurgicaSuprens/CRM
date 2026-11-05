import type { DatabaseSync } from "node:sqlite";
import { contarLinhasPorTabela } from "dominio/manifestoDaFoto";

/** O que o extrator compara entre a foto nova e a anterior, e o que vai para o manifesto. */
export type ResumoDaFoto = {
  versaoDoEsquema: number;
  geradaEm: string;
  /** Os códigos autorizados, em ordem. */
  representantes: string[];
  /** A emissão da nota mais recente; null se a foto não tem nota. */
  notaMaisRecente: string | null;
  linhas: Record<string, number>;
};

/** Serve para foto de qualquer versão do esquema: a tabela `nota` só existe desde a 3. */
export function resumirFoto(db: DatabaseSync): ResumoDaFoto {
  const foto = db.prepare("SELECT versao_esquema, gerada_em FROM foto").get();
  const linhas = contarLinhasPorTabela(db);
  const maisRecente = linhas.nota === undefined ? undefined : db.prepare("SELECT MAX(emissao) AS emissao FROM nota").get()?.emissao;
  return {
    versaoDoEsquema: Number(foto?.versao_esquema),
    geradaEm: String(foto?.gerada_em),
    representantes: db
      .prepare("SELECT codigo FROM representante ORDER BY codigo")
      .all()
      .map((linha) => String(linha.codigo)),
    notaMaisRecente: typeof maisRecente === "string" ? maisRecente : null,
    linhas,
  };
}
