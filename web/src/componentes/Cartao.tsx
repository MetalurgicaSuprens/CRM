import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { TomDoSelo } from "./Selo";
import estilos from "./Cartao.module.css";

type Props = {
  titulo: string;
  /** Acompanha o título, em tom neutro: a cor fica com os dados. */
  icone: LucideIcon;
  /** Só quando o cartão repete uma situação que já aparece com essa cor na tela. */
  tom?: Exclude<TomDoSelo, "neutro">;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Cartao({ titulo, icone: Icone, tom, subtitulo, acoes, children, className }: Props) {
  return (
    <section className={className ? `${estilos.cartao} ${className}` : estilos.cartao}>
      <header className={estilos.cabecalho}>
        <div className={estilos.identificacao}>
          <span className={tom ? `${estilos.icone} ${estilos[tom]}` : estilos.icone} aria-hidden="true">
            <Icone size={18} strokeWidth={1.75} />
          </span>
          <div className={estilos.titulos}>
            <h2 className={estilos.titulo}>{titulo}</h2>
            {subtitulo ? <p className={estilos.subtitulo}>{subtitulo}</p> : null}
          </div>
        </div>
        {acoes ? <div className={estilos.acoes}>{acoes}</div> : null}
      </header>
      {children}
    </section>
  );
}
