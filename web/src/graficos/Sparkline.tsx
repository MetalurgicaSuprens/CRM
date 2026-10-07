import estilos from "./Sparkline.module.css";

type Props = {
  valores: number[];
  largura?: number;
  altura?: number;
};

const MARGEM = 3;

/** Tendência em miniatura: linha discreta e o último mês em destaque. */
export function Sparkline({ valores, largura = 88, altura = 26 }: Props) {
  if (valores.length < 2) return null;
  const maximo = Math.max(...valores, 1);
  const passo = (largura - MARGEM * 2) / (valores.length - 1);
  const pontos = valores.map((valor, i) => ({
    x: MARGEM + i * passo,
    y: altura - MARGEM - (valor / maximo) * (altura - MARGEM * 2),
  }));
  const caminho = pontos.map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg className={estilos.sparkline} width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true">
      <path className={estilos.linha} d={caminho} />
      {ultimo ? <circle className={estilos.ponto} cx={ultimo.x} cy={ultimo.y} r={3} /> : null}
    </svg>
  );
}
