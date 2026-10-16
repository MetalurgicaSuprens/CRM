/*
 * O que toda chamada à API do servidor faz igual, no CRM e na administração: a mensagem de erro que
 * o servidor manda e a volta para a entrada quando a sessão não existe mais.
 */

export async function mensagemDeErro(resposta: Response): Promise<string> {
  const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
  return corpo?.erro ?? `O servidor respondeu ${resposta.status}.`;
}

/**
 * Sem sessão, porque ainda não entrou ou porque ela terminou: volta para a entrada do próprio site,
 * que explica o motivo. A carga recomeça do zero, sem nada do login anterior na memória, e a tela que
 * pediu os dados fica esperando até a troca de página.
 */
export async function irParaAEntrada(resposta: Response): Promise<never> {
  const corpo = (await resposta.json().catch(() => null)) as { motivo?: string | null } | null;
  window.location.replace(corpo?.motivo ? `/entrar?motivo=${encodeURIComponent(corpo.motivo)}` : "/entrar");
  return new Promise<never>(() => {});
}
