import { CircleCheck, CirclePause, CirclePlus, TriangleAlert } from "lucide-react";
import type { Situacao } from "../dados/tipos";
import estilos from "./SituacaoCliente.module.css";

export const SITUACOES = {
  ativo: { rotulo: "Ativo", Icone: CircleCheck, tom: "ok" },
  em_risco: { rotulo: "Em risco", Icone: TriangleAlert, tom: "alerta" },
  parado: { rotulo: "Parado", Icone: CirclePause, tom: "critico" },
  novo: { rotulo: "Novo", Icone: CirclePlus, tom: "neutro" },
} as const;

/** Situação sempre com ícone e texto: nunca só pela cor. */
export function SituacaoCliente({ situacao }: { situacao: Situacao }) {
  const { rotulo, Icone, tom } = SITUACOES[situacao];
  return (
    <span className={`${estilos.selo} ${estilos[tom]}`}>
      <Icone size={14} strokeWidth={2.25} aria-hidden="true" />
      {rotulo}
    </span>
  );
}
