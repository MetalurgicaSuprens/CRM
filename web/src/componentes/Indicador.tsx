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
  const { fatia, icone } = medidasDaFatia(largura);
  const medidas = { "--largura": `${largura}px`, "--fatia": `${fatia}px`, "--icone": `${icone}px` } as CSSProperties;
  return (
    <div ref={referencia} className={classes} style={medidas}>
      <span className={estilos.icone} aria-hidden="true">
        <Icone strokeWidth={1.75} />
      </span>
      <p className={estilos.rotulo}>{rotulo}</p>
      <p className={estilos.valor}>{valor}</p>
      {detalhe ? <div className={estilos.detalhe}>{detalhe}</div> : null}
    </div>
  );
}

/**
 * A fatia tem cerca de 26% da largura do bloco (de 56 a 88 px) e o ícone, cerca de 44% da fatia.
 * Os dois em múltiplos de 8 px: a sobra de cada lado fica em pixel inteiro, e o ícone cai no
 * centro exato também em telas com escala de 125% e 150%.
 */
function medidasDaFatia(largura: number): { fatia: number; icone: number } {
  const fatia = multiploDe8(Math.min(88, Math.max(56, largura * 0.26)));
  return { fatia, icone: multiploDe8(fatia * 0.44) };
}

function multiploDe8(px: number): number {
  return Math.round(px / 8) * 8;
}
