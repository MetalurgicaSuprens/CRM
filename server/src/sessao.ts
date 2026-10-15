/** Quem está usando o CRM e os códigos de representante que o login dele puxa (login/sessoes.ts). */
export type Sessao = {
  /** Só o id vai para o log, nunca o nome. */
  idDoUsuario: string;
  nome: string;
  codigos: string[];
};
