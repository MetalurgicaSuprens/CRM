import type { Eixo } from "./escala";
import moldura from "./moldura.module.css";

type Props = {
  eixo: Eixo;
  y: (valor: number) => number;
  /** Onde as linhas começam e terminam, em px; os números ficam à esquerda do começo. */
  inicio: number;
  fim: number;
  rotular: (valor: number) => string;
};

/** As linhas do eixo de valores, finas e recuadas, com os números à esquerda; a do zero é a base. */
export function GradeDoEixo({ eixo, y, inicio, fim, rotular }: Props) {
  return (
    <g>
      {eixo.marcas.map((marca) => (
        <g key={marca}>
          <line className={marca === 0 ? moldura.linhaBase : moldura.linhaGrade} x1={inicio} x2={fim} y1={y(marca)} y2={y(marca)} />
          <text className={moldura.rotulo} x={inicio - 8} y={y(marca) + 4} textAnchor="end">
            {rotular(marca)}
          </text>
        </g>
      ))}
    </g>
  );
}
