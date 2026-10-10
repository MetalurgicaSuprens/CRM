import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ColunaOrdenavel } from "./ordenacao";
import type { Ordenacao } from "./useOrdenacao";
import estilos from "./TituloDaColuna.module.css";

const ICONES = { crescente: ArrowUp, decrescente: ArrowDown } as const;

/** O título ordena a tabela pela coluna; um segundo clique inverte o sentido. */
export function TituloDaColuna<T>({ coluna, ordenacao }: { coluna: ColunaOrdenavel<T>; ordenacao: Ordenacao<T> }) {
  if (!coluna.ordenarPor) return <>{coluna.titulo}</>;
  const sentido = ordenacao.sentidoDe(coluna);
  const Icone = sentido ? ICONES[sentido] : ChevronsUpDown;
  return (
    <button type="button" className={sentido ? `${estilos.titulo} ${estilos.escolhido}` : estilos.titulo} onClick={() => ordenacao.alternar(coluna)}>
      <span className="visualmente-oculto">Ordenar por </span>
      <span>{coluna.titulo}</span>
      {sentido ? <span className="visualmente-oculto">, em ordem {sentido}</span> : null}
      <Icone size={14} strokeWidth={2.25} aria-hidden="true" className={estilos.icone} />
    </button>
  );
}
