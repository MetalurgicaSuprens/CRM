import type { ReactNode } from "react";
import estilos from "./Fato.module.css";

/*
 * Um dado que só se confere, nunca se muda: o nome pequeno, em maiúsculas e cinza, e o valor embaixo,
 * maior e escuro, para os dois não se confundirem. Vai dentro de um <dl>, que arruma as colunas.
 */

/** "largo": o valor comprido, como o e-mail, ocupa duas colunas em vez de quebrar numa estreita. */
export function Fato({ rotulo, largo = false, children }: { rotulo: string; largo?: boolean; children: ReactNode }) {
  return (
    <div className={largo ? `${estilos.fato} ${estilos.largo}` : estilos.fato}>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** O detalhe embaixo do valor, como a descrição do CFOP ou de quem é o endereço. */
export function DetalheDoFato({ children }: { children: ReactNode }) {
  return <span className={estilos.detalhe}>{children}</span>;
}
