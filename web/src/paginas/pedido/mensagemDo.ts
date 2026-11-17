/** A mensagem do erro para a tela; o que não é um Error (a rede caiu) vira um pedido para tentar de novo. */
export function mensagemDo(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não deu para falar com o servidor. Tente de novo.";
}
