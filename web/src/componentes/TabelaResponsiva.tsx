import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import { useLargura } from "../graficos/useLargura";
import type { ColunaOrdenavel, Ordem } from "./ordenacao";
import { TituloDaColuna } from "./TituloDaColuna";
import { useOrdenacao } from "./useOrdenacao";
import estilos from "./TabelaResponsiva.module.css";

export type ColunaDaTabela<T> = ColunaOrdenavel<T> & {
  /** Largura mínima, em rem. Quando a soma das mínimas não cabe, a tabela vira cartões. */
  largura?: number;
  celula: (item: T) => ReactNode;
};

/**
 * O toque na linha leva a outra tela (linkDe) ou abre os detalhes logo abaixo dela, na própria
 * lista (detalheDe). Sem nenhum dos dois, a linha não faz nada e pode ter botões.
 */
type ToqueNaLinha<T> =
  | { linkDe?: (item: T) => string; detalheDe?: undefined }
  | { detalheDe: (item: T) => ReactNode; linkDe?: undefined };

type Props<T> = ToqueNaLinha<T> & {
  /** Nome da tabela para leitores de tela. */
  descricao: string;
  itens: readonly T[];
  chaveDe: (item: T) => string;
  /** A primeira coluna identifica a linha e, nos cartões, vira o título. */
  colunas: readonly [ColunaDaTabela<T>, ...ColunaDaTabela<T>[]];
  vazio: string;
  /** A ordem ao abrir; sem ela, a da lista recebida, sem coluna marcada. */
  ordemInicial?: Ordem;
};

const LARGURA_DA_IDENTIFICACAO_REM = 12;
const LARGURA_PADRAO_REM = 6.5;
/** A coluna da seta, no fim da linha que abre: não cresce com a sobra. */
const COLUNA_DA_SETA: ColunaDaGrade = { minima: 1.25, cresce: false };
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

function Tabela<T>({ descricao, itens, chaveDe, linkDe, detalheDe, colunas, ordemInicial }: Omit<Props<T>, "vazio">) {
  const { referencia, largura } = useLargura<HTMLElement>();
  const ordenacao = useOrdenacao(itens, colunas, { inicial: ordemInicial });
  const [identificacao, ...demais] = colunas;
  const grade: ColunaDaGrade[] = [
    ...demais.map((coluna) => ({ minima: coluna.largura ?? LARGURA_PADRAO_REM, cresce: true })),
    ...(detalheDe ? [COLUNA_DA_SETA] : []),
  ];
  const emCartoes = largura > 0 && largura < larguraMinima(grade);
  const conteudoDe = (item: T) => (
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
  return (
    <section
      ref={referencia}
      className={emCartoes ? `${estilos.tabela} ${estilos.cartoes}` : estilos.tabela}
      style={{ "--grade": gradeDasColunas(grade) } as CSSProperties}
      aria-label={descricao}
    >
      <div className={estilos.cabecalho}>
        {colunas.map((coluna) => (
          <span key={coluna.titulo} className={classeDoTitulo(coluna)}>
            <TituloDaColuna coluna={coluna} ordenacao={ordenacao} />
          </span>
        ))}
        {detalheDe ? <span className={estilos.semOrdem} aria-hidden="true" /> : null}
      </div>
      <ul>
        {ordenacao.ordenados.map((item) =>
          detalheDe ? (
            <LinhaQueAbre key={chaveDe(item)} detalhe={() => detalheDe(item)}>
              {conteudoDe(item)}
            </LinhaQueAbre>
          ) : (
            <li key={chaveDe(item)}>
              <LinhaSemDetalhe destino={linkDe?.(item)}>{conteudoDe(item)}</LinhaSemDetalhe>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function LinhaSemDetalhe({ destino, children }: { destino: string | undefined; children: ReactNode }) {
  if (!destino) return <div className={estilos.linha}>{children}</div>;
  return (
    <Link to={destino} className={`${estilos.linha} ${estilos.link}`}>
      {children}
    </Link>
  );
}

/** Abre e fecha os detalhes logo abaixo da linha; eles só são montados quando ela está aberta. */
function LinhaQueAbre({ detalhe, children }: { detalhe: () => ReactNode; children: ReactNode }) {
  const [isAberta, setAberta] = useState(false);
  const idDoDetalhe = useId();
  return (
    <li className={isAberta ? estilos.aberta : undefined}>
      <button
        type="button"
        className={`${estilos.linha} ${estilos.link} ${estilos.linhaQueAbre}`}
        aria-expanded={isAberta}
        aria-controls={isAberta ? idDoDetalhe : undefined}
        onClick={() => setAberta((aberta) => !aberta)}
      >
        {children}
        <ChevronDown size={18} className={estilos.seta} aria-hidden="true" />
      </button>
      {isAberta ? (
        <div id={idDoDetalhe} className={estilos.detalheDaLinha}>
          {detalhe()}
        </div>
      ) : null}
    </li>
  );
}

/** Nos cartões, o cabeçalho vira uma linha só com os títulos que ordenam. */
function classeDoTitulo<T>(coluna: ColunaDaTabela<T>): string | undefined {
  return [coluna.numerica ? estilos.numerica : "", coluna.ordenarPor ? "" : estilos.semOrdem].filter(Boolean).join(" ") || undefined;
}

/** Cada coluna depois da identificação: a largura mínima, em rem, e se cresce com a sobra. */
type ColunaDaGrade = { minima: number; cresce: boolean };

/** A identificação, mais larga, e as demais colunas, que crescem por igual a partir da mínima. */
function gradeDasColunas(grade: ColunaDaGrade[]): string {
  const demais = grade.map(({ minima, cresce }) => (cresce ? `minmax(${minima}rem, 1fr)` : `${minima}rem`));
  return [`minmax(${LARGURA_DA_IDENTIFICACAO_REM}rem, 2.2fr)`, ...demais].join(" ");
}

/** Abaixo desta largura, em px, as colunas não cabem lado a lado. */
function larguraMinima(grade: ColunaDaGrade[]): number {
  const colunasEmRem = LARGURA_DA_IDENTIFICACAO_REM + grade.reduce((soma, { minima }) => soma + minima, 0);
  return colunasEmRem * pixelsPorRem() + grade.length * ESPACO_ENTRE_COLUNAS_PX + RECUO_DAS_PONTAS_PX;
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
