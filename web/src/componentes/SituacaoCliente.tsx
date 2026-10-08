import { CircleCheck, CirclePause, CirclePlus, TriangleAlert } from "lucide-react";
import type { Situacao } from "../dados/tipos";
import estilos from "./SituacaoCliente.module.css";

export const SITUACOES = {
  ativo: { rotulo: "Ativo", Icone: CircleCheck, tom: "ok" },
  em_risco: { rotulo: "Em risco", Icone: TriangleAlert, tom: "alerta" },
  parado: { rotulo: "Parado", Icone: CirclePause, tom: "critico" },
  novo: { rotulo: "Novo", Icone: CirclePlus, tom: "neutro" },
} as const;

type Props = {
  situacao: Situacao;
  /** "grande" ao lado do nome, na ficha do cliente. */
  tamanho?: "normal" | "grande";
};

/** Situação sempre com ícone e texto: nunca só pela cor. */
export function SituacaoCliente({ situacao, tamanho = "normal" }: Props) {
  const { rotulo, Icone, tom } = SITUACOES[situacao];
  const grande = tamanho === "grande";
  return (
    <span className={`${estilos.selo} ${estilos[tom]} ${grande ? estilos.grande : ""}`}>
      <Icone size={grande ? 17 : 14} strokeWidth={2.25} aria-hidden="true" />
      {rotulo}
    </span>
  );
}
