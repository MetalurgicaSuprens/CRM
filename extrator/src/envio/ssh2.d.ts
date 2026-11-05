/** O pedaço do pacote ssh2 que o servidor simulado dos testes usa (servidorSimulado.ts). O pacote não traz tipos. */
declare module "ssh2" {
  import type { EventEmitter } from "node:events";

  type ChavePublica = { type: string; getPublicSSH(): Buffer; verify(dados: Buffer, assinatura: Buffer, hashAlgo?: string): boolean | Error };
  type Atributos = { mode?: number; size?: number; atime?: number; mtime?: number };
  type Nome = { filename: string; longname: string; attrs: Atributos };

  export interface SftpDoServidor extends EventEmitter {
    handle(pedido: number, handle: Buffer): boolean;
    status(pedido: number, codigo: number, mensagem?: string): boolean;
    name(pedido: number, nomes: Nome[]): boolean;
    attrs(pedido: number, atributos: Atributos): boolean;
    end(): void;
    on(evento: "end", ouvinte: () => void): this;
    on(evento: "OPEN", ouvinte: (pedido: number, caminho: string, flags: number) => void): this;
    on(evento: "WRITE", ouvinte: (pedido: number, handle: Buffer, posicao: number, dados: Buffer) => void): this;
    on(evento: "CLOSE" | "FSTAT" | "READDIR" | "FSETSTAT", ouvinte: (pedido: number, handle: Buffer) => void): this;
    on(evento: "STAT" | "LSTAT" | "REALPATH" | "OPENDIR" | "REMOVE" | "SETSTAT", ouvinte: (pedido: number, caminho: string) => void): this;
    on(evento: "RENAME", ouvinte: (pedido: number, de: string, para: string) => void): this;
  }

  interface Sessao extends EventEmitter {
    on(evento: "sftp", ouvinte: (aceitar: () => SftpDoServidor) => void): this;
  }

  interface ContextoDeAutenticacao {
    method: string;
    username: string;
    key?: { algo: string; data: Buffer };
    signature?: Buffer;
    blob?: Buffer;
    hashAlgo?: string;
    accept(): void;
    reject(metodos?: string[]): void;
  }

  interface ConexaoDoCliente extends EventEmitter {
    on(evento: "authentication", ouvinte: (contexto: ContextoDeAutenticacao) => void): this;
    on(evento: "ready" | "close", ouvinte: () => void): this;
    on(evento: "error", ouvinte: (erro: Error) => void): this;
    on(evento: "session", ouvinte: (aceitar: () => Sessao) => void): this;
    end(): void;
  }

  class Server extends EventEmitter {
    constructor(configuracao: { hostKeys: string[] }, aoConectar: (cliente: ConexaoDoCliente) => void);
    listen(porta: number, endereco: string, pronto: () => void): this;
    address(): { port: number };
    close(pronto?: () => void): this;
  }

  /** O pacote é CommonJS: só se importa pelo default. */
  const ssh2: {
    Server: typeof Server;
    utils: {
      parseKey(chave: string): ChavePublica | Error;
      generateKeyPairSync(tipo: "ed25519"): { private: string; public: string };
      sftp: {
        STATUS_CODE: { OK: number; EOF: number; NO_SUCH_FILE: number; PERMISSION_DENIED: number; FAILURE: number; OP_UNSUPPORTED: number };
        flagsToString(flags: number): string | null;
      };
    };
  };

  export default ssh2;
}
