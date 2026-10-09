import type { LucideIcon } from "lucide-react";
import type { TomDoSelo } from "./Selo";
import estilos from "./IconeNoCirculo.module.css";

type Props = {
  icone: LucideIcon;
  tom: TomDoSelo;
  /** Para mudar o tamanho (width e height); o ícone acompanha. */
  className?: string;
};

/** Ícone num círculo com o fundo do tom, nos mesmos tons dos selos. */
export function IconeNoCirculo({ icone: Icone, tom, className }: Props) {
  return (
    <span className={`${estilos.circulo} ${estilos[tom]} ${className ?? ""}`} aria-hidden="true">
      <Icone strokeWidth={2} />
    </span>
  );
}
