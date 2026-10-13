import type { Linha } from "../oracle.ts";

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
