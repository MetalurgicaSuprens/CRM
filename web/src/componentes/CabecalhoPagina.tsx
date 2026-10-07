import type { ReactNode } from "react";
import estilos from "./CabecalhoPagina.module.css";

type Props = {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  antes?: ReactNode;
};

export function CabecalhoPagina({ titulo, descricao, acoes, antes }: Props) {
  return (
    <header className={estilos.cabecalho}>
      {antes ? <div className={estilos.antes}>{antes}</div> : null}
      <div className={estilos.linha}>
        <div className={estilos.textos}>
          <h1 className={estilos.titulo}>{titulo}</h1>
          {descricao ? <div className={estilos.descricao}>{descricao}</div> : null}
        </div>
        {acoes ? <div className={estilos.acoes}>{acoes}</div> : null}
      </div>
    </header>
  );
}
