import { useState } from "react";
import { Table2, ChartColumn } from "lucide-react";
import { useFormatoDeReais } from "../contexto/valores";
import { Variacao } from "../componentes/Variacao";
import { formatarMesAno, formatarMesPorExtenso } from "../formato";
import { eixoRedondo, escalarAltura, type Eixo } from "./escala";
import { rotularMeses } from "./rotulosMes";
import { useLargura } from "./useLargura";
import estilos from "./BarrasMensais.module.css";

export type BarraMensal = {
  mes: string;
  /** null em meses que ainda não chegaram. */
  valor: number | null;
  /** Mesmo mês do ano anterior. */
  comparacao?: number | null;
  /** Só no mês corrente: o que ainda está a faturar. */
  aFaturar?: number | null;
};

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
  const intervaloRotulos = Math.max(1, Math.ceil(ESPACO_MINIMO_ROTULO / Math.max(faixa, 1)));
  const rotulosMes = rotularMeses(barras.map((barra) => barra.mes), intervaloRotulos, barras.length > 12);
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
              aria-label={`${formatarMesPorExtenso(barra.mes)}: ${barra.valor === null ? "ainda não chegou" : formato.reais(barra.valor)}`}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            />
          ))}
        </svg>
      ) : null}
      {barraAtiva && ativo !== null ? (
        <Dica barra={barraAtiva} rotulos={rotulos} esquerda={Math.min(Math.max(centro(ativo), 96), largura - 96)} />
      ) : null}
    </div>
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
  return Math.max(0, ...barras.map((b) => Math.max((b.valor ?? 0) + (b.aFaturar ?? 0), b.comparacao ?? 0)));
}

function Dica({ barra, rotulos, esquerda }: { barra: BarraMensal; rotulos: Rotulos; esquerda: number }) {
  const formato = useFormatoDeReais();
  const fechado = barra.valor !== null && !barra.aFaturar;
  return (
    <div className={estilos.dica} style={{ left: esquerda }} role="status">
      <p className={estilos.dicaTitulo}>{formatarMesPorExtenso(barra.mes)}</p>
      {barra.valor !== null ? (
        <LinhaDica chave={estilos.chaveValor} valor={formato.reais(barra.valor)} rotulo={barra.aFaturar ? "faturado até agora" : rotulos.valor} />
      ) : null}
      {barra.aFaturar ? <LinhaDica chave={estilos.chaveAFaturar} valor={formato.reais(barra.aFaturar)} rotulo={rotulos.aFaturar ?? "a faturar"} /> : null}
      {barra.comparacao != null && rotulos.comparacao ? (
        <LinhaDica chave={estilos.chaveComparacao} valor={formato.reais(barra.comparacao)} rotulo={rotulos.comparacao} />
      ) : null}
      {fechado && barra.comparacao ? (
        <p className={estilos.dicaVariacao}>
          <Variacao razao={(barra.valor ?? 0) / barra.comparacao - 1} referencia={`vs ${rotulos.comparacao ?? "anterior"}`} />
        </p>
      ) : null}
    </div>
  );
}

function LinhaDica({ chave, valor, rotulo }: { chave: string | undefined; valor: string; rotulo: string }) {
  return (
    <p className={estilos.dicaLinha}>
      <span className={chave} aria-hidden="true" />
      <strong>{valor}</strong>
      <span className={estilos.dicaRotulo}>{rotulo}</span>
    </p>
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
  const formato = useFormatoDeReais();
  const temComparacao = Boolean(rotulos.comparacao);
  const temAFaturar = barras.some((b) => b.aFaturar);
  return (
    <div className={estilos.tabelaRolagem}>
      <table className={estilos.tabela}>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">{rotulos.valor}</th>
            {temAFaturar ? <th scope="col">{rotulos.aFaturar ?? "A faturar"}</th> : null}
            {temComparacao ? <th scope="col">{rotulos.comparacao}</th> : null}
            {temComparacao ? <th scope="col">Variação</th> : null}
          </tr>
        </thead>
        <tbody>
          {barras.map((barra) => (
            <tr key={barra.mes}>
              <th scope="row">{formatarMesAno(barra.mes)}</th>
              <td>{barra.valor === null ? "—" : formato.reais(barra.valor)}</td>
              {temAFaturar ? <td>{barra.aFaturar ? formato.reais(barra.aFaturar) : "—"}</td> : null}
              {temComparacao ? <td>{barra.comparacao != null ? formato.reais(barra.comparacao) : "—"}</td> : null}
              {temComparacao ? (
                <td>
                  {barra.valor !== null && !barra.aFaturar && barra.comparacao ? (
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
