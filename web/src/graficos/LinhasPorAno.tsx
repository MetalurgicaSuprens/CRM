import { useState } from "react";
import { ChartLine, Table2 } from "lucide-react";
import { useFormatoDeReais } from "../contexto/valores";
import { Valor } from "../componentes/Valor";
import { formatarMesCurto, formatarNomeDoMes } from "../formato";
import { eixoRedondo, escalarAltura } from "./escala";
import { GradeDoEixo } from "./GradeDoEixo";
import { useLargura } from "./useLargura";
import estilos from "./LinhasPorAno.module.css";
import moldura from "./moldura.module.css";

export type AnoAcumulado = {
  ano: number;
  /** O faturado somado de janeiro até cada mês: 12 valores no ano inteiro, menos no ano corrente. */
  acumulado: number[];
};

type Props = {
  anos: AnoAcumulado[];
  descricao: string;
  altura?: number;
};

const MARGEM = { topo: 18, direita: 46, base: 28, esquerda: 50 };
const MESES_DO_ANO = 12;
/** Os meses do eixo, de um ano qualquer: só o nome deles importa. */
const MESES = Array.from({ length: MESES_DO_ANO }, (_, i) => `2000-${String(i + 1).padStart(2, "0")}`);
const ESPACO_MINIMO_DO_MES = 30;
const ESPACO_ENTRE_ROTULOS = 14;
/** Os passos da rampa do dado, do ano mais antigo ao mais recente, que fica com o mais escuro. */
const TONS_DOS_ANOS = [estilos.tom1, estilos.tom2, estilos.tom3, estilos.tom4];

function tomDoAno(indice: number, total: number): string | undefined {
  return TONS_DOS_ANOS[TONS_DOS_ANOS.length - total + indice];
}

/**
 * Uma linha por ano, de janeiro a dezembro, com o faturado somado até cada mês. No mesmo mês, a linha
 * mais alta é o ano em que o cliente mais comprou até ali; o fim de cada linha é o total do ano.
 */
export function LinhasPorAno({ anos, descricao, altura = 240 }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  if (anos.length === 0) return <p className={estilos.vazio}>Ainda não há um ano inteiro de história para comparar.</p>;
  return (
    <figure className={moldura.figura}>
      <div className={moldura.topo}>
        <Legenda anos={anos} />
        <button type="button" className={moldura.alternar} onClick={() => setComoTabela((anterior) => !anterior)} aria-pressed={comoTabela}>
          {comoTabela ? <ChartLine size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
          {comoTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {comoTabela ? <Tabela anos={anos} /> : <Desenho anos={anos} descricao={descricao} altura={altura} />}
    </figure>
  );
}

function Desenho({ anos, descricao, altura }: Required<Props>) {
  const { referencia, largura } = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const formato = useFormatoDeReais();
  const larguraPlot = Math.max(0, largura - MARGEM.esquerda - MARGEM.direita);
  const alturaPlot = altura - MARGEM.topo - MARGEM.base;
  const passo = larguraPlot / (MESES_DO_ANO - 1);
  const eixo = eixoRedondo(Math.max(0, ...anos.flatMap(({ acumulado }) => acumulado)));
  const x = (mes: number) => MARGEM.esquerda + passo * mes;
  const y = (valor: number) => MARGEM.topo + alturaPlot - escalarAltura(valor, eixo.maximo, alturaPlot);
  const intervaloDosMeses = passo >= ESPACO_MINIMO_DO_MES ? 1 : 2;
  const recente = anos.length - 1;

  return (
    <div ref={referencia} className={moldura.desenho}>
      {largura > 0 ? (
        <svg width={largura} height={altura} role="img" aria-label={descricao} className={moldura.svg}>
          <GradeDoEixo eixo={eixo} y={y} inicio={MARGEM.esquerda} fim={largura - MARGEM.direita} rotular={formato.eixo} />
          {MESES.map((mes, i) =>
            i % intervaloDosMeses === 0 ? (
              <text key={mes} className={moldura.rotulo} x={x(i)} y={altura - 8} textAnchor="middle">
                {formatarMesCurto(mes)}
              </text>
            ) : null,
          )}
          {ativo !== null ? <line className={estilos.cursor} x1={x(ativo)} x2={x(ativo)} y1={MARGEM.topo} y2={y(0)} /> : null}
          {anos.map((ano, i) => (
            <path
              key={ano.ano}
              className={`${estilos.linha} ${tomDoAno(i, anos.length)} ${i === recente ? estilos.maisRecente : ""} ${moldura.tracar}`}
              d={ano.acumulado.map((valor, mes) => `${mes === 0 ? "M" : "L"}${x(mes)},${y(valor)}`).join(" ")}
              pathLength={1}
            />
          ))}
          <g className={moldura.surgirDepois}>
            {posicionarRotulos(anos, x, y, altura - MARGEM.base).map((rotulo) => (
              <RotuloDoAno key={rotulo.ano} rotulo={rotulo} isRecente={rotulo.ano === anos[recente]?.ano} />
            ))}
          </g>
          {ativo !== null
            ? anos.map((ano, i) => {
                const valor = ano.acumulado[ativo];
                return valor === undefined ? null : (
                  <circle key={ano.ano} className={`${estilos.ponto} ${tomDoAno(i, anos.length)}`} cx={x(ativo)} cy={y(valor)} r={4} />
                );
              })
            : null}
          {MESES.map((mes, i) => {
            const inicio = Math.max(MARGEM.esquerda, x(i) - passo / 2);
            return (
              <rect
                key={mes}
                className={moldura.alvo}
                x={inicio}
                y={MARGEM.topo}
                width={Math.min(largura, x(i) + passo / 2) - inicio}
                height={alturaPlot}
                tabIndex={0}
                aria-label={`Até ${formatarNomeDoMes(mes)}: ${anos.map((ano) => `${ano.ano}, ${ano.acumulado[i] === undefined ? "ainda não fechou" : formato.reais(ano.acumulado[i] ?? 0)}`).join("; ")}`}
                onPointerEnter={() => setAtivo(i)}
                onPointerLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
              />
            );
          })}
        </svg>
      ) : null}
      {ativo !== null ? <Dica anos={anos} mes={ativo} centro={x(ativo)} larguraDesenho={largura} /> : null}
    </div>
  );
}

type RotuloNoFim = {
  ano: number;
  /** A ponta da linha. */
  xDoFim: number;
  yDoFim: number;
  /** Onde o rótulo fica: na borda direita, afastado dos outros, ou em cima da ponta. */
  y: number;
  isNaBorda: boolean;
};

/**
 * O ano escrito na ponta de cada linha. Os anos inteiros terminam em dezembro, na borda direita: lá, os
 * rótulos se afastam para não se sobrepor, ligados à ponta por um fio. O ano corrente termina antes e
 * leva o rótulo em cima do último ponto.
 */
function posicionarRotulos(anos: readonly AnoAcumulado[], x: (mes: number) => number, y: (valor: number) => number, base: number): RotuloNoFim[] {
  const rotulos = anos.map(({ ano, acumulado }) => {
    const yDoFim = y(acumulado.at(-1) ?? 0);
    const isNaBorda = acumulado.length === MESES_DO_ANO;
    return { ano, xDoFim: x(acumulado.length - 1), yDoFim, y: isNaBorda ? yDoFim : yDoFim - 12, isNaBorda };
  });
  const naBorda = rotulos.filter(({ isNaBorda }) => isNaBorda).sort((a, b) => a.yDoFim - b.yDoFim);
  let anterior = -Infinity;
  for (const rotulo of naBorda) {
    rotulo.y = Math.max(rotulo.yDoFim, anterior + ESPACO_ENTRE_ROTULOS);
    anterior = rotulo.y;
  }
  const sobra = anterior - base;
  if (sobra > 0) for (const rotulo of naBorda) rotulo.y -= sobra;
  return rotulos;
}

function RotuloDoAno({ rotulo, isRecente }: { rotulo: RotuloNoFim; isRecente: boolean }) {
  const classe = isRecente ? `${estilos.rotuloDoAno} ${estilos.rotuloRecente}` : estilos.rotuloDoAno;
  if (!rotulo.isNaBorda) {
    return (
      <text className={classe} x={rotulo.xDoFim} y={rotulo.y} textAnchor="middle">
        {rotulo.ano}
      </text>
    );
  }
  const isAfastado = Math.abs(rotulo.y - rotulo.yDoFim) > 2;
  return (
    <g>
      {isAfastado ? <line className={estilos.fio} x1={rotulo.xDoFim + 3} y1={rotulo.yDoFim} x2={rotulo.xDoFim + 8} y2={rotulo.y} /> : null}
      <text className={classe} x={rotulo.xDoFim + 10} y={rotulo.y + 4}>
        {rotulo.ano}
      </text>
    </g>
  );
}

function Legenda({ anos }: { anos: AnoAcumulado[] }) {
  return (
    <ul className={estilos.legenda}>
      {anos.map(({ ano }, i) => (
        <li key={ano}>
          <span className={`${estilos.chave} ${tomDoAno(i, anos.length)}`} aria-hidden="true" />
          {ano}
        </li>
      ))}
    </ul>
  );
}

/** Do ano mais recente ao mais antigo; a dica recua a própria largura na proporção em que o mês está no desenho. */
function Dica({ anos, mes, centro, larguraDesenho }: { anos: AnoAcumulado[]; mes: number; centro: number; larguraDesenho: number }) {
  const recuo = larguraDesenho > 0 ? (centro / larguraDesenho) * 100 : 50;
  const comValor = anos.map((ano, i) => ({ ...ano, tom: tomDoAno(i, anos.length) })).filter(({ acumulado }) => acumulado[mes] !== undefined);
  return (
    <div className={moldura.dica} style={{ left: centro, transform: `translate(-${recuo}%, -8px)` }} role="status">
      <p className={moldura.dicaTitulo}>Até {formatarNomeDoMes(MESES[mes] ?? "")}</p>
      <div className={estilos.dicaLinhas}>
        {comValor.reverse().map(({ ano, acumulado, tom }) => (
          <span key={ano} className={estilos.dicaLinha}>
            <span className={`${estilos.chave} ${tom}`} aria-hidden="true" />
            <strong className={estilos.dicaValor}>
              <Valor valor={acumulado[mes] ?? 0} />
            </strong>
            <span className={estilos.dicaRotulo}>{ano}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Tabela({ anos }: { anos: AnoAcumulado[] }) {
  return (
    <div className={moldura.tabelaRolagem}>
      <table className={moldura.tabela}>
        <thead>
          <tr>
            <th scope="col">Até</th>
            {anos.map(({ ano }) => (
              <th key={ano} scope="col">
                {ano}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MESES.map((mes, i) => (
            <tr key={mes}>
              <th scope="row">{formatarNomeDoMes(mes)}</th>
              {anos.map(({ ano, acumulado }) => (
                <td key={ano}>{acumulado[i] === undefined ? "—" : <Valor valor={acumulado[i] ?? 0} />}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
