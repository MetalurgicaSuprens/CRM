import estilos from "./Sparkline.module.css";

type Props = {
  /** Do mais antigo ao mais recente. O primeiro valor vira a linha tracejada de referência. */
  valores: number[];
  largura?: number;
  altura?: number;
};

const MARGEM = 3;

/**
 * Tendência em miniatura, como nos aplicativos de cotação: a linha tracejada marca o ponto de
 * partida e o ponto no fim da linha, onde a série está hoje. A escala começa no zero, para a inclinação
 * ser proporcional à variação.
 */
export function Sparkline({ valores, largura = 88, altura = 32 }: Props) {
  if (valores.length < 2) return null;
  const maximo = Math.max(...valores, 1);
  const passo = (largura - MARGEM * 2) / (valores.length - 1);
  const alturaDe = (valor: number) => altura - MARGEM - (valor / maximo) * (altura - MARGEM * 2);
  const pontos = valores.map((valor, i) => ({ x: MARGEM + i * passo, y: alturaDe(valor) }));
  const caminho = pontos.map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const partida = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg className={estilos.sparkline} width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true">
      {partida ? <line className={estilos.referencia} x1={MARGEM} x2={largura - MARGEM} y1={partida.y} y2={partida.y} /> : null}
      <path className={estilos.linha} d={caminho} />
      {ultimo ? <circle className={estilos.ponto} cx={ultimo.x} cy={ultimo.y} r={3} /> : null}
    </svg>
  );
}

/** A linha tracejada em tamanho de legenda. */
export function AmostraReferencia() {
  return (
    <svg className={estilos.amostra} width={16} height={4} viewBox="0 0 16 4" aria-hidden="true">
      <line className={estilos.referencia} x1={0} x2={16} y1={2} y2={2} />
    </svg>
  );
}
