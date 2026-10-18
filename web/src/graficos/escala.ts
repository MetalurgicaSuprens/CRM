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

/**
 * O passo de um valor numa rampa de `passos` cores: 0 para zero ou menos, e de 1 a `passos` em faixas
 * iguais até `maior`, inclusive. O valor positivo mais baixo ainda cai no passo 1, que aparece.
 */
export function passoNaRampa(valor: number, maior: number, passos = 5): number {
  if (!(valor > 0) || !(maior > 0)) return 0;
  return Math.min(passos, Math.max(1, Math.ceil((valor / maior) * passos)));
}
