import { CircleCheck, CircleOff, CirclePause, CirclePlus, TriangleAlert } from "lucide-react";
import type { Semestre, Situacao } from "../dados/tipos";
import { formatarSemestres } from "../formato";
import { Selo } from "./Selo";
import { Variacao } from "./Variacao";
import estilos from "./SituacaoCliente.module.css";

/** Nome, ícone e tom de cada situação: os mesmos no selo e nos filtros da carteira. */
export const SITUACOES = {
  ativo: { rotulo: "Ativo", icone: CircleCheck, tom: "ok" },
  em_risco: { rotulo: "Em risco", icone: TriangleAlert, tom: "alerta" },
  parado: { rotulo: "Parado", icone: CirclePause, tom: "critico" },
  novo: { rotulo: "Novo", icone: CirclePlus, tom: "novo" },
  perdido: { rotulo: "Perdido", icone: CircleOff, tom: "neutro" },
} as const;

type Props = {
  situacao: Situacao;
  /** "grande" ao lado do nome, na ficha do cliente. */
  tamanho?: "normal" | "grande";
};

export function SituacaoCliente({ situacao, tamanho }: Props) {
  return <Selo {...SITUACOES[situacao]} tamanho={tamanho} />;
}

/**
 * Junto do selo "Em risco", o que pôs o cliente nele: "−23% em abr–set/26 vs abr–set/25". Sem a
 * base à mostra, a queda do semestre parecia contradizer a variação de 12 meses ao lado.
 */
export function MotivoDoRisco({ queda, semestre }: { queda: number | null; semestre: Semestre }) {
  if (queda === null) return null;
  const { atual, anterior } = formatarSemestres(semestre);
  const referencia = (
    <>
      <span className={estilos.periodo}>em {atual}</span> <span className={estilos.periodo}>vs {anterior}</span>
    </>
  );
  return <Variacao razao={queda} referencia={referencia} />;
}
