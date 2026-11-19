/** Quem está usando o CRM e os códigos de representante que o login dele puxa (login/sessoes.ts). */
export type Sessao = {
  /** Só o id vai para o log, nunca o nome. */
  idDoUsuario: string;
  nome: string;
  codigos: string[];
};

/** A sessão de uma rota de representante, que só chega à rota com ela (app.ts barra antes com 401). */
export function sessaoDa(requisicao: { sessao: Sessao | null }): Sessao {
  if (!requisicao.sessao) throw new Error("Rota de representante sem sessão.");
  return requisicao.sessao;
}
