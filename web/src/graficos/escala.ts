export type Eixo = {
  maximo: number;
  marcas: number[];
};

const PASSOS_REDONDOS = [1, 2, 2.5, 5, 10];

/** Eixo de zero até um teto redondo, com cerca de `quantidadeAlvo` intervalos. */
export function eixoRedondo(maiorValor: number, quantidadeAlvo = 4): Eixo {
  if (!(maiorValor > 0)) return { maximo: 1, marcas: [0, 1] };
  const passo = passoRedondo(maiorValor / quantidadeAlvo);
  const maximo = Math.ceil(maiorValor / passo) * passo;
  const marcas: number[] = [];
  for (let marca = 0; marca <= maximo + passo / 2; marca += passo) marcas.push(marca);
  return { maximo, marcas };
}

function passoRedondo(passoBruto: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(passoBruto));
  const fator = PASSOS_REDONDOS.find((passo) => passo * magnitude >= passoBruto) ?? 10;
  return fator * magnitude;
}

/** Converte um valor do domínio [0, maximo] para a altura em pixels [0, altura]. */
export function escalarAltura(valor: number, maximo: number, altura: number): number {
  return maximo > 0 ? (Math.max(0, valor) / maximo) * altura : 0;
}

/** Quantas vezes a maior média a escala aceita antes de cortar a barra: um mês de pedido grande não achata a linha. */
const FATOR_DO_CORTE = 2.5;

/**
 * O teto da escala do gráfico de barras com a linha da média: a barra mais alta, mas nunca acima de
 * FATOR_DO_CORTE vezes a maior média. A barra que passa dele é desenhada cortada no topo.
 */
export function tetoComCorte(barras: readonly number[], medias: readonly number[]): number {
  const maiorMedia = Math.max(0, ...medias);
  const maiorBarra = Math.max(0, ...barras);
  if (maiorMedia === 0) return maiorBarra;
  return Math.max(maiorMedia, Math.min(maiorBarra, maiorMedia * FATOR_DO_CORTE));
}
