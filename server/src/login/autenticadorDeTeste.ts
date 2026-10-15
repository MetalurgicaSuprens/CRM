import { createHash, createSign, generateKeyPairSync, randomBytes, type KeyObject } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import type { OpcoesDeCriacao, OpcoesDeEntrada, RespostaDeCriacao, RespostaDeEntrada } from "./chaveDeAcesso.ts";

/*
 * Um aparelho de mentira para os testes: cria a chave e assina a entrada como um autenticador de
 * verdade (chave ES256, atestação "none", sincronizada no Google). Assim os testes passam pela
 * conferência inteira do pacote, sem atalho.
 */

/** O AAGUID do Gerenciador de Senhas do Google: a chave aparece como "Google". */
const AAGUID_DO_GOOGLE = Buffer.from("ea9b8d664d011d213ce4b6b48cb575d4", "hex");
const PRESENCA = 0x01;
const VERIFICACAO = 0x04;
const SINCRONIZAVEL = 0x08;
const SINCRONIZADA = 0x10;
const COM_CREDENCIAL = 0x40;
/** Chave EC2 na curva P-256 com ES256, no formato COSE. */
const COSE = { tipo: 1, algoritmo: 3, curva: -1, x: -2, y: -3, EC2: 2, ES256: -7, P256: 1 } as const;

type ValorCbor = Parameters<typeof isoCBOR.encode>[0];

export type AutenticadorDeTeste = {
  readonly idDaCredencial: string;
  criar(opcoes: OpcoesDeCriacao, origem: string): RespostaDeCriacao;
  usar(opcoes: OpcoesDeEntrada, origem: string): RespostaDeEntrada;
};

export function criarAutenticadorDeTeste(): AutenticadorDeTeste {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const idDaCredencial = randomBytes(16);
  let idDoUsuario = "";
  let contador = 0;
  return {
    idDaCredencial: idDaCredencial.toString("base64url"),
    criar(opcoes, origem) {
      idDoUsuario = opcoes.user.id;
      const flags = PRESENCA | VERIFICACAO | SINCRONIZAVEL | SINCRONIZADA | COM_CREDENCIAL;
      const dados = Buffer.concat([cabecalhoDosDados(opcoes.rp.id ?? "", flags, contador), credencialAtestada(idDaCredencial, publicKey)]);
      const atestacao = isoCBOR.encode(
        new Map<string | number, ValorCbor>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          ["authData", new Uint8Array(dados)],
        ]),
      );
      return {
        ...identificacao(idDaCredencial),
        response: {
          clientDataJSON: dadosDoCliente("webauthn.create", opcoes.challenge, origem).toString("base64url"),
          attestationObject: Buffer.from(atestacao).toString("base64url"),
          transports: ["internal", "hybrid"],
        },
      };
    },
    usar(opcoes, origem) {
      contador += 1;
      const dados = cabecalhoDosDados(opcoes.rpId ?? "", PRESENCA | VERIFICACAO | SINCRONIZAVEL | SINCRONIZADA, contador);
      const cliente = dadosDoCliente("webauthn.get", opcoes.challenge, origem);
      return {
        ...identificacao(idDaCredencial),
        response: {
          clientDataJSON: cliente.toString("base64url"),
          authenticatorData: dados.toString("base64url"),
          signature: assinar(privateKey, Buffer.concat([dados, createHash("sha256").update(cliente).digest()])).toString("base64url"),
          // Só a chave criada sabe de quem é; o aparelho que nunca criou uma não manda.
          ...(idDoUsuario ? { userHandle: idDoUsuario } : {}),
        },
      };
    },
  };
}

function identificacao(idDaCredencial: Buffer) {
  const id = idDaCredencial.toString("base64url");
  return { id, rawId: id, type: "public-key" as const, clientExtensionResults: {}, authenticatorAttachment: "platform" as const };
}

/** O que o navegador monta e o aparelho assina: o tipo da cerimônia, o desafio e a origem da página. */
function dadosDoCliente(tipo: string, desafio: string, origem: string): Buffer {
  return Buffer.from(JSON.stringify({ type: tipo, challenge: desafio, origin: origem, crossOrigin: false }));
}

/** Hash do rpID, flags e contador: o começo dos dados do autenticador. */
function cabecalhoDosDados(rpId: string, flags: number, contador: number): Buffer {
  const contadorEmBytes = Buffer.alloc(4);
  contadorEmBytes.writeUInt32BE(contador);
  return Buffer.concat([createHash("sha256").update(rpId).digest(), Buffer.from([flags]), contadorEmBytes]);
}

/** AAGUID, tamanho e id da credencial e a chave pública em COSE. */
function credencialAtestada(idDaCredencial: Buffer, chavePublica: KeyObject): Buffer {
  const { x, y } = chavePublica.export({ format: "jwk" });
  const cose = isoCBOR.encode(
    new Map<string | number, ValorCbor>([
      [COSE.tipo, COSE.EC2],
      [COSE.algoritmo, COSE.ES256],
      [COSE.curva, COSE.P256],
      [COSE.x, new Uint8Array(Buffer.from(x ?? "", "base64url"))],
      [COSE.y, new Uint8Array(Buffer.from(y ?? "", "base64url"))],
    ]),
  );
  const tamanho = Buffer.alloc(2);
  tamanho.writeUInt16BE(idDaCredencial.length);
  return Buffer.concat([AAGUID_DO_GOOGLE, tamanho, idDaCredencial, Buffer.from(cose)]);
}

/** ECDSA com SHA-256, em DER, como o WebAuthn pede. */
function assinar(chavePrivada: KeyObject, dados: Buffer): Buffer {
  return createSign("SHA256").update(dados).sign(chavePrivada);
}
