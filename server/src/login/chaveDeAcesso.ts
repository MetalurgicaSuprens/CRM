import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { ChaveGravada, NovaChave } from "./chaves.ts";
import type { Usuario } from "./usuarios.ts";

/*
 * A conferência da chave de acesso (WebAuthn) pelo pacote @simplewebauthn/server, o único arquivo
 * que o importa. As regras do plano (docs/plano.md, "Chave de acesso"): a chave fica presa ao domínio
 * do CRM, exige a digital, o rosto ou o PIN do aparelho, é residente (entra sem digitar nada) e não
 * pede atestação do fabricante.
 */

export type RespostaDeCriacao = RegistrationResponseJSON;
export type RespostaDeEntrada = AuthenticationResponseJSON;
export type OpcoesDeCriacao = PublicKeyCredentialCreationOptionsJSON;
export type OpcoesDeEntrada = PublicKeyCredentialRequestOptionsJSON;

/** Onde o CRM está: a origem que o navegador declara e o domínio (rpID) a que a chave fica presa. */
export type Site = { origem: string; rpId: string };

/** O resultado de uma conferência: o motivo da recusa vai para a auditoria. */
export type Conferencia<T> = { ok: true; valor: T } | { ok: false; motivo: string };

export type DesafioValido = (desafio: string) => boolean;

const NOME_DO_SITE = "CRM Suprens";
/** ES256 e RS256, que todo autenticador de chave de acesso aceita. Os pós-quânticos ficam para quando saírem de teste no Node. */
const ALGORITMOS = [-7, -257];
const TEMPO_PARA_O_APARELHO_MS = 120_000;
const TAMANHO_DO_MOTIVO = 200;

export function siteDaOrigem(origem: string): Site {
  return { origem, rpId: new URL(origem).hostname };
}

export function opcoesParaCriar(site: Site, usuario: Usuario, chavesAtivas: readonly { id: string; transportes: string[] }[]): Promise<OpcoesDeCriacao> {
  return generateRegistrationOptions({
    rpName: NOME_DO_SITE,
    rpID: site.rpId,
    userName: usuario.nome,
    userDisplayName: usuario.nome,
    userID: new Uint8Array(Buffer.from(usuario.idWebauthn, "base64url")),
    attestationType: "none",
    excludeCredentials: chavesAtivas.map(({ id, transportes }) => ({ id, transports: transportes })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    supportedAlgorithmIDs: ALGORITMOS,
    timeout: TEMPO_PARA_O_APARELHO_MS,
  });
}

export async function conferirCriacao(site: Site, resposta: RespostaDeCriacao, desafioValido: DesafioValido): Promise<Conferencia<Omit<NovaChave, "usuario">>> {
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: resposta,
      expectedChallenge: desafioValido,
      expectedOrigin: site.origem,
      expectedRPID: site.rpId,
      requireUserVerification: true,
      supportedAlgorithmIDs: ALGORITMOS,
    });
    if (!verified) return { ok: false, motivo: "não conferiu" };
    const { credential, aaguid, credentialDeviceType } = registrationInfo;
    return {
      ok: true,
      valor: {
        id: credential.id,
        chavePublica: credential.publicKey,
        contador: credential.counter,
        transportes: credential.transports ?? [],
        aaguid,
        sincronizada: credentialDeviceType === "multiDevice",
      },
    };
  } catch (erro) {
    return { ok: false, motivo: motivoDoErro(erro) };
  }
}

export function opcoesParaEntrar(site: Site): Promise<OpcoesDeEntrada> {
  return generateAuthenticationOptions({ rpID: site.rpId, userVerification: "required", timeout: TEMPO_PARA_O_APARELHO_MS });
}

export async function conferirEntrada(
  site: Site,
  resposta: RespostaDeEntrada,
  { chave, desafioValido }: { chave: ChaveGravada; desafioValido: DesafioValido },
): Promise<Conferencia<{ contador: number }>> {
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: resposta,
      expectedChallenge: desafioValido,
      expectedOrigin: site.origem,
      expectedRPID: site.rpId,
      credential: { id: chave.id, publicKey: new Uint8Array(chave.chavePublica), counter: chave.contador, transports: chave.transportes },
      requireUserVerification: true,
    });
    return verified ? { ok: true, valor: { contador: authenticationInfo.newCounter } } : { ok: false, motivo: "não conferiu" };
  } catch (erro) {
    return { ok: false, motivo: motivoDoErro(erro) };
  }
}

/** O pacote recusa lançando erro; a mensagem dele é o motivo, curto, para a auditoria. */
function motivoDoErro(erro: unknown): string {
  return (erro instanceof Error ? erro.message : String(erro)).slice(0, TAMANHO_DO_MOTIVO);
}
