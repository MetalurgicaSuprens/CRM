import { useState, type ReactNode } from "react";
import { ChartLine, Table2 } from "lucide-react";
import { somarMeses } from "dominio/datas";
import { useFormatoDeReais } from "../contexto/valores";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { formatarMesAno } from "../formato";
import { eixoRedondo, escalarAltura, tetoComCorte } from "./escala";
import { GradeDoEixo } from "./GradeDoEixo";
import { LeituraDoGrafico, ParteSecundaria, TituloDaLeitura } from "./LeituraDoGrafico";
import { useLargura } from "./useLargura";
import estilos from "./LinhaDeTendencia.module.css";
import moldura from "./moldura.module.css";

export type PontoDaLinha = {
  mes: string;
  /** A média por mês dos 12 meses até o mês, inclusive: a linha. */
  valor: number;
  /** O valor 12 meses antes, para a variação na leitura e na tabela; null quando não há. */
  anoAntes: number | null;
  /** O faturado do próprio mês: a barra. */
  faturado: number;
};

type Props = {
  pontos: PontoDaLinha[];
  descricao: string;
  /** O nome do valor na leitura e na tabela, como "Média por mês". */
  rotulo: string;
  /** A frase da linha acima do desenho quando nenhum mês está apontado, como "Desde nov/22: +3%". */
  resumo?: ReactNode;
  altura?: number;
};

const MARGEM = { topo: 24, direita: 14, base: 28, esquerda: 50 };
const MESES_DO_ANO = 12;
const LARGURA_MAXIMA_DA_BARRA = 14;
/** A altura do corte da barra que passa do teto da escala, e quanto abaixo do topo ele fica. */
const CORTE = { altura: 3, abaixoDoTopo: 7 };

/**
 * A média por mês de 12 meses, a linha, sobre o faturado de cada mês, as barras claras (a escolha do
 * Lucas em 2026-11-18): a média é das barras, e não dos pontos da linha. Ao apontar um mês, as 12
 * barras da média ficam fortes, numa faixa, e um tracejado na altura da média passa por cima delas. Só
 * dois pontos têm o valor escrito, o último e o de 1 ano antes; os outros ficam na leitura e na tabela.
 */
export function LinhaDeTendencia({ pontos, descricao, rotulo, resumo, altura = 240 }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  const [ativo, setAtivo] = useState<number | null>(null);
  if (pontos.length < 2) return <p className={estilos.vazio}>Ainda não há 12 meses de história para mostrar a tendência.</p>;
  const pontoAtivo = ativo === null || comoTabela ? undefined : pontos[ativo];
  return (
    <figure className={moldura.figura}>
      <LeituraDoGrafico
        leitura={pontoAtivo && ativo !== null ? <LeituraDoPonto ponto={pontoAtivo} rotulo={rotulo} mesesAntesDoGrafico={Math.max(0, MESES_DO_ANO - 1 - ativo)} /> : null}
        resumo={resumo}
      />
      <div className={moldura.topo}>
        <Legenda rotulo={rotulo} />
        <button type="button" className={moldura.alternar} onClick={() => setComoTabela((anterior) => !anterior)} aria-pressed={comoTabela}>
          {comoTabela ? <ChartLine size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
          {comoTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {comoTabela ? (
        <Tabela pontos={pontos} rotulo={rotulo} />
      ) : (
        <Desenho pontos={pontos} rotulo={rotulo} descricao={descricao} altura={altura} ativo={ativo} aoApontar={setAtivo} />
      )}
    </figure>
  );
}

function Legenda({ rotulo }: { rotulo: string }) {
  return (
    <ul className={estilos.legenda}>
      <li>
        <span className={estilos.amostraDaBarra} aria-hidden="true" />
        Faturado no mês
      </li>
      <li>
        <span className={estilos.amostraDaLinha} aria-hidden="true" />
        {rotulo} de 12 meses
      </li>
    </ul>
  );
}

type PropsDoDesenho = Required<Pick<Props, "altura">> &
  Omit<Props, "altura" | "resumo"> & {
    /** O ponto apontado, que a leitura mostra; null sem nenhum. */
    ativo: number | null;
    aoApontar: (indice: number | null) => void;
  };

function Desenho({ pontos, rotulo, descricao, altura, ativo, aoApontar: setAtivo }: PropsDoDesenho) {
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const formato = useFormatoDeReais();
  const larguraPlot = Math.max(0, largura - MARGEM.esquerda - MARGEM.direita);
  const alturaPlot = altura - MARGEM.topo - MARGEM.base;
  const faixa = larguraPlot / pontos.length;
  const larguraDaBarra = Math.min(LARGURA_MAXIMA_DA_BARRA, Math.max(2, faixa * 0.62));
  const eixo = eixoRedondo(tetoComCorte(pontos.map((ponto) => ponto.faturado), pontos.map((ponto) => ponto.valor)));
  const x = (indice: number) => MARGEM.esquerda + faixa * indice + faixa / 2;
  const y = (valor: number) => MARGEM.topo + alturaPlot - escalarAltura(Math.min(valor, eixo.maximo), eixo.maximo, alturaPlot);
  const linha = pontos.map((ponto, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(ponto.valor)}`).join(" ");
  const ultimo = pontos.length - 1;
  const umAnoAntes = ultimo - MESES_DO_ANO >= 0 ? ultimo - MESES_DO_ANO : null;
  const pontoAtivo = ativo === null ? undefined : pontos[ativo];
  const janela = ativo === null ? null : { inicio: Math.max(0, ativo - (MESES_DO_ANO - 1)), fim: ativo, isCortada: ativo < MESES_DO_ANO - 1 };

  return (
    <div ref={referencia} className={moldura.desenho}>
      {largura > 0 ? (
        <svg width={largura} height={altura} role="img" aria-label={descricao} className={moldura.svg}>
          <GradeDoEixo eixo={eixo} y={y} inicio={MARGEM.esquerda} fim={largura - MARGEM.direita} rotular={formato.eixo} />
          {janela ? (
            <rect
              className={estilos.faixaDaJanela}
              x={MARGEM.esquerda + faixa * janela.inicio}
              y={MARGEM.topo}
              width={faixa * (janela.fim - janela.inicio + 1)}
              height={alturaPlot}
            />
          ) : null}
          <g className={moldura.crescer}>
            {pontos.map((ponto, i) => (
              <Barra
                key={ponto.mes}
                cx={x(i)}
                largura={larguraDaBarra}
                topo={y(ponto.faturado)}
                base={y(0)}
                isCortada={ponto.faturado > eixo.maximo}
                estado={janela === null ? "normal" : i >= janela.inicio && i <= janela.fim ? "naJanela" : "foraDaJanela"}
              />
            ))}
          </g>
          <path className={`${estilos.linha} ${moldura.tracar}`} d={linha} pathLength={1} />
          {pontos.map((ponto, i) =>
            ponto.mes.endsWith("-01") ? (
              <text key={ponto.mes} className={moldura.rotulo} x={x(i)} y={altura - 8} textAnchor="middle">
                {ponto.mes.slice(0, 4)}
              </text>
            ) : null,
          )}
          {pontoAtivo && janela ? (
            <JanelaDaMedia
              inicio={MARGEM.esquerda + faixa * janela.inicio}
              fim={x(janela.fim)}
              yDaMedia={y(pontoAtivo.valor)}
              topo={MARGEM.topo}
              base={y(0)}
              rotuloDoInicio={janela.isCortada ? `◂ desde ${formatarMesAno(somarMeses(pontoAtivo.mes, 1 - MESES_DO_ANO))}` : formatarMesAno(pontos[janela.inicio]?.mes ?? "")}
              rotuloDoFim={formatarMesAno(pontoAtivo.mes)}
            />
          ) : (
            <>
              {umAnoAntes !== null ? (
                <Marco x={x(umAnoAntes)} y={y(pontos[umAnoAntes]?.valor ?? 0)} texto={`há 1 ano: ${formato.reaisCompacto(pontos[umAnoAntes]?.valor ?? 0)}`} vazado />
              ) : null}
              <Marco x={x(ultimo)} y={y(pontos[ultimo]?.valor ?? 0)} texto={formato.reaisCompacto(pontos[ultimo]?.valor ?? 0)} ancora="end" />
            </>
          )}
          {pontoAtivo && ativo !== null ? <circle className={estilos.pontoAtivo} cx={x(ativo)} cy={y(pontoAtivo.valor)} r={4.5} /> : null}
          {pontos.map((ponto, i) => (
            <rect
              key={ponto.mes}
              className={moldura.alvo}
              x={MARGEM.esquerda + faixa * i}
              y={MARGEM.topo}
              width={faixa}
              height={alturaPlot}
              tabIndex={0}
              aria-label={`${rotulo} até ${formatarMesAno(ponto.mes)}: ${formato.reais(ponto.valor)}; faturado no mês: ${formato.reais(ponto.faturado)}`}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

type PropsDaBarra = { cx: number; largura: number; topo: number; base: number; isCortada: boolean; estado: "normal" | "naJanela" | "foraDaJanela" };

const CLASSE_DA_BARRA = { normal: estilos.barra, naJanela: estilos.barraNaJanela, foraDaJanela: estilos.barraForaDaJanela };

/** A barra que passa do teto da escala chega ao topo com um corte: o valor dela está na leitura e na tabela. */
function Barra({ cx, largura, topo, base, isCortada, estado }: PropsDaBarra) {
  if (base - topo < 0.5) return null;
  const x = cx - largura / 2;
  return (
    <>
      <rect className={CLASSE_DA_BARRA[estado]} x={x} y={topo} width={largura} height={base - topo} rx={1.5} />
      {isCortada ? <rect className={estilos.corte} x={x - 1} y={topo + CORTE.abaixoDoTopo} width={largura + 2} height={CORTE.altura} /> : null}
    </>
  );
}

type PropsDaJanela = { inicio: number; fim: number; yDaMedia: number; topo: number; base: number; rotuloDoInicio: string; rotuloDoFim: string };

/** Abaixo desta largura, em px, a faixa só leva o rótulo do começo: os dois se encostariam. */
const LARGURA_PARA_DOIS_ROTULOS = 120;

/**
 * Os 12 meses da média: o primeiro e o último no alto da faixa, e o tracejado da média sobre as barras
 * deles. Perto do começo do gráfico, parte dos 12 meses fica antes dele, e o rótulo diz desde quando.
 */
function JanelaDaMedia({ inicio, fim, yDaMedia, topo, base, rotuloDoInicio, rotuloDoFim }: PropsDaJanela) {
  const cabemDoisRotulos = fim - inicio >= LARGURA_PARA_DOIS_ROTULOS;
  return (
    <>
      <line className={estilos.cursor} x1={fim} x2={fim} y1={topo} y2={base} />
      <line className={estilos.media} x1={inicio} x2={fim} y1={yDaMedia} y2={yDaMedia} />
      <text className={estilos.rotuloDaJanela} x={inicio + 4} y={topo - 8}>
        {rotuloDoInicio}
      </text>
      {cabemDoisRotulos ? (
        <text className={estilos.rotuloDaJanela} x={fim} y={topo - 8} textAnchor="end">
          {rotuloDoFim}
        </text>
      ) : null}
    </>
  );
}

/** Um dos dois pontos com o valor escrito em cima: o último, cheio, e o de 1 ano antes, vazado. */
function Marco({ x, y, texto, vazado = false, ancora = "middle" }: { x: number; y: number; texto: string; vazado?: boolean; ancora?: "middle" | "end" }) {
  return (
    <g className={moldura.surgirDepois}>
      <circle className={vazado ? estilos.marcoVazado : estilos.marco} cx={x} cy={y} r={4} />
      <text className={estilos.rotuloDoMarco} x={ancora === "end" ? x + 4 : x} y={y - 12} textAnchor={ancora}>
        {texto}
      </text>
    </g>
  );
}

/**
 * "Média por mês até set/24: R$ 107.448 ↗ +11% vs 1 ano antes · out/23 a set/24 · no mês: R$ 92.310".
 * Perto do começo do gráfico, ela diz quantos dos 12 meses ficam antes dele. Curta, para caber em duas linhas.
 */
function LeituraDoPonto({ ponto, rotulo, mesesAntesDoGrafico }: { ponto: PontoDaLinha; rotulo: string; mesesAntesDoGrafico: number }) {
  const inicio = formatarMesAno(somarMeses(ponto.mes, 1 - MESES_DO_ANO));
  const fim = formatarMesAno(ponto.mes);
  return (
    <>
      <TituloDaLeitura>
        {rotulo} até {fim}
      </TituloDaLeitura>
      <Valor valor={ponto.valor} />
      {ponto.anoAntes ? <Variacao razao={ponto.valor / ponto.anoAntes - 1} referencia="vs 1 ano antes" /> : null}
      <ParteSecundaria>
        · {inicio} a {fim}
        {mesesAntesDoGrafico > 0 ? ` (${mesesAntesDoGrafico} antes do gráfico)` : ""} · no mês: <Valor valor={ponto.faturado} />
      </ParteSecundaria>
    </>
  );
}

function Tabela({ pontos, rotulo }: { pontos: PontoDaLinha[]; rotulo: string }) {
  return (
    <div className={moldura.tabelaRolagem}>
      <table className={moldura.tabela}>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Faturado no mês</th>
            <th scope="col">{rotulo} de 12 meses</th>
            <th scope="col">Em 1 ano</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((ponto) => (
            <tr key={ponto.mes}>
              <th scope="row">{formatarMesAno(ponto.mes)}</th>
              <td>
                <Valor valor={ponto.faturado} />
              </td>
              <td>
                <Valor valor={ponto.valor} />
              </td>
              <td>{ponto.anoAntes ? <Variacao razao={ponto.valor / ponto.anoAntes - 1} /> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Desde nov/22: ↗ +3% na média por mês": o resumo da linha acima do desenho, na ficha e no Início. */
export function ResumoDaTendencia({ desde, variacao }: { desde: string; variacao: number | null }) {
  return (
    <>
      <span>Desde {formatarMesAno(desde)}:</span>
      <Variacao razao={variacao} referencia="na média por mês" />
    </>
  );
}
