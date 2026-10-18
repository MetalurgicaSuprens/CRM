import { useState, type ReactNode } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { formatarCompacto, formatarMesAno, formatarNumero } from "../formato";
import estilos from "./BlocosDe12Meses.module.css";
import moldura from "./moldura.module.css";

export type BlocoDe12Meses = {
  /** O primeiro e o último mês do bloco ("2025-10" e "2026-09"). */
  inicio: string;
  fim: string;
  valor: number;
  pecas: number;
};

type Props = {
  blocos: BlocoDe12Meses[];
  descricao: string;
};

type Medida = {
  titulo: string;
  de: (bloco: BlocoDe12Meses) => number;
  rotular: (valor: number) => ReactNode;
};

/** Um painel para cada medida, cada um na sua escala: nunca dois eixos no mesmo desenho. */
const MEDIDAS: readonly Medida[] = [
  { titulo: "Faturado", de: ({ valor }) => valor, rotular: (valor) => <Valor valor={valor} compacto /> },
  { titulo: "Peças", de: ({ pecas }) => pecas, rotular: (pecas) => formatarCompacto(pecas) },
];

/** A barra mais alta de cada painel, em px; o número e a variação vão em cima de cada barra. */
const ALTURA_DA_BARRA = 64;

/**
 * Os blocos de 12 meses lado a lado, no faturado e nas peças: cada barra com o número em cima e a
 * variação contra o bloco anterior. Se o faturado sobe e as peças não, a alta é preço.
 */
export function BlocosDe12Meses({ blocos, descricao }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  if (blocos.length === 0) return <p className={estilos.vazio}>Ainda não há 12 meses fechados de história para comparar.</p>;
  return (
    <figure className={moldura.figura}>
      <div className={moldura.topo}>
        <span />
        <button type="button" className={moldura.alternar} onClick={() => setComoTabela((anterior) => !anterior)} aria-pressed={comoTabela}>
          {comoTabela ? <ChartColumn size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
          {comoTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {comoTabela ? <Tabela blocos={blocos} /> : <Desenho blocos={blocos} descricao={descricao} />}
    </figure>
  );
}

function Desenho({ blocos, descricao }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const blocoAtivo = ativo === null ? undefined : blocos[ativo];
  return (
    <div className={`${moldura.desenho} ${estilos.desenho}`} role="group" aria-label={descricao}>
      {MEDIDAS.map((medida, i) => (
        <Painel key={medida.titulo} medida={medida} blocos={blocos} ativo={ativo} aoApontar={setAtivo} isFocavel={i === 0} />
      ))}
      <div className={estilos.periodos} aria-hidden="true">
        {blocos.map(({ inicio, fim }) => (
          <span key={fim}>
            {formatarMesAno(inicio)}–<wbr />
            {formatarMesAno(fim)}
          </span>
        ))}
      </div>
      {blocoAtivo && ativo !== null ? <Dica bloco={blocoAtivo} indice={ativo} total={blocos.length} /> : null}
    </div>
  );
}

type PropsDoPainel = {
  medida: Medida;
  blocos: BlocoDe12Meses[];
  ativo: number | null;
  aoApontar: (indice: number | null) => void;
  /** Só o primeiro painel recebe o foco do teclado: a dica do bloco mostra as duas medidas. */
  isFocavel: boolean;
};

function Painel({ medida, blocos, ativo, aoApontar, isFocavel }: PropsDoPainel) {
  const maior = Math.max(1, ...blocos.map(medida.de));
  return (
    <div className={estilos.painel}>
      <p className={estilos.tituloDoPainel}>{medida.titulo}</p>
      <div className={estilos.colunas}>
        {blocos.map((bloco, i) => {
          const valor = medida.de(bloco);
          const anterior = blocos[i - 1];
          return (
            <div
              key={bloco.fim}
              className={i === ativo ? `${estilos.coluna} ${estilos.ativa}` : estilos.coluna}
              tabIndex={isFocavel ? 0 : undefined}
              aria-label={isFocavel ? `12 meses de ${formatarMesAno(bloco.inicio)} a ${formatarMesAno(bloco.fim)}` : undefined}
              onPointerEnter={() => aoApontar(i)}
              onPointerLeave={() => aoApontar(null)}
              onFocus={() => aoApontar(i)}
              onBlur={() => aoApontar(null)}
            >
              <span className={estilos.variacao}>{anterior ? <Variacao razao={valor / medida.de(anterior) - 1} /> : null}</span>
              <span className={estilos.valor}>{medida.rotular(valor)}</span>
              {valor > 0 ? (
                <span className={`${estilos.barra} ${moldura.crescer}`} style={{ height: Math.max(2, (valor / maior) * ALTURA_DA_BARRA) }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A dica fica em cima do desenho e recua a própria largura na proporção em que o bloco está nele. */
function Dica({ bloco, indice, total }: { bloco: BlocoDe12Meses; indice: number; total: number }) {
  const centro = ((indice + 0.5) / total) * 100;
  return (
    <div className={moldura.dica} style={{ left: `${centro}%`, transform: `translate(-${centro}%, -8px)` }} role="status">
      <p className={moldura.dicaTitulo}>
        12 meses de {formatarMesAno(bloco.inicio)} a {formatarMesAno(bloco.fim)}
      </p>
      <p className={estilos.dicaLinha}>
        <strong>
          <Valor valor={bloco.valor} />
        </strong>
      </p>
      <p className={estilos.dicaLinha}>{formatarNumero(bloco.pecas)} peças</p>
    </div>
  );
}

function Tabela({ blocos }: { blocos: BlocoDe12Meses[] }) {
  return (
    <div className={moldura.tabelaRolagem}>
      <table className={moldura.tabela}>
        <thead>
          <tr>
            <th scope="col">12 meses</th>
            <th scope="col">Faturado</th>
            <th scope="col">Variação</th>
            <th scope="col">Peças</th>
            <th scope="col">Variação</th>
          </tr>
        </thead>
        <tbody>
          {blocos.map((bloco, i) => {
            const anterior = blocos[i - 1];
            return (
              <tr key={bloco.fim}>
                <th scope="row">
                  {formatarMesAno(bloco.inicio)} a {formatarMesAno(bloco.fim)}
                </th>
                <td>
                  <Valor valor={bloco.valor} />
                </td>
                <td>{anterior ? <Variacao razao={bloco.valor / anterior.valor - 1} /> : "—"}</td>
                <td>{formatarNumero(bloco.pecas)}</td>
                <td>{anterior ? <Variacao razao={bloco.pecas / anterior.pecas - 1} /> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
