import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import type { ClienteResumo } from "../dados/tipos";
import estilos from "./TabelaDeClientes.module.css";

export type ColunaDaTabela<T> = {
  titulo: string;
  /** Números alinhados à direita. */
  numerica?: boolean;
  celula: (item: T) => ReactNode;
};

type Props<T> = {
  /** Nome da tabela para leitores de tela. */
  descricao: string;
  itens: readonly T[];
  clienteDe: (item: T) => ClienteResumo;
  colunas: readonly ColunaDaTabela<T>[];
  vazio: string;
};

/**
 * Clientes com as colunas de cada análise; a linha toda leva à ficha. No celular cada linha vira
 * um cartão, com o nome da coluna acima de cada valor.
 */
export function TabelaDeClientes<T>({ descricao, itens, clienteDe, colunas, vazio }: Props<T>) {
  if (itens.length === 0) return <p className={estilos.vazio}>{vazio}</p>;
  const grade = { "--colunas": colunas.length } as CSSProperties;
  return (
    <section className={estilos.tabela} style={grade} aria-label={descricao}>
      <div className={estilos.cabecalho} aria-hidden="true">
        <span>Cliente</span>
        {colunas.map((coluna) => (
          <span key={coluna.titulo} className={coluna.numerica ? estilos.numerica : undefined}>
            {coluna.titulo}
          </span>
        ))}
      </div>
      <ul>
        {itens.map((item) => {
          const cliente = clienteDe(item);
          return (
            <li key={cliente.codigo}>
              <Link to={`/clientes/${cliente.codigo}`} className={estilos.linha}>
                <span className={estilos.identificacao}>
                  <span className={estilos.nome}>{cliente.nome}</span>
                  <span className={estilos.local}>
                    {cliente.cidade}/{cliente.uf}
                  </span>
                </span>
                {colunas.map((coluna) => (
                  <span key={coluna.titulo} className={coluna.numerica ? `${estilos.celula} ${estilos.numerica}` : estilos.celula}>
                    <span className={estilos.rotuloCelular}>{coluna.titulo}</span>
                    {coluna.celula(item)}
                  </span>
                ))}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
