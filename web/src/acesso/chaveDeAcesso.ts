/*
 * A chave de acesso no navegador (WebAuthn), sem pacote: as opções chegam do servidor em JSON, com
 * os binários em base64url, e a resposta volta no mesmo formato, o JSON da especificação, que o
 * servidor confere (server/src/login/chaveDeAcesso.ts). Feito à mão porque o
 * PublicKeyCredential.parseCreationOptionsFromJSON ainda não existe no iOS 16.
 */

type DescritorJSON = { id: string; type: "public-key"; transports?: string[] };

export type OpcoesDeCriacaoJSON = Omit<PublicKeyCredentialCreationOptions, "challenge" | "user" | "excludeCredentials"> & {
  challenge: string;
  user: { id: string; name: string; displayName: string };
  excludeCredentials?: DescritorJSON[];
};

export type OpcoesDeEntradaJSON = Omit<PublicKeyCredentialRequestOptions, "challenge" | "allowCredentials"> & {
  challenge: string;
  allowCredentials?: DescritorJSON[];
};

type CredencialJSON<Resposta> = {
  id: string;
  rawId: string;
  type: "public-key";
  authenticatorAttachment?: string;
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  response: Resposta;
};

export type CredencialCriadaJSON = CredencialJSON<{ clientDataJSON: string; attestationObject: string; transports: string[] }>;
export type CredencialUsadaJSON = CredencialJSON<{ clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string }>;

const SEM_SUPORTE = "Este navegador não aceita chave de acesso. Abra o CRM no Chrome, no Edge ou no Safari, atualizados.";

/** Pede ao aparelho uma chave nova, presa ao domínio do CRM; ele confirma com a digital, o rosto ou o PIN. */
export async function criarChave(opcoes: OpcoesDeCriacaoJSON): Promise<CredencialCriadaJSON> {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...opcoes,
    challenge: deBase64Url(opcoes.challenge),
    user: { ...opcoes.user, id: deBase64Url(opcoes.user.id) },
    excludeCredentials: opcoes.excludeCredentials?.map(descritor),
  };
  const credencial = await pedirAoAparelho(() => navigator.credentials.create({ publicKey }));
  const resposta = credencial.response as AuthenticatorAttestationResponse;
  return {
    ...identificacao(credencial),
    response: {
      clientDataJSON: paraBase64Url(resposta.clientDataJSON),
      attestationObject: paraBase64Url(resposta.attestationObject),
      // O Safari antigo não tem getTransports: o servidor aceita sem.
      transports: typeof resposta.getTransports === "function" ? resposta.getTransports() : [],
    },
  };
}

/** Pede ao aparelho para assinar a entrada com uma chave do CRM; ele mostra as que tem e confirma com a digital, o rosto ou o PIN. */
export async function usarChave(opcoes: OpcoesDeEntradaJSON): Promise<CredencialUsadaJSON> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...opcoes,
    challenge: deBase64Url(opcoes.challenge),
    allowCredentials: opcoes.allowCredentials?.map(descritor),
  };
  const credencial = await pedirAoAparelho(() => navigator.credentials.get({ publicKey }));
  const resposta = credencial.response as AuthenticatorAssertionResponse;
  return {
    ...identificacao(credencial),
    response: {
      clientDataJSON: paraBase64Url(resposta.clientDataJSON),
      authenticatorData: paraBase64Url(resposta.authenticatorData),
      signature: paraBase64Url(resposta.signature),
      ...(resposta.userHandle ? { userHandle: paraBase64Url(resposta.userHandle) } : {}),
    },
  };
}

/** O erro do aparelho, na língua de quem está usando. */
export function explicarErro(erro: unknown): Error {
  const nome = erro instanceof DOMException ? erro.name : "";
  if (nome === "NotAllowedError") return new Error("A chave de acesso não foi usada: o pedido foi cancelado ou o tempo acabou. Tente de novo.");
  if (nome === "InvalidStateError") return new Error("Este aparelho já tem uma chave do CRM para este login. Entre pela tela de entrada.");
  if (nome === "NotSupportedError" || nome === "SecurityError") return new Error(SEM_SUPORTE);
  return new Error("A chave de acesso não funcionou neste aparelho. Tente de novo.");
}

export function paraBase64Url(dados: ArrayBuffer): string {
  let binario = "";
  for (const byte of new Uint8Array(dados)) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64Url(texto: string): ArrayBuffer {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binario, (letra) => letra.charCodeAt(0)).buffer;
}

async function pedirAoAparelho(pedido: () => Promise<Credential | null>): Promise<PublicKeyCredential> {
  if (typeof PublicKeyCredential === "undefined") throw new Error(SEM_SUPORTE);
  let credencial: Credential | null;
  try {
    credencial = await pedido();
  } catch (erro) {
    throw explicarErro(erro);
  }
  if (!(credencial instanceof PublicKeyCredential)) throw explicarErro(null);
  return credencial;
}

function descritor({ id, transports }: DescritorJSON): PublicKeyCredentialDescriptor {
  return { id: deBase64Url(id), type: "public-key", transports: transports as AuthenticatorTransport[] | undefined };
}

function identificacao(credencial: PublicKeyCredential) {
  return {
    id: credencial.id,
    rawId: paraBase64Url(credencial.rawId),
    type: "public-key" as const,
    ...(credencial.authenticatorAttachment ? { authenticatorAttachment: credencial.authenticatorAttachment } : {}),
    clientExtensionResults: credencial.getClientExtensionResults(),
  };
}
