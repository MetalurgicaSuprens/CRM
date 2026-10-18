import { useState } from "react";
import { Table2, ChartColumn } from "lucide-react";
import { useFormatoDeReais } from "../contexto/valores";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { formatarMesAno, formatarMesPorExtenso } from "../formato";
import { eixoRedondo, escalarAltura } from "./escala";
import { GradeDoEixo } from "./GradeDoEixo";
import { rotularMeses } from "./rotulosMes";
import { useLargura } from "./useLargura";
import estilos from "./BarrasMensais.module.css";
import moldura from "./moldura.module.css";

export type BarraMensal = {
  mes: string;
  /** null em meses que ainda não chegaram. */
  valor: number | null;
  /** Mesmo mês do ano anterior. */
  comparacao?: number | null;
  /** Só no mês corrente, inclusive 0: o que ainda está a faturar. null ou ausente nos outros meses. */
  aFaturar?: number | null;
};

/** O mês corrente é o único que traz `aFaturar`, mesmo quando não há nada a faturar. */
function isMesCorrente(barra: BarraMensal): barra is BarraMensal & { aFaturar: number } {
  return barra.aFaturar != null;
}

type Rotulos = {
  valor: string;
  comparacao?: string;
  aFaturar?: string;
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

export function BarrasMensais({ barras, descricao, rotulos, altura = 240 }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  return (
    <figure className={moldura.figura}>
      <div className={moldura.topo}>
        <Legenda barras={barras} rotulos={rotulos} />
        <button
          type="button"
          className={moldura.alternar}
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
  const intervaloRotulos = Math.max(1, Math.ceil(ESPACO_MINIMO_ROTULO / Math.max(faixa, 1)));
  const rotulosMes = rotularMeses(barras.map((barra) => barra.mes), intervaloRotulos, barras.length > 12);
  const barraAtiva = ativo === null ? undefined : barras[ativo];

  return (
    <div ref={referencia} className={moldura.desenho}>
      {largura > 0 ? (
        <svg width={largura} height={altura} role="img" aria-label={descricao} className={moldura.svg}>
          <GradeDoEixo eixo={eixo} y={y} inicio={MARGEM.esquerda} fim={largura - MARGEM.direita} rotular={formato.eixo} />
          {ativo !== null ? (
            <rect className={estilos.realce} x={MARGEM.esquerda + faixa * ativo} y={MARGEM.topo} width={faixa} height={alturaPlot} />
          ) : null}
          {barras.map((barra, i) => (
            <Coluna key={barra.mes} barra={barra} cx={centro(i)} largura={larguraBarra} y={y} base={y(0)} />
          ))}
          {rotulosMes.map((rotulo, i) =>
            rotulo ? (
              <text key={barras[i]?.mes ?? i} className={moldura.rotulo} x={centro(i)} y={altura - 8} textAnchor="middle">
                {rotulo}
              </text>
            ) : null,
          )}
          {barras.map((barra, i) => (
            <rect
              key={barra.mes}
              className={moldura.alvo}
              x={MARGEM.esquerda + faixa * i}
              y={MARGEM.topo}
              width={faixa}
              height={alturaPlot}
              tabIndex={0}
              aria-label={`${formatarMesPorExtenso(barra.mes)}: ${barra.valor === null ? "ainda não chegou" : formato.reais(barra.valor)}`}
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
      <g className={moldura.crescer}>
        {valor > 0 ? <path className={estilos.barra} d={caminhoColuna(x, topoValor, base, largura, aFaturar > 0 ? 0 : RAIO)} /> : null}
        {aFaturar > 0 ? (
          <path className={estilos.aFaturar} d={caminhoColuna(x, y(valor + aFaturar), valor > 0 ? topoValor - VAO : base, largura, RAIO)} />
        ) : null}
      </g>
      {barra.comparacao ? <MarcaComparacao cx={cx} y={y(barra.comparacao)} largura={largura} /> : null}
    </g>
  );
}

function MarcaComparacao({ cx, y, largura }: { cx: number; y: number; largura: number }) {
  const meia = largura / 2 + 5;
  return (
    <g className={moldura.surgirDepois}>
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
  return Math.max(0, ...barras.map((b) => Math.max((b.valor ?? 0) + (b.aFaturar ?? 0), b.comparacao ?? 0)));
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
  const fechado = barra.valor !== null && !isMesCorrente(barra);
  const recuo = larguraDesenho > 0 ? (centro / larguraDesenho) * 100 : 50;
  return (
    <div className={moldura.dica} style={{ left: centro, transform: `translate(-${recuo}%, -8px)` }} role="status">
      <p className={moldura.dicaTitulo}>{formatarMesPorExtenso(barra.mes)}</p>
      <div className={estilos.dicaLinhas}>
        {barra.valor !== null ? (
          <LinhaDica chave={estilos.chaveValor} valor={barra.valor} rotulo={isMesCorrente(barra) ? "Faturado até agora" : rotulos.valor} />
        ) : null}
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
  if (!temComparacao && !temAFaturar) return <span />;
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
    </ul>
  );
}

function TabelaMensal({ barras, rotulos }: { barras: BarraMensal[]; rotulos: Rotulos }) {
  const temComparacao = Boolean(rotulos.comparacao);
  const temMesCorrente = barras.some(isMesCorrente);
  return (
    <div className={moldura.tabelaRolagem}>
      <table className={moldura.tabela}>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">{rotulos.valor}</th>
            {temMesCorrente ? <th scope="col">{rotulos.aFaturar ?? "A faturar"}</th> : null}
            {temComparacao ? <th scope="col">{rotulos.comparacao}</th> : null}
            {temComparacao ? <th scope="col">Variação</th> : null}
          </tr>
        </thead>
        <tbody>
          {barras.map((barra) => (
            <tr key={barra.mes}>
              <th scope="row">{formatarMesAno(barra.mes)}</th>
              <td>{barra.valor === null ? "—" : <Valor valor={barra.valor} />}</td>
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
