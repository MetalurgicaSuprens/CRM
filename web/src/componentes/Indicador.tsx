import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import estilos from "./Indicador.module.css";

type Props = {
  rotulo: string;
  /** Acompanha o rótulo, sempre em tom neutro, como nos títulos dos cartões. */
  icone: LucideIcon;
  valor: ReactNode;
  detalhe?: ReactNode;
};

/** Bloco de número (stat tile): rótulo, valor e, se houver, a comparação. */
export function Indicador({ rotulo, icone: Icone, valor, detalhe }: Props) {
  return (
    <div className={estilos.indicador}>
      <p className={estilos.rotulo}>
        <span className={estilos.icone} aria-hidden="true">
          <Icone size={15} strokeWidth={1.75} />
        </span>
        {rotulo}
      </p>
      <p className={estilos.valor}>{valor}</p>
      {detalhe ? <div className={estilos.detalhe}>{detalhe}</div> : null}
    </div>
  );
}
