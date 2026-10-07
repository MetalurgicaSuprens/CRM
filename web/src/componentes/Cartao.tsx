import type { ReactNode } from "react";
import estilos from "./Cartao.module.css";

type Props = {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Cartao({ titulo, subtitulo, acoes, children, className }: Props) {
  return (
    <section className={className ? `${estilos.cartao} ${className}` : estilos.cartao}>
      <header className={estilos.cabecalho}>
        <div className={estilos.titulos}>
          <h2 className={estilos.titulo}>{titulo}</h2>
          {subtitulo ? <p className={estilos.subtitulo}>{subtitulo}</p> : null}
        </div>
        {acoes ? <div className={estilos.acoes}>{acoes}</div> : null}
      </header>
      {children}
    </section>
  );
}
