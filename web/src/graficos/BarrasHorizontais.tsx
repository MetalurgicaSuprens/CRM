import { useFormatoDeReais } from "../contexto/valores";
import { formatarParticipacao } from "../formato";
import estilos from "./BarrasHorizontais.module.css";

export type BarraHorizontal = {
  rotulo: string;
  valor: number;
  participacao: number;
};

/** Uma série só: todas as barras na mesma cor, comprimento proporcional à maior. */
export function BarrasHorizontais({ barras, descricao }: { barras: BarraHorizontal[]; descricao: string }) {
  const formato = useFormatoDeReais();
  const maior = Math.max(1, ...barras.map((barra) => barra.valor));
  return (
    <ul className={estilos.lista} aria-label={descricao}>
      {barras.map((barra) => (
        <li key={barra.rotulo} className={estilos.linha}>
          <span className={estilos.rotulo}>{barra.rotulo}</span>
          <span className={estilos.trilho} aria-hidden="true">
            <span className={estilos.barra} style={{ width: `${(barra.valor / maior) * 100}%` }} />
          </span>
          <span className={estilos.participacao}>{formatarParticipacao(barra.participacao)}</span>
          <span className={estilos.valor}>{formato.reaisCompacto(barra.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
