import type { ReactNode } from "react";
import { CirclePause, CirclePlus, Lightbulb, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { Analises } from "../dados/tipos";
import { Cartao } from "./Cartao";
import type { TomDoSelo } from "./Selo";

export type TipoDeAnalise = keyof Omit<Analises, "semestre">;

type Identidade = { rotulo: string; icone: LucideIcon; tom: TomDoSelo };

/** Nome, ícone e tom de cada análise: os mesmos no Início e nas Análises. */
export const ANALISES: Record<TipoDeAnalise, Identidade> = {
  pararam: { rotulo: "Pararam de comprar", icone: CirclePause, tom: "critico" },
  menos: { rotulo: "Comprando menos", icone: TrendingDown, tom: "alerta" },
  mais: { rotulo: "Comprando mais", icone: TrendingUp, tom: "ok" },
  novos: { rotulo: "Novos e reativados", icone: CirclePlus, tom: "novo" },
  mix: { rotulo: "Oportunidades de mix", icone: Lightbulb, tom: "neutro" },
};

type PropsDoCartao = { tipo: TipoDeAnalise; subtitulo: ReactNode; acoes?: ReactNode; children: ReactNode };

/** Cartão com o nome e o ícone da análise; o tom neutro é o padrão do cartão. */
export function CartaoDaAnalise({ tipo, subtitulo, acoes, children }: PropsDoCartao) {
  const { rotulo, icone, tom } = ANALISES[tipo];
  return (
    <Cartao titulo={rotulo} icone={icone} tom={tom === "neutro" ? undefined : tom} subtitulo={subtitulo} acoes={acoes}>
      {children}
    </Cartao>
  );
}
