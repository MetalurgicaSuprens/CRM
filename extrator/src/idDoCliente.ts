import crypto from "node:crypto";

const CARACTERES_DO_ID = 16;

/**
 * Id do cliente no CRM: endereço da ficha, rascunhos e auditoria. É um HMAC da empresa e do código
 * do ERP com uma chave que só existe na LAN, então não revela CPF nem CNPJ e não muda entre fotos.
 */
export function idDoCliente(chave: Buffer, empresa: number, cliente: number): string {
  return crypto.createHmac("sha256", chave).update(`${empresa}/${cliente}`).digest("hex").slice(0, CARACTERES_DO_ID);
}

/** Id do grupo do SGI na carteira de um representante, do mesmo jeito: não muda entre fotos. */
export function idDoGrupo(chave: Buffer, representante: string, nome: string): string {
  return crypto.createHmac("sha256", chave).update(`grupo/${representante}/${nome}`).digest("hex").slice(0, CARACTERES_DO_ID);
}
