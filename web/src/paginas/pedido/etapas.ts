/*
 * As etapas do pedido no celular, onde o documento não cabe inteiro na tela: uma parte por vez, na
 * ordem em que o representante trabalha. No computador, todas as partes aparecem juntas e a etapa não
 * muda nada. A etapa fica no endereço (?etapa=), para o voltar do navegador voltar uma etapa.
 */

export const ETAPAS = ["cliente", "itens", "condicoes", "revisar"] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ROTULOS_DAS_ETAPAS: Record<Etapa, string> = { cliente: "Cliente", itens: "Itens", condicoes: "Condições", revisar: "Revisar" };

/** A etapa do endereço; sem ela, ou com uma que não existe, a primeira. */
export function etapaDoEndereco(valor: string | null): Etapa {
  return ETAPAS.find((etapa) => etapa === valor) ?? "cliente";
}

export function etapaSeguinte(etapa: Etapa): Etapa | null {
  return ETAPAS[ETAPAS.indexOf(etapa) + 1] ?? null;
}

export function etapaAnterior(etapa: Etapa): Etapa | null {
  return ETAPAS[ETAPAS.indexOf(etapa) - 1] ?? null;
}
