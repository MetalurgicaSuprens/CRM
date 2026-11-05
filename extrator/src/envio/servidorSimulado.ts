import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ssh2, { type SftpDoServidor } from "ssh2";

/*
 * Um servidor de troca de arquivos de mentira, para os testes do envio: aceita só um usuário, com
 * uma chave, e prende o que ele vê numa pasta, como a conta de troca do servidor de verdade
 * (docs/plano.md, "SFTP"). Atende só o que o envio usa: gravar, listar, renomear e apagar.
 */

const { Server, utils } = ssh2;
const { STATUS_CODE } = utils.sftp;

export type ServidorSimulado = {
  porta: number;
  /** A chave pública deste servidor, "ssh-ed25519 AAAA...", que o extrator precisa conhecer. */
  chavePublica: string;
  /** O que mudou no servidor, em ordem: "rename /entrada/a.part /entrada/a", "remove /entrada/b". */
  operacoes: string[];
  fechar(): Promise<void>;
};

export type ConfiguracaoDoServidorSimulado = {
  /** A pasta que faz de "/" para quem entra. */
  raiz: string;
  usuario: string;
  /** A chave pública que pode entrar, "ssh-ed25519 AAAA... comentário". */
  chaveAutorizada: string;
};

type Aberto = { tipo: "arquivo"; descritor: number } | { tipo: "pasta"; nomes: string[] | null; caminho: string };

export function abrirServidorSimulado({ raiz, usuario, chaveAutorizada }: ConfiguracaoDoServidorSimulado): Promise<ServidorSimulado> {
  const chaveDoServidor = utils.generateKeyPairSync("ed25519");
  const autorizada = utils.parseKey(chaveAutorizada);
  if (autorizada instanceof Error) throw autorizada;
  const operacoes: string[] = [];
  const conexoes = new Set<{ end(): void }>();
  const servidor = new Server({ hostKeys: [chaveDoServidor.private] }, (cliente) => {
    conexoes.add(cliente);
    cliente.on("close", () => conexoes.delete(cliente));
    cliente.on("error", () => {});
    cliente.on("authentication", (contexto) => {
      const isAChave =
        contexto.method === "publickey" &&
        contexto.username === usuario &&
        contexto.key?.algo === autorizada.type &&
        contexto.key.data.length === autorizada.getPublicSSH().length &&
        crypto.timingSafeEqual(contexto.key.data, autorizada.getPublicSSH());
      if (!isAChave) return contexto.reject(["publickey"]);
      if (!contexto.signature || !contexto.blob) return contexto.accept();
      return autorizada.verify(contexto.blob, contexto.signature, contexto.hashAlgo) === true ? contexto.accept() : contexto.reject(["publickey"]);
    });
    cliente.on("session", (aceitar) => {
      aceitar().on("sftp", (aceitarSftp) => atenderSftp(aceitarSftp(), raiz, operacoes));
    });
  });
  return new Promise((pronto) => {
    servidor.listen(0, "127.0.0.1", () =>
      pronto({
        porta: servidor.address().port,
        chavePublica: chaveDoServidor.public.trim(),
        operacoes,
        fechar: () =>
          new Promise((fechado) => {
            for (const conexao of conexoes) conexao.end();
            servidor.close(() => fechado());
          }),
      }),
    );
  });
}

function atenderSftp(sftp: SftpDoServidor, raiz: string, operacoes: string[]): void {
  const abertos = new Map<string, Aberto>();
  let proximoHandle = 0;
  const abrir = (aberto: Aberto): Buffer => {
    const handle = Buffer.from(String(proximoHandle++));
    abertos.set(handle.toString(), aberto);
    return handle;
  };
  const responder = (pedido: number, acao: () => void): void => {
    try {
      acao();
    } catch (erro) {
      const codigo = (erro as NodeJS.ErrnoException).code === "ENOENT" ? STATUS_CODE.NO_SUCH_FILE : STATUS_CODE.FAILURE;
      sftp.status(pedido, codigo);
    }
  };
  const local = (caminho: string): string => caminhoDentroDaRaiz(raiz, caminho);
  const ok = (pedido: number) => sftp.status(pedido, STATUS_CODE.OK);

  // Quem envia terminou: o servidor fecha a conversa, como o de verdade, senão o programa de envio fica esperando.
  sftp.on("end", () => sftp.end());

  sftp.on("REALPATH", (pedido, caminho) => {
    const absoluto = path.posix.resolve("/", caminho);
    sftp.name(pedido, [{ filename: absoluto, longname: absoluto, attrs: {} }]);
  });
  sftp.on("STAT", (pedido, caminho) => responder(pedido, () => sftp.attrs(pedido, atributos(fs.statSync(local(caminho))))));
  sftp.on("LSTAT", (pedido, caminho) => responder(pedido, () => sftp.attrs(pedido, atributos(fs.statSync(local(caminho))))));
  sftp.on("OPEN", (pedido, caminho, flags) =>
    responder(pedido, () => sftp.handle(pedido, abrir({ tipo: "arquivo", descritor: fs.openSync(local(caminho), utils.sftp.flagsToString(flags) ?? "r") }))),
  );
  sftp.on("WRITE", (pedido, handle, posicao, dados) =>
    responder(pedido, () => {
      fs.writeSync(descritorDe(abertos, handle), dados, 0, dados.length, posicao);
      ok(pedido);
    }),
  );
  sftp.on("FSTAT", (pedido, handle) => responder(pedido, () => sftp.attrs(pedido, atributos(fs.fstatSync(descritorDe(abertos, handle))))));
  sftp.on("FSETSTAT", (pedido) => ok(pedido));
  sftp.on("SETSTAT", (pedido) => ok(pedido));
  sftp.on("OPENDIR", (pedido, caminho) =>
    responder(pedido, () => {
      const pasta = local(caminho);
      if (!fs.statSync(pasta).isDirectory()) throw new Error("não é pasta");
      sftp.handle(pedido, abrir({ tipo: "pasta", nomes: null, caminho: pasta }));
    }),
  );
  sftp.on("READDIR", (pedido, handle) =>
    responder(pedido, () => {
      const aberto = abertos.get(handle.toString());
      if (aberto?.tipo !== "pasta") throw new Error("handle de pasta desconhecido");
      if (aberto.nomes !== null) return sftp.status(pedido, STATUS_CODE.EOF);
      aberto.nomes = fs.readdirSync(aberto.caminho);
      const pasta = aberto.caminho;
      sftp.name(pedido, aberto.nomes.map((nome) => ({ filename: nome, longname: nome, attrs: atributos(fs.statSync(path.join(pasta, nome))) })));
    }),
  );
  sftp.on("CLOSE", (pedido, handle) =>
    responder(pedido, () => {
      const aberto = abertos.get(handle.toString());
      if (aberto?.tipo === "arquivo") fs.closeSync(aberto.descritor);
      abertos.delete(handle.toString());
      ok(pedido);
    }),
  );
  sftp.on("REMOVE", (pedido, caminho) =>
    responder(pedido, () => {
      fs.rmSync(local(caminho));
      operacoes.push(`remove ${caminho}`);
      ok(pedido);
    }),
  );
  // Como o servidor de verdade sem a extensão posix-rename: não troca por cima de um arquivo que já existe.
  sftp.on("RENAME", (pedido, de, para) =>
    responder(pedido, () => {
      if (fs.existsSync(local(para))) throw new Error("o destino já existe");
      fs.renameSync(local(de), local(para));
      operacoes.push(`rename ${de} ${para}`);
      ok(pedido);
    }),
  );
}

function caminhoDentroDaRaiz(raiz: string, caminho: string): string {
  const local = path.join(raiz, path.posix.resolve("/", caminho));
  const relativo = path.relative(raiz, local);
  if (relativo.startsWith("..") || path.isAbsolute(relativo)) throw new Error("fora da raiz");
  return local;
}

function descritorDe(abertos: ReadonlyMap<string, Aberto>, handle: Buffer): number {
  const aberto = abertos.get(handle.toString());
  if (aberto?.tipo !== "arquivo") throw new Error("handle de arquivo desconhecido");
  return aberto.descritor;
}

function atributos(stats: fs.Stats): { mode: number; size: number; atime: number; mtime: number } {
  return { mode: stats.mode, size: stats.size, atime: Math.floor(stats.atimeMs / 1000), mtime: Math.floor(stats.mtimeMs / 1000) };
}
