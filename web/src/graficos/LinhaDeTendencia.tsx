import { useState } from "react";
import { ChartLine, Table2 } from "lucide-react";
import { useFormatoDeReais } from "../contexto/valores";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { formatarMesAno } from "../formato";
import { eixoRedondo, escalarAltura } from "./escala";
import { GradeDoEixo } from "./GradeDoEixo";
import { useLargura } from "./useLargura";
import estilos from "./LinhaDeTendencia.module.css";
import moldura from "./moldura.module.css";

export type PontoDaLinha = {
  mes: string;
  valor: number;
  /** O valor 12 meses antes, para a variação na dica e na tabela; null quando não há. */
  anoAntes: number | null;
};

type Props = {
  pontos: PontoDaLinha[];
  descricao: string;
  /** O nome do valor na dica e na tabela, como "Faturado em 12 meses". */
  rotulo: string;
  altura?: number;
};

const MARGEM = { topo: 24, direita: 14, base: 28, esquerda: 50 };
const MESES_DO_ANO = 12;

/**
 * Uma série só, no tempo: a linha com a área clara embaixo, a partir do zero. Só dois pontos têm o
 * valor escrito, o último e o de 1 ano antes; os outros ficam na dica e na tabela.
 */
export function LinhaDeTendencia({ pontos, descricao, rotulo, altura = 240 }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  if (pontos.length < 2) return <p className={estilos.vazio}>Ainda não há 12 meses de história para mostrar a tendência.</p>;
  return (
    <figure className={moldura.figura}>
      <div className={moldura.topo}>
        <span />
        <button type="button" className={moldura.alternar} onClick={() => setComoTabela((anterior) => !anterior)} aria-pressed={comoTabela}>
          {comoTabela ? <ChartLine size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
          {comoTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {comoTabela ? <Tabela pontos={pontos} rotulo={rotulo} /> : <Desenho pontos={pontos} rotulo={rotulo} descricao={descricao} altura={altura} />}
    </figure>
  );
}

function Desenho({ pontos, rotulo, descricao, altura }: Required<Pick<Props, "altura">> & Omit<Props, "altura">) {
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const formato = useFormatoDeReais();
  const larguraPlot = Math.max(0, largura - MARGEM.esquerda - MARGEM.direita);
  const alturaPlot = altura - MARGEM.topo - MARGEM.base;
  const passo = larguraPlot / (pontos.length - 1);
  const eixo = eixoRedondo(Math.max(0, ...pontos.map((ponto) => ponto.valor)));
  const x = (indice: number) => MARGEM.esquerda + passo * indice;
  const y = (valor: number) => MARGEM.topo + alturaPlot - escalarAltura(valor, eixo.maximo, alturaPlot);
  const linha = pontos.map((ponto, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(ponto.valor)}`).join(" ");
  const ultimo = pontos.length - 1;
  const umAnoAntes = ultimo - MESES_DO_ANO >= 0 ? ultimo - MESES_DO_ANO : null;
  const pontoAtivo = ativo === null ? undefined : pontos[ativo];

  return (
    <div ref={referencia} className={moldura.desenho}>
      {largura > 0 ? (
        <svg width={largura} height={altura} role="img" aria-label={descricao} className={moldura.svg}>
          <GradeDoEixo eixo={eixo} y={y} inicio={MARGEM.esquerda} fim={largura - MARGEM.direita} rotular={formato.eixo} />
          <path className={estilos.area} d={`${linha} L${x(ultimo)},${y(0)} L${x(0)},${y(0)} Z`} />
          <path className={estilos.linha} d={linha} />
          {pontos.map((ponto, i) =>
            ponto.mes.endsWith("-01") ? (
              <text key={ponto.mes} className={moldura.rotulo} x={x(i)} y={altura - 8} textAnchor="middle">
                {ponto.mes.slice(0, 4)}
              </text>
            ) : null,
          )}
          {pontoAtivo && ativo !== null ? <line className={estilos.cursor} x1={x(ativo)} x2={x(ativo)} y1={MARGEM.topo} y2={y(0)} /> : null}
          {umAnoAntes !== null ? (
            <Marco x={x(umAnoAntes)} y={y(pontos[umAnoAntes]?.valor ?? 0)} texto={`há 1 ano: ${formato.reaisCompacto(pontos[umAnoAntes]?.valor ?? 0)}`} vazado />
          ) : null}
          <Marco x={x(ultimo)} y={y(pontos[ultimo]?.valor ?? 0)} texto={formato.reaisCompacto(pontos[ultimo]?.valor ?? 0)} ancora="end" />
          {pontoAtivo && ativo !== null ? <circle className={estilos.pontoAtivo} cx={x(ativo)} cy={y(pontoAtivo.valor)} r={4.5} /> : null}
          {pontos.map((ponto, i) => (
            <rect
              key={ponto.mes}
              className={moldura.alvo}
              x={Math.max(MARGEM.esquerda, x(i) - passo / 2)}
              y={MARGEM.topo}
              width={passo}
              height={alturaPlot}
              tabIndex={0}
              aria-label={`${rotulo} até ${formatarMesAno(ponto.mes)}: ${formato.reais(ponto.valor)}`}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            />
          ))}
        </svg>
      ) : null}
      {pontoAtivo && ativo !== null ? <Dica ponto={pontoAtivo} rotulo={rotulo} centro={x(ativo)} larguraDesenho={largura} /> : null}
    </div>
  );
}

/** Um dos dois pontos com o valor escrito em cima: o último, cheio, e o de 1 ano antes, vazado. */
function Marco({ x, y, texto, vazado = false, ancora = "middle" }: { x: number; y: number; texto: string; vazado?: boolean; ancora?: "middle" | "end" }) {
  return (
    <g>
      <circle className={vazado ? estilos.marcoVazado : estilos.marco} cx={x} cy={y} r={4} />
      <text className={estilos.rotuloDoMarco} x={ancora === "end" ? x + 4 : x} y={y - 12} textAnchor={ancora}>
        {texto}
      </text>
    </g>
  );
}

/** Para não sair do desenho, a dica recua a própria largura na mesma proporção em que o ponto está no gráfico. */
function Dica({ ponto, rotulo, centro, larguraDesenho }: { ponto: PontoDaLinha; rotulo: string; centro: number; larguraDesenho: number }) {
  const recuo = larguraDesenho > 0 ? (centro / larguraDesenho) * 100 : 50;
  return (
    <div className={moldura.dica} style={{ left: centro, transform: `translate(-${recuo}%, -8px)` }} role="status">
      <p className={moldura.dicaTitulo}>
        {rotulo} até {formatarMesAno(ponto.mes)}
      </p>
      <p className={estilos.dicaValor}>
        <Valor valor={ponto.valor} />
      </p>
      {ponto.anoAntes ? <Variacao razao={ponto.valor / ponto.anoAntes - 1} referencia="vs 1 ano antes" /> : null}
    </div>
  );
}

function Tabela({ pontos, rotulo }: { pontos: PontoDaLinha[]; rotulo: string }) {
  return (
    <div className={moldura.tabelaRolagem}>
      <table className={moldura.tabela}>
        <thead>
          <tr>
            <th scope="col">Até</th>
            <th scope="col">{rotulo}</th>
            <th scope="col">Em 1 ano</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((ponto) => (
            <tr key={ponto.mes}>
              <th scope="row">{formatarMesAno(ponto.mes)}</th>
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
