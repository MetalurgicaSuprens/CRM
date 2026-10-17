import { useState } from "react";
import { Table2, ChartColumn } from "lucide-react";
import { useFormatoDeReais } from "../contexto/valores";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { formatarMesAno, formatarMesPorExtenso } from "../formato";
import { eixoRedondo, escalarAltura, type Eixo } from "./escala";
import { rotularMeses } from "./rotulosMes";
import { useLargura } from "./useLargura";
import estilos from "./BarrasMensais.module.css";

export type BarraMensal = {
  /** O mês da barra, ou o primeiro mês dela quando ela é de um trimestre ou de um ano. */
  mes: string;
  /** null em meses que ainda não chegaram. */
  valor: number | null;
  /** Mesmo mês do ano anterior. */
  comparacao?: number | null;
  /** Só no mês corrente, inclusive 0: o que ainda está a faturar. null ou ausente nos outros meses. */
  aFaturar?: number | null;
  /** Na barra de trimestre ou de ano: o rótulo do eixo ("3º tri/26") e o título da dica. */
  periodo?: { rotulo: string; titulo: string };
  /** O ponto da linha da média no fim da barra; null onde ela não tem ponto. */
  media?: number | null;
  /** A barra do período que ainda não fechou: a dica diz "até agora". */
  parcial?: boolean;
};

/** O mês corrente é o único que traz `aFaturar`, mesmo quando não há nada a faturar. */
function isMesCorrente(barra: BarraMensal): barra is BarraMensal & { aFaturar: number } {
  return barra.aFaturar != null;
}

type Rotulos = {
  valor: string;
  comparacao?: string;
  aFaturar?: string;
  media?: string;
};

type Props = {
  barras: BarraMensal[];
  descricao: string;
  rotulos: Rotulos;
  altura?: number;
};

const MARGEM = { topo: 12, direita: 4, base: 28, esquerda: 50 };
const LARGURA_MAXIMA_BARRA = 24;
const RAIO = 4;
const VAO = 2;
const ESPACO_MINIMO_ROTULO = 34;
/** "3º tri/26" é mais largo que o mês: precisa de mais espaço entre os rótulos. */
const ESPACO_MINIMO_ROTULO_DO_PERIODO = 56;

export function BarrasMensais({ barras, descricao, rotulos, altura = 240 }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  return (
    <figure className={estilos.figura}>
      <div className={estilos.topo}>
        <Legenda barras={barras} rotulos={rotulos} />
        <button
          type="button"
          className={estilos.alternar}
          onClick={() => setComoTabela((anterior) => !anterior)}
          aria-pressed={comoTabela}
        >
          {comoTabela ? <ChartColumn size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
          {comoTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {comoTabela ? (
        <TabelaMensal barras={barras} rotulos={rotulos} />
      ) : (
        <Desenho barras={barras} rotulos={rotulos} descricao={descricao} altura={altura} />
      )}
    </figure>
  );
}

function Desenho({ barras, rotulos, descricao, altura }: Required<Pick<Props, "altura">> & Omit<Props, "altura">) {
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const formato = useFormatoDeReais();
  const larguraPlot = Math.max(0, largura - MARGEM.esquerda - MARGEM.direita);
  const alturaPlot = altura - MARGEM.topo - MARGEM.base;
  const faixa = barras.length ? larguraPlot / barras.length : 0;
  const larguraBarra = Math.min(LARGURA_MAXIMA_BARRA, Math.max(4, faixa * 0.56));
  const eixo = eixoRedondo(maiorValor(barras));
  const y = (valor: number) => MARGEM.topo + alturaPlot - escalarAltura(valor, eixo.maximo, alturaPlot);
  const centro = (indice: number) => MARGEM.esquerda + faixa * indice + faixa / 2;
  const rotulosMes = rotularBarras(barras, faixa);
  const barraAtiva = ativo === null ? undefined : barras[ativo];

  return (
    <div ref={referencia} className={estilos.desenho}>
      {largura > 0 ? (
        <svg width={largura} height={altura} role="img" aria-label={descricao} className={estilos.svg}>
          <Grade eixo={eixo} y={y} largura={largura} rotular={formato.eixo} />
          {ativo !== null ? (
            <rect className={estilos.realce} x={MARGEM.esquerda + faixa * ativo} y={MARGEM.topo} width={faixa} height={alturaPlot} />
          ) : null}
          {barras.map((barra, i) => (
            <Coluna key={barra.mes} barra={barra} cx={centro(i)} largura={larguraBarra} y={y} base={y(0)} />
          ))}
          <LinhaDaMedia barras={barras} centro={centro} y={y} ativo={ativo} />
          {rotulosMes.map((rotulo, i) =>
            rotulo ? (
              <text key={barras[i]?.mes ?? i} className={estilos.rotuloMes} x={centro(i)} y={altura - 8} textAnchor="middle">
                {rotulo}
              </text>
            ) : null,
          )}
          {barras.map((barra, i) => (
            <rect
              key={barra.mes}
              className={estilos.alvo}
              x={MARGEM.esquerda + faixa * i}
              y={MARGEM.topo}
              width={faixa}
              height={alturaPlot}
              tabIndex={0}
              aria-label={descreverBarra(barra, rotulos, formato.reais)}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            />
          ))}
        </svg>
      ) : null}
      {barraAtiva && ativo !== null ? <Dica barra={barraAtiva} rotulos={rotulos} centro={centro(ativo)} larguraDesenho={largura} /> : null}
    </div>
  );
}

/** Um rótulo a cada tantas barras, para caberem; o mês com o ano onde ele muda, o trimestre e o ano como vêm. */
function rotularBarras(barras: BarraMensal[], faixa: number): (string | null)[] {
  const comPeriodo = barras.some((barra) => barra.periodo);
  const espaco = comPeriodo ? ESPACO_MINIMO_ROTULO_DO_PERIODO : ESPACO_MINIMO_ROTULO;
  const intervalo = Math.max(1, Math.ceil(espaco / Math.max(faixa, 1)));
  if (!comPeriodo) return rotularMeses(barras.map((barra) => barra.mes), intervalo, barras.length > 12);
  return barras.map((barra, i) => (i % intervalo === 0 ? (barra.periodo?.rotulo ?? null) : null));
}

function tituloDaBarra(barra: BarraMensal): string {
  return barra.periodo?.titulo ?? formatarMesPorExtenso(barra.mes);
}

function descreverBarra(barra: BarraMensal, rotulos: Rotulos, reais: (valor: number) => string): string {
  const valor = barra.valor === null ? "ainda não chegou" : reais(barra.valor);
  const media = barra.media != null && rotulos.media ? `; ${rotulos.media.toLowerCase()}: ${reais(barra.media)}` : "";
  return `${tituloDaBarra(barra)}: ${valor}${media}`;
}

/**
 * A média passa por cima das barras, com um contorno da cor do fundo para se destacar delas. Ela se
 * interrompe onde a barra não tem ponto.
 */
function LinhaDaMedia({ barras, centro, y, ativo }: { barras: BarraMensal[]; centro: (indice: number) => number; y: (valor: number) => number; ativo: number | null }) {
  const trechos: string[] = [];
  let trecho = "";
  barras.forEach((barra, i) => {
    if (barra.media == null) {
      if (trecho) trechos.push(trecho);
      trecho = "";
      return;
    }
    trecho += `${trecho ? "L" : "M"}${centro(i)},${y(barra.media)}`;
  });
  if (trecho) trechos.push(trecho);
  const pontoAtivo = ativo === null ? null : barras[ativo]?.media;
  if (trechos.length === 0) return null;
  return (
    <g>
      {trechos.map((d) => (
        <path key={`halo-${d}`} className={estilos.haloMedia} d={d} />
      ))}
      {trechos.map((d) => (
        <path key={d} className={estilos.linhaMedia} d={d} />
      ))}
      {ativo !== null && pontoAtivo != null ? <circle className={estilos.pontoMedia} cx={centro(ativo)} cy={y(pontoAtivo)} r={4.5} /> : null}
    </g>
  );
}

function Grade({ eixo, y, largura, rotular }: { eixo: Eixo; y: (valor: number) => number; largura: number; rotular: (valor: number) => string }) {
  return (
    <g>
      {eixo.marcas.map((marca) => (
        <g key={marca}>
          <line
            className={marca === 0 ? estilos.linhaBase : estilos.linhaGrade}
            x1={MARGEM.esquerda}
            x2={largura - MARGEM.direita}
            y1={y(marca)}
            y2={y(marca)}
          />
          <text className={estilos.rotuloEixo} x={MARGEM.esquerda - 8} y={y(marca) + 4} textAnchor="end">
            {rotular(marca)}
          </text>
        </g>
      ))}
    </g>
  );
}

type PropsColuna = {
  barra: BarraMensal;
  cx: number;
  largura: number;
  y: (valor: number) => number;
  base: number;
};

function Coluna({ barra, cx, largura, y, base }: PropsColuna) {
  const x = cx - largura / 2;
  const valor = barra.valor ?? 0;
  const aFaturar = barra.aFaturar ?? 0;
  const topoValor = y(valor);
  return (
    <g>
      {valor > 0 ? <path className={estilos.barra} d={caminhoColuna(x, topoValor, base, largura, aFaturar > 0 ? 0 : RAIO)} /> : null}
      {aFaturar > 0 ? (
        <path className={estilos.aFaturar} d={caminhoColuna(x, y(valor + aFaturar), valor > 0 ? topoValor - VAO : base, largura, RAIO)} />
      ) : null}
      {barra.comparacao ? <MarcaComparacao cx={cx} y={y(barra.comparacao)} largura={largura} /> : null}
    </g>
  );
}

function MarcaComparacao({ cx, y, largura }: { cx: number; y: number; largura: number }) {
  const meia = largura / 2 + 5;
  return (
    <g>
      <line className={estilos.anelComparacao} x1={cx - meia} x2={cx + meia} y1={y} y2={y} />
      <line className={estilos.comparacao} x1={cx - meia} x2={cx + meia} y1={y} y2={y} />
    </g>
  );
}

/** Coluna com cantos arredondados só no topo (a ponta do dado); a base fica reta. */
function caminhoColuna(x: number, topo: number, base: number, largura: number, raio: number): string {
  const altura = base - topo;
  if (altura <= 0.5) return "";
  const r = Math.min(raio, altura, largura / 2);
  return [
    `M${x},${base}`,
    `V${topo + r}`,
    `Q${x},${topo} ${x + r},${topo}`,
    `H${x + largura - r}`,
    `Q${x + largura},${topo} ${x + largura},${topo + r}`,
    `V${base}`,
    "Z",
  ].join(" ");
}

function maiorValor(barras: BarraMensal[]): number {
  return Math.max(0, ...barras.map((b) => Math.max((b.valor ?? 0) + (b.aFaturar ?? 0), b.comparacao ?? 0, b.media ?? 0)));
}

type PropsDica = {
  barra: BarraMensal;
  rotulos: Rotulos;
  /** Centro da coluna, em px a partir da borda esquerda do desenho. */
  centro: number;
  larguraDesenho: number;
};

/**
 * Para não sair do desenho, a dica recua a própria largura na mesma proporção em que a
 * coluna está no gráfico: centrada no meio, rente à borda nas pontas.
 */
function Dica({ barra, rotulos, centro, larguraDesenho }: PropsDica) {
  const fechado = barra.valor !== null && !isMesCorrente(barra) && !barra.parcial;
  const recuo = larguraDesenho > 0 ? (centro / larguraDesenho) * 100 : 50;
  return (
    <div className={estilos.dica} style={{ left: centro, transform: `translate(-${recuo}%, -8px)` }} role="status">
      <p className={estilos.dicaTitulo}>{tituloDaBarra(barra)}</p>
      <div className={estilos.dicaLinhas}>
        {barra.valor !== null ? (
          <LinhaDica chave={estilos.chaveValor} valor={barra.valor} rotulo={isMesCorrente(barra) || barra.parcial ? "Faturado até agora" : rotulos.valor} />
        ) : null}
        {barra.media != null && rotulos.media ? <LinhaDica chave={estilos.chaveMedia} valor={barra.media} rotulo={rotulos.media} /> : null}
        {isMesCorrente(barra) ? <LinhaDica chave={estilos.chaveAFaturar} valor={barra.aFaturar} rotulo={rotulos.aFaturar ?? "A faturar"} /> : null}
        {barra.comparacao != null && rotulos.comparacao ? (
          <LinhaDica
            chave={estilos.chaveComparacao}
            valor={barra.comparacao}
            rotulo={isMesCorrente(barra) ? `${rotulos.comparacao}, mês inteiro` : rotulos.comparacao}
          />
        ) : null}
      </div>
      {fechado && barra.comparacao ? (
        <p className={estilos.dicaVariacao}>
          <Variacao razao={(barra.valor ?? 0) / barra.comparacao - 1} referencia={`vs ${rotulos.comparacao ?? "anterior"}`} />
        </p>
      ) : null}
    </div>
  );
}

/** Três células da grade da dica: traço da série, valor e rótulo, sempre na mesma linha. */
function LinhaDica({ chave, valor, rotulo }: { chave: string | undefined; valor: number; rotulo: string }) {
  return (
    <>
      <span className={chave} aria-hidden="true" />
      <strong className={estilos.dicaValor}>
        <Valor valor={valor} />
      </strong>
      <span className={estilos.dicaRotulo}>{rotulo}</span>
    </>
  );
}

function Legenda({ barras, rotulos }: { barras: BarraMensal[]; rotulos: Rotulos }) {
  const temComparacao = Boolean(rotulos.comparacao) && barras.some((b) => b.comparacao);
  const temAFaturar = barras.some((b) => b.aFaturar);
  const temMedia = Boolean(rotulos.media) && barras.some((b) => b.media != null);
  if (!temComparacao && !temAFaturar && !temMedia) return <span />;
  return (
    <ul className={estilos.legenda}>
      <li>
        <span className={estilos.amostraValor} aria-hidden="true" />
        {rotulos.valor}
      </li>
      {temAFaturar ? (
        <li>
          <span className={estilos.amostraAFaturar} aria-hidden="true" />
          {rotulos.aFaturar ?? "A faturar"}
        </li>
      ) : null}
      {temComparacao ? (
        <li>
          <span className={estilos.amostraComparacao} aria-hidden="true" />
          {rotulos.comparacao}
        </li>
      ) : null}
      {temMedia ? (
        <li>
          <span className={estilos.amostraMedia} aria-hidden="true" />
          {rotulos.media}
        </li>
      ) : null}
    </ul>
  );
}

function TabelaMensal({ barras, rotulos }: { barras: BarraMensal[]; rotulos: Rotulos }) {
  const temComparacao = Boolean(rotulos.comparacao);
  const temMesCorrente = barras.some(isMesCorrente);
  const temMedia = Boolean(rotulos.media);
  return (
    <div className={estilos.tabelaRolagem}>
      <table className={estilos.tabela}>
        <thead>
          <tr>
            <th scope="col">{barras.some((barra) => barra.periodo) ? "Período" : "Mês"}</th>
            <th scope="col">{rotulos.valor}</th>
            {temMedia ? <th scope="col">{rotulos.media}</th> : null}
            {temMesCorrente ? <th scope="col">{rotulos.aFaturar ?? "A faturar"}</th> : null}
            {temComparacao ? <th scope="col">{rotulos.comparacao}</th> : null}
            {temComparacao ? <th scope="col">Variação</th> : null}
          </tr>
        </thead>
        <tbody>
          {barras.map((barra) => (
            <tr key={barra.mes}>
              <th scope="row">{barra.periodo?.titulo ?? formatarMesAno(barra.mes)}</th>
              <td>{barra.valor === null ? "—" : <Valor valor={barra.valor} />}</td>
              {temMedia ? <td>{barra.media == null ? "—" : <Valor valor={barra.media} />}</td> : null}
              {temMesCorrente ? <td>{isMesCorrente(barra) ? <Valor valor={barra.aFaturar} /> : "—"}</td> : null}
              {temComparacao ? <td>{barra.comparacao != null ? <Valor valor={barra.comparacao} /> : "—"}</td> : null}
              {temComparacao ? (
                <td>
                  {barra.valor !== null && !isMesCorrente(barra) && barra.comparacao ? (
                    <Variacao razao={barra.valor / barra.comparacao - 1} />
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
