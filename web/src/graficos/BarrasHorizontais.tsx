import { Valor } from "../componentes/Valor";
import { formatarNumero, formatarParticipacao } from "../formato";
import estilos from "./BarrasHorizontais.module.css";

export type BarraHorizontal = {
  rotulo: string;
  valor: number;
  participacao: number;
  /** As peças do mesmo período, na última coluna. */
  pecas: number;
};

type Props = {
  barras: BarraHorizontal[];
  descricao: string;
  /** O título da coluna dos rótulos, como "Família". */
  tituloDoRotulo: string;
};

/**
 * Uma série só: todas as barras na mesma cor, comprimento proporcional à maior, com a parte, o valor
 * e as peças ao lado e o cabeçalho das colunas. No celular, o valor sai e as peças ficam: elas não
 * somem com "Ocultar valores".
 */
export function BarrasHorizontais({ barras, descricao, tituloDoRotulo }: Props) {
  const maior = Math.max(1, ...barras.map((barra) => barra.valor));
  return (
    <div className={estilos.barras}>
      <p className={`${estilos.linha} ${estilos.cabecalho}`} aria-hidden="true">
        <span>{tituloDoRotulo}</span>
        <span />
        <span className={estilos.participacao}>Parte</span>
        <span className={estilos.valor}>Faturado</span>
        <span className={estilos.pecas}>Peças</span>
      </p>
      <ul className={estilos.lista} aria-label={descricao}>
        {barras.map((barra) => (
          <li key={barra.rotulo} className={estilos.linha}>
            <span className={estilos.rotulo}>{barra.rotulo}</span>
            <span className={estilos.trilho} aria-hidden="true">
              <span className={estilos.barra} style={{ width: `${(barra.valor / maior) * 100}%` }} />
            </span>
            <span className={estilos.participacao}>{formatarParticipacao(barra.participacao)}</span>
            <span className={estilos.valor}>
              <Valor valor={barra.valor} compacto />
            </span>
            <span className={estilos.pecas}>
              {formatarNumero(barra.pecas)}
              <span className="visualmente-oculto"> peças</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
