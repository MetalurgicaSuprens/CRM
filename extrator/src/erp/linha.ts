import type { Linha } from "../oracle.ts";
import type { CfopDoErp, TransportadoraDaNota } from "./tipos.ts";

/*
 * Leitura das colunas de uma linha do Oracle, na ordem do SELECT.
 */

export function texto(linha: Linha, coluna: number): string {
  return String(linha[coluna] ?? "");
}

export function textoOuNulo(linha: Linha, coluna: number): string | null {
  const valor = linha[coluna];
  return valor === null || valor === undefined || String(valor).trim() === "" ? null : String(valor);
}

export function numero(linha: Linha, coluna: number): number {
  const valor = Number(linha[coluna] ?? 0);
  return Number.isFinite(valor) ? valor : 0;
}

/** Chave do cliente no ERP (empresa e código). Só existe na LAN; a foto leva o id opaco. */
export function chaveDoCliente(empresa: number, cliente: number): string {
  return `${empresa}/${cliente}`;
}

/** O CFOP na coluna e a descrição na seguinte; null sem CFOP (0 ou vazio). */
export function cfopDa(linha: Linha, coluna: number): CfopDoErp | null {
  const codigo = numero(linha, coluna);
  return codigo > 0 ? { codigo: String(codigo), descricao: textoOuNulo(linha, coluna + 1) } : null;
}

/** O código da transportadora na coluna, a fantasia e a razão social nas seguintes (COLUNAS_DA_TRANSPORTADORA); null sem transportadora. */
export function transportadoraDa(linha: Linha, coluna: number): TransportadoraDaNota | null {
  const codigo = numero(linha, coluna);
  return codigo > 0 ? { codigo: String(codigo), fantasia: textoOuNulo(linha, coluna + 1), razaoSocial: textoOuNulo(linha, coluna + 2) } : null;
}
