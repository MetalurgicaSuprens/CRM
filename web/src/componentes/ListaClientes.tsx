import type { ReactNode } from "react";
import { Link } from "react-router";
import estilos from "./ListaClientes.module.css";

export type ItemDaLista = {
  codigo: string;
  nome: string;
  detalhe: ReactNode;
  direita: ReactNode;
};

/** Lista curta de clientes que leva à ficha de cada um. */
export function ListaClientes({ itens, vazio }: { itens: ItemDaLista[]; vazio: string }) {
  if (itens.length === 0) return <p className={estilos.vazio}>{vazio}</p>;
  return (
    <ul className={estilos.lista}>
      {itens.map((item) => (
        <li key={item.codigo}>
          <Link to={`/clientes/${item.codigo}`} className={estilos.item}>
            <span className={estilos.textos}>
              <span className={estilos.nome}>{item.nome}</span>
              <span className={estilos.detalhe}>{item.detalhe}</span>
            </span>
            <span className={estilos.direita}>{item.direita}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
