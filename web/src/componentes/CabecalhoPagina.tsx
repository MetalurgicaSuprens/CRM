import type { ReactNode } from "react";
import estilos from "./CabecalhoPagina.module.css";

type Props = {
  titulo: string;
  /** Fica na mesma linha do título, logo depois dele (ex.: a situação do cliente). */
  selo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  antes?: ReactNode;
};

export function CabecalhoPagina({ titulo, selo, descricao, acoes, antes }: Props) {
  return (
    <header className={estilos.cabecalho}>
      {antes ? <div className={estilos.antes}>{antes}</div> : null}
      <div className={estilos.linha}>
        <div className={estilos.textos}>
          <div className={estilos.tituloComSelo}>
            <h1 className={estilos.titulo}>{titulo}</h1>
            {selo}
          </div>
          {descricao ? <div className={estilos.descricao}>{descricao}</div> : null}
        </div>
        {acoes ? <div className={estilos.acoes}>{acoes}</div> : null}
      </div>
    </header>
  );
}
