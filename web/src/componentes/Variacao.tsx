import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatarVariacao } from "../formato";
import estilos from "./Variacao.module.css";

type Props = {
  razao: number | null;
  /** Com o que se compara, ex.: "vs 2025". */
  referencia?: ReactNode;
};

const LIMITE_ESTAVEL = 0.005;

export function Variacao({ razao, referencia }: Props) {
  if (razao === null || !Number.isFinite(razao)) {
    return <span className={estilos.semDados} title="Dados insuficientes para comparar">—</span>;
  }
  const direcao = razao > LIMITE_ESTAVEL ? "alta" : razao < -LIMITE_ESTAVEL ? "queda" : "estavel";
  const Icone = { alta: ArrowUpRight, queda: ArrowDownRight, estavel: ArrowRight }[direcao];
  return (
    <span className={estilos.variacao}>
      <span className={estilos[direcao]}>
        <Icone size={14} strokeWidth={2.25} aria-hidden="true" />
        {formatarVariacao(razao)}
      </span>
      {referencia ? <span className={estilos.referencia}>{referencia}</span> : null}
    </span>
  );
}
