import type { ReactNode } from "react";
import estilos from "./Indicador.module.css";

type Props = {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
};

/** Bloco de número (stat tile): rótulo, valor e, se houver, a comparação. */
export function Indicador({ rotulo, valor, detalhe }: Props) {
  return (
    <div className={estilos.indicador}>
      <p className={estilos.rotulo}>{rotulo}</p>
      <p className={estilos.valor}>{valor}</p>
      {detalhe ? <div className={estilos.detalhe}>{detalhe}</div> : null}
    </div>
  );
}
