import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import estilos from "./Indicador.module.css";

type Props = {
  rotulo: string;
  /** Acompanha o rótulo, no mesmo selo dos títulos dos cartões. */
  icone: LucideIcon;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** O número principal da tela, no visual do filtro escolhido. Um por tela. */
  destaque?: boolean;
};

/** Bloco de número (stat tile): rótulo, valor e, se houver, a comparação. */
export function Indicador({ rotulo, icone: Icone, valor, detalhe, destaque = false }: Props) {
  return (
    <div className={destaque ? `${estilos.indicador} ${estilos.destaque}` : estilos.indicador}>
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
