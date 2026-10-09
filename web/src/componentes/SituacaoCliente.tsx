import { CircleCheck, CircleOff, CirclePause, CirclePlus, TriangleAlert } from "lucide-react";
import type { Situacao } from "../dados/tipos";
import { Selo } from "./Selo";

/** Nome, ícone e tom de cada situação: os mesmos no selo e nos filtros da carteira. */
export const SITUACOES = {
  ativo: { rotulo: "Ativo", icone: CircleCheck, tom: "ok" },
  em_risco: { rotulo: "Em risco", icone: TriangleAlert, tom: "alerta" },
  parado: { rotulo: "Parado", icone: CirclePause, tom: "critico" },
  novo: { rotulo: "Novo", icone: CirclePlus, tom: "neutro" },
  inativo: { rotulo: "Inativo", icone: CircleOff, tom: "neutro" },
} as const;

type Props = {
  situacao: Situacao;
  /** "grande" ao lado do nome, na ficha do cliente. */
  tamanho?: "normal" | "grande";
};

export function SituacaoCliente({ situacao, tamanho }: Props) {
  return <Selo {...SITUACOES[situacao]} tamanho={tamanho} />;
}
