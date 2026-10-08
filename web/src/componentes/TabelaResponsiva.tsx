import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { useLargura } from "../graficos/useLargura";
import estilos from "./TabelaResponsiva.module.css";

export type ColunaDaTabela<T> = {
  titulo: string;
  /** Números alinhados à direita. */
  numerica?: boolean;
  /** Largura mínima, em rem. Quando a soma das mínimas não cabe, a tabela vira cartões. */
  largura?: number;
  celula: (item: T) => ReactNode;
};

type Props<T> = {
  /** Nome da tabela para leitores de tela. */
  descricao: string;
  itens: readonly T[];
  chaveDe: (item: T) => string;
  /** Para onde a linha leva; sem ele, a linha não é link (e pode ter botões). */
  linkDe?: (item: T) => string;
  /** A primeira coluna identifica a linha e, nos cartões, vira o título. */
  colunas: readonly [ColunaDaTabela<T>, ...ColunaDaTabela<T>[]];
  vazio: string;
};

const LARGURA_DA_IDENTIFICACAO_REM = 12;
const LARGURA_PADRAO_REM = 6.5;
/** Iguais ao CSS: o espaço entre as colunas (--esp-4) e o recuo das duas pontas (--esp-3 cada). */
const ESPACO_ENTRE_COLUNAS_PX = 16;
const RECUO_DAS_PONTAS_PX = 24;

/**
 * Tabela quando as colunas cabem na largura que ela tem, seja a tela toda ou uma coluna estreita;
 * senão, cada linha vira um cartão, com o nome da coluna acima de cada valor.
 */
export function TabelaResponsiva<T>({ itens, vazio, ...props }: Props<T>) {
  if (itens.length === 0) return <p className={estilos.vazio}>{vazio}</p>;
  return <Tabela itens={itens} {...props} />;
}

function Tabela<T>({ descricao, itens, chaveDe, linkDe, colunas }: Omit<Props<T>, "vazio">) {
  const { referencia, largura } = useLargura<HTMLElement>();
  const [identificacao, ...demais] = colunas;
  const minimas = demais.map((coluna) => coluna.largura ?? LARGURA_PADRAO_REM);
  const emCartoes = largura > 0 && largura < larguraMinima(minimas);
  return (
    <section
      ref={referencia}
      className={emCartoes ? `${estilos.tabela} ${estilos.cartoes}` : estilos.tabela}
      style={{ "--grade": gradeDasColunas(minimas) } as CSSProperties}
      aria-label={descricao}
    >
      <div className={estilos.cabecalho} aria-hidden="true">
        <span>{identificacao.titulo}</span>
        {demais.map((coluna) => (
          <span key={coluna.titulo} className={coluna.numerica ? estilos.numerica : undefined}>
            {coluna.titulo}
          </span>
        ))}
      </div>
      <ul>
        {itens.map((item) => {
          const conteudo = (
            <>
              <span className={estilos.identificacao}>{identificacao.celula(item)}</span>
              {demais.map((coluna) => (
                <span key={coluna.titulo} className={coluna.numerica ? `${estilos.celula} ${estilos.numerica}` : estilos.celula}>
                  <span className={estilos.rotuloDoCartao}>{coluna.titulo}</span>
                  {coluna.celula(item)}
                </span>
              ))}
            </>
          );
          const destino = linkDe?.(item);
          return (
            <li key={chaveDe(item)}>
              {destino ? (
                <Link to={destino} className={`${estilos.linha} ${estilos.link}`}>
                  {conteudo}
                </Link>
              ) : (
                <div className={estilos.linha}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A identificação, mais larga, e as demais colunas, que crescem por igual a partir da mínima. */
function gradeDasColunas(minimas: number[]): string {
  return [`minmax(${LARGURA_DA_IDENTIFICACAO_REM}rem, 2.2fr)`, ...minimas.map((rem) => `minmax(${rem}rem, 1fr)`)].join(" ");
}

/** Abaixo desta largura, em px, as colunas não cabem lado a lado. */
function larguraMinima(minimas: number[]): number {
  const colunasEmRem = LARGURA_DA_IDENTIFICACAO_REM + minimas.reduce((soma, rem) => soma + rem, 0);
  return colunasEmRem * pixelsPorRem() + minimas.length * ESPACO_ENTRE_COLUNAS_PX + RECUO_DAS_PONTAS_PX;
}

/** O rem segue o tamanho de letra escolhido no navegador. */
function pixelsPorRem(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/** Título em negrito e um detalhe embaixo: cliente e cidade, pedido e cliente. */
export function Identificacao({ titulo, detalhe }: { titulo: string; detalhe: ReactNode }) {
  return (
    <>
      <span className={estilos.titulo}>{titulo}</span>
      <span className={estilos.detalhe}>{detalhe}</span>
    </>
  );
}
