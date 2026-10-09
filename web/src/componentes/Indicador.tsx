import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useLargura } from "../graficos/useLargura";
import estilos from "./Indicador.module.css";

type Props = {
  rotulo: string;
  /** Com espaço, vira uma fatia à esquerda, da altura do bloco; no bloco estreito, fica ao lado do rótulo. */
  icone: LucideIcon;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** O número principal da tela, no visual do filtro escolhido. Um por tela. */
  destaque?: boolean;
};

/** Abaixo desta largura (em px, sem os recuos) a fatia não cabe ao lado do valor: o bloco do celular. */
const LARGURA_MINIMA_PARA_A_FATIA = 180;

/** Bloco de número (stat tile): ícone, rótulo, valor e, se houver, a comparação. */
export function Indicador({ rotulo, icone: Icone, valor, detalhe, destaque = false }: Props) {
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const estreito = largura > 0 && largura < LARGURA_MINIMA_PARA_A_FATIA;
  const classes = [estilos.indicador, destaque ? estilos.destaque : "", estreito ? estilos.estreito : ""].filter(Boolean).join(" ");
  return (
    <div ref={referencia} className={classes} style={{ "--largura": `${largura}px` } as CSSProperties}>
      <span className={estilos.icone} aria-hidden="true">
        <Icone strokeWidth={1.75} />
      </span>
      <p className={estilos.rotulo}>{rotulo}</p>
      <p className={estilos.valor}>{valor}</p>
      {detalhe ? <div className={estilos.detalhe}>{detalhe}</div> : null}
    </div>
  );
}
