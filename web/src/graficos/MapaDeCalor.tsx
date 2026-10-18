import { Fragment, useState } from "react";
import { Grid3x3, Table2 } from "lucide-react";
import { useFormatoDeReais } from "../contexto/valores";
import { Valor } from "../componentes/Valor";
import { formatarMesAno, formatarMesCurto, formatarMesPorExtenso } from "../formato";
import { passoNaRampa } from "./escala";
import estilos from "./MapaDeCalor.module.css";
import moldura from "./moldura.module.css";

export type AnoNoMapa = {
  ano: number;
  /** O faturado de cada mês, de janeiro a dezembro; null no mês que ainda não fechou. */
  meses: (number | null)[];
  mesesComCompra: number;
  mesesFechados: number;
};

type Props = {
  anos: AnoNoMapa[];
  descricao: string;
};

const MESES_DO_ANO = 12;
/** O mês sem compra (0) e os 5 passos da rampa do dado, do mês fraco ao mais forte. */
const PASSOS = [estilos.semCompra, estilos.passo1, estilos.passo2, estilos.passo3, estilos.passo4, estilos.passo5];

/**
 * Um ano por linha e um mês por quadrado: quanto mais escuro, mais o cliente faturou no mês,
 * comparado ao maior mês dos anos do mapa. Mostra o ritmo: os meses sem compra, a época do ano e
 * se a cor esmaece ou escurece de um ano para o outro.
 */
export function MapaDeCalor({ anos, descricao }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  return (
    <figure className={moldura.figura}>
      <div className={moldura.topo}>
        <Legenda />
        <button type="button" className={moldura.alternar} onClick={() => setComoTabela((anterior) => !anterior)} aria-pressed={comoTabela}>
          {comoTabela ? <Grid3x3 size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}
          {comoTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {comoTabela ? <Tabela anos={anos} /> : <Grade anos={anos} descricao={descricao} />}
    </figure>
  );
}

function Grade({ anos, descricao }: Props) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const formato = useFormatoDeReais();
  const maior = Math.max(0, ...anos.flatMap(({ meses }) => meses.map((valor) => valor ?? 0)));
  return (
    <div className={estilos.mapa}>
      <div className={estilos.grade} role="group" aria-label={descricao}>
        <span />
        {mesesDoAno(2000).map((mes) => (
          <span key={mes} className={estilos.mes} aria-hidden="true">
            <span className={estilos.mesInteiro}>{formatarMesCurto(mes)}</span>
            <span className={estilos.inicial}>{formatarMesCurto(mes).charAt(0)}</span>
          </span>
        ))}
        <span className={estilos.tituloDaContagem} aria-hidden="true">
          Com compra
        </span>
        {anos.map(({ ano, meses, mesesComCompra, mesesFechados }) => (
          <Fragment key={ano}>
            <span className={estilos.ano}>{ano}</span>
            {mesesDoAno(ano).map((mes, i) => {
              const valor = meses[i] ?? null;
              if (valor === null) return <span key={mes} />;
              return (
                <span
                  key={mes}
                  className={`${estilos.celula} ${PASSOS[passoNaRampa(valor, maior)]} ${moldura.surgir}`}
                  tabIndex={0}
                  aria-label={`${formatarMesAno(mes)}: ${valor > 0 ? formato.reais(valor) : "sem compra"}`}
                  onPointerEnter={() => setAtivo(mes)}
                  onPointerLeave={() => setAtivo(null)}
                  onFocus={() => setAtivo(mes)}
                  onBlur={() => setAtivo(null)}
                >
                  {ativo === mes ? <Dica mes={mes} valor={valor} coluna={i} /> : null}
                </span>
              );
            })}
            <span className={estilos.contagem}>
              {mesesComCompra} de {mesesFechados}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function mesesDoAno(ano: number): string[] {
  return Array.from({ length: MESES_DO_ANO }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

/** A dica fica em cima do quadrado; nas três primeiras e nas três últimas colunas, rente à borda. */
function Dica({ mes, valor, coluna }: { mes: string; valor: number; coluna: number }) {
  const lado = coluna < 3 ? estilos.aEsquerda : coluna >= MESES_DO_ANO - 3 ? estilos.aDireita : estilos.noCentro;
  return (
    <span className={`${moldura.dica} ${estilos.dica} ${lado}`} role="status">
      <span className={moldura.dicaTitulo}>{formatarMesPorExtenso(mes)}</span>
      <strong>{valor > 0 ? <Valor valor={valor} /> : "Sem compra"}</strong>
    </span>
  );
}

function Legenda() {
  return (
    <div className={estilos.legenda}>
      <span className={estilos.itemDaLegenda}>
        <span className={`${estilos.amostra} ${estilos.semCompra}`} aria-hidden="true" />
        Sem compra
      </span>
      <span className={estilos.itemDaLegenda}>
        Menos
        {PASSOS.slice(1).map((passo) => (
          <span key={passo} className={`${estilos.amostra} ${passo}`} aria-hidden="true" />
        ))}
        Mais
      </span>
    </div>
  );
}

function Tabela({ anos }: { anos: AnoNoMapa[] }) {
  return (
    <div className={moldura.tabelaRolagem}>
      <table className={moldura.tabela}>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            {mesesDoAno(2000).map((mes) => (
              <th key={mes} scope="col">
                {formatarMesCurto(mes)}
              </th>
            ))}
            <th scope="col">Com compra</th>
          </tr>
        </thead>
        <tbody>
          {anos.map(({ ano, meses, mesesComCompra, mesesFechados }) => (
            <tr key={ano}>
              <th scope="row">{ano}</th>
              {meses.map((valor, i) => (
                <td key={i}>{valor === null ? "—" : <Valor valor={valor} compacto />}</td>
              ))}
              <td>
                {mesesComCompra} de {mesesFechados}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
