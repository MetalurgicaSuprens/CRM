import { useRef } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown } from "lucide-react";
import { rotuloDoSentido, type ColunaOrdenavel, type Sentido } from "./ordenacao";
import type { Ordenacao } from "./useOrdenacao";
import estilos from "./OrdemNoCelular.module.css";

const ICONES = { crescente: ArrowUp, decrescente: ArrowDown } as const;

type Props<T> = {
  colunas: readonly ColunaOrdenavel<T>[];
  ordenacao: Ordenacao<T>;
  /** "115 notas", à esquerda do botão; sem ela, o botão fica sozinho à direita. */
  contagem?: string;
  className?: string;
};

/**
 * No lugar da faixa de títulos, quando as colunas não cabem: a contagem e um botão com a ordem de
 * agora, que abre as ordens possíveis numa folha que sobe do pé da tela (proposta aprovada pelo
 * Lucas em 2026-11-24). Escolher a mesma ordem de novo inverte o sentido, como o título da coluna.
 */
export function OrdemNoCelular<T>({ colunas, ordenacao, contagem, className }: Props<T>) {
  const folha = useRef<HTMLDialogElement>(null);
  const ordenaveis = colunas.filter((coluna) => coluna.ordenarPor);
  if (ordenaveis.length === 0) return null;
  const escolhida = ordenaveis.find((coluna) => ordenacao.sentidoDe(coluna));
  const sentido = escolhida ? ordenacao.sentidoDe(escolhida) : null;
  const escolher = (coluna: ColunaOrdenavel<T>) => {
    ordenacao.alternar(coluna);
    folha.current?.close();
  };
  return (
    <div className={[estilos.barra, className].filter(Boolean).join(" ")}>
      <span className={estilos.contagem}>{contagem}</span>
      <button type="button" className={estilos.botao} aria-haspopup="dialog" onClick={() => folha.current?.showModal()}>
        <span className="visualmente-oculto">Ordenar por </span>
        {escolhida && sentido ? <OrdemEscolhida titulo={escolhida.titulo} sentido={sentido} /> : "Ordenar"}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog ref={folha} className={estilos.folha} aria-label="Ordenar por" onClick={(evento) => evento.target === folha.current && folha.current.close()}>
        <div className={estilos.conteudo}>
          <span className={estilos.puxador} aria-hidden="true" />
          <h2 className={estilos.titulo}>Ordenar por</h2>
          <ul className={estilos.opcoes}>
            {ordenaveis.map((coluna) => {
              const sentidoDaColuna = ordenacao.sentidoDe(coluna);
              return (
                <li key={coluna.titulo}>
                  <button type="button" className={estilos.opcao} aria-pressed={sentidoDaColuna !== null} onClick={() => escolher(coluna)}>
                    <span>{coluna.titulo}</span>
                    {sentidoDaColuna ? (
                      <span className={estilos.sentido}>
                        {rotuloDoSentido(coluna, sentidoDaColuna)}
                        <Check size={18} aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={estilos.dica}>Tocar de novo na ordem escolhida inverte a ordem.</p>
        </div>
      </dialog>
    </div>
  );
}

function OrdemEscolhida({ titulo, sentido }: { titulo: string; sentido: Sentido }) {
  const Icone = ICONES[sentido];
  return (
    <>
      {titulo}
      <span className="visualmente-oculto">, em ordem {sentido}</span>
      <Icone size={16} strokeWidth={2.25} aria-hidden="true" />
    </>
  );
}
