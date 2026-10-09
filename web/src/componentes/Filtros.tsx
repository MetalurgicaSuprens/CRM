import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { useLargura } from "../graficos/useLargura";
import { IconeNoCirculo } from "./IconeNoCirculo";
import type { TomDoSelo } from "./Selo";
import estilos from "./Filtros.module.css";

export type Filtro<T extends string> = {
  valor: T;
  rotulo: string;
  icone: LucideIcon;
  /** Só quando a opção repete uma situação que já tem cor na tela; o padrão é neutro. */
  tom?: TomDoSelo;
  quantidade: number;
};

type Props<T extends string> = {
  /** Nome do grupo para leitores de tela. */
  rotulo: string;
  opcoes: readonly Filtro<T>[];
  selecionado: T;
  aoEscolher: (valor: T) => void;
};

/** Abaixo disto o nome e a quantidade não cabem lado a lado, em px; o espaço entre blocos é o do CSS (--esp-3). */
const LARGURA_MINIMA_DO_BLOCO = 200;
const ESPACO_ENTRE_BLOCOS = 12;

/** Um bloco por opção, com o ícone, o nome e a quantidade; o escolhido fica marcado. */
export function Filtros<T extends string>({ rotulo, opcoes, selecionado, aoEscolher }: Props<T>) {
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const porLinha = { "--por-linha": quantosPorLinha(largura, opcoes.length) } as CSSProperties;
  return (
    <div ref={referencia} className={estilos.filtros} style={porLinha} role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => {
        const tom = opcao.tom ?? "neutro";
        return (
          <button
            key={opcao.valor}
            type="button"
            className={`${estilos.filtro} ${estilos[tom]}`}
            aria-pressed={opcao.valor === selecionado}
            onClick={() => aoEscolher(opcao.valor)}
          >
            <IconeNoCirculo icone={opcao.icone} tom={tom} className={estilos.icone} />
            <span className={estilos.nome}>{opcao.rotulo}</span>
            <span className={estilos.quantidade}>{opcao.quantidade}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Todos numa linha, se couberem; senão, metade por linha (cinco viram 3 + 2); no aperto, dois a dois. */
function quantosPorLinha(largura: number, quantidade: number): number {
  const cabem = (porLinha: number) => porLinha * LARGURA_MINIMA_DO_BLOCO + (porLinha - 1) * ESPACO_ENTRE_BLOCOS <= largura;
  if (largura === 0 || cabem(quantidade)) return quantidade;
  const metade = Math.ceil(quantidade / 2);
  return cabem(metade) ? metade : Math.min(2, quantidade);
}
