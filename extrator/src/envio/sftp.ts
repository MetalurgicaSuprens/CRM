import { spawn } from "node:child_process";
import path from "node:path";

/*
 * O programa de envio seguro do OpenSSH, que vem no Windows: o único caminho do extrator até o
 * servidor do CRM (docs/plano.md, "SFTP"). Ele só fala com o servidor cuja chave o extrator já
 * conhece, só entra com a chave do extrator e nunca pergunta nada.
 */

export type DestinoDoEnvio = {
  endereco: string;
  porta: number;
  usuario: string;
  /** A chave privada do extrator. Só a conta do extrator pode lê-la; senão, o programa a recusa. */
  chave: string;
  /** A chave do servidor, numa linha do formato do known_hosts, com o apelido APELIDO_DO_SERVIDOR. */
  servidorConhecido: string;
};

/** O envio não aconteceu; a mensagem é para quem rodou o extrator. */
export class ErroNoEnvio extends Error {}

/** A chave conhecida vale para este apelido, qualquer que seja o endereço do servidor. */
export const APELIDO_DO_SERVIDOR = "crm-servidor";

const LIMITE_DE_TEMPO_MS = 10 * 60_000;

/** Os motivos de falha mais comuns, na língua de quem rodou o extrator. */
const FALHAS_CONHECIDAS: readonly [RegExp, string][] = [
  [/host key verification failed|remote host identification has changed/i,"o servidor não mostrou a chave conhecida, e o envio parou: pode ser outro computador no lugar do servidor do CRM."],
  [/bad permissions|unprotected private key/i, "a chave do extrator pode ser lida por outros usuários deste computador, e o programa de envio a recusou."],
  [/permission denied \(publickey/i, "o servidor não aceitou a chave do extrator."],
  [/connection refused|timed out|could not resolve|no route to host|network is unreachable/i, "não deu para falar com o servidor."],
];

/** O programa do Windows, e não o que outro programa (como o Git) pôs antes no PATH. */
export function programaDoOpenSsh(nome: string): string {
  if (process.platform !== "win32") return nome;
  return path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "OpenSSH", `${nome}.exe`);
}

/** Roda os comandos numa conversa só e devolve o que o programa escreveu. Os arquivos locais são relativos a `pastaLocal`. */
export function executarSftp(destino: DestinoDoEnvio, comandos: readonly string[], pastaLocal: string): Promise<string> {
  const programa = programaDoOpenSsh("sftp");
  return new Promise((pronto, falhou) => {
    const processo = spawn(programa, argumentos(destino), { cwd: pastaLocal, windowsHide: true });
    let saida = "";
    let avisos = "";
    const limite = setTimeout(() => processo.kill(), LIMITE_DE_TEMPO_MS);
    processo.stdout.setEncoding("utf8").on("data", (pedaco: string) => (saida += pedaco));
    processo.stderr.setEncoding("utf8").on("data", (pedaco: string) => (avisos += pedaco));
    processo.on("error", (erro) => {
      clearTimeout(limite);
      falhou(new ErroNoEnvio(`Não deu para abrir o programa de envio (${programa}): ${erro.message}`));
    });
    processo.on("close", (codigo) => {
      clearTimeout(limite);
      if (codigo === 0) pronto(saida);
      else falhou(new ErroNoEnvio(explicarFalha(destino, avisos)));
    });
    processo.stdin.end(`${comandos.join("\n")}\n`);
  });
}

/** O OpenSSH lê a barra invertida como escape: os caminhos vão com a barra comum, que o Windows aceita. */
function argumentos(destino: DestinoDoEnvio): string[] {
  const comBarraComum = (caminho: string) => caminho.replaceAll("\\", "/");
  const opcoes = [
    "IdentitiesOnly=yes",
    "BatchMode=yes",
    "StrictHostKeyChecking=yes",
    `UserKnownHostsFile="${comBarraComum(destino.servidorConhecido)}"`,
    "GlobalKnownHostsFile=none",
    `HostKeyAlias=${APELIDO_DO_SERVIDOR}`,
    "UpdateHostKeys=no",
    "ConnectTimeout=20",
    "ServerAliveInterval=15",
    "ServerAliveCountMax=4",
  ];
  return [
    // Os comandos vêm pela entrada, e o primeiro que falha encerra a conversa.
    "-b",
    "-",
    // Nenhum arquivo de configuração de fora muda o destino ou a chave.
    "-F",
    "none",
    "-P",
    String(destino.porta),
    "-i",
    comBarraComum(destino.chave),
    ...opcoes.flatMap((opcao) => ["-o", opcao]),
    `${destino.usuario}@${destino.endereco}`,
  ];
}

function explicarFalha(destino: DestinoDoEnvio, avisos: string): string {
  const conhecida = FALHAS_CONHECIDAS.find(([padrao]) => padrao.test(avisos));
  const detalhe = avisos.trim().split(/\r?\n/).at(-1) ?? "";
  return [`O envio para ${destino.endereco} falhou: ${conhecida?.[1] ?? "o programa de envio parou com erro."}`, `  detalhe: ${detalhe}`].join("\n");
}
