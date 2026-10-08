import { criarAleatorio } from "./aleatorio";

/** Famílias do protótipo: prefixo do código, parte dos clientes que compra e preço-base do cento. */
export const FAMILIAS = [
  { nome: "FLEXIL", prefixo: "FAB", popularidade: 0.85, precoCento: 95 },
  { nome: "PRESIL", prefixo: "PRB", popularidade: 0.7, precoCento: 120 },
  { nome: "MICRO", prefixo: "MAB", popularidade: 0.55, precoCento: 140 },
  { nome: "TIGRE", prefixo: "TGR", popularidade: 0.4, precoCento: 180 },
  { nome: "ZIP", prefixo: "ZIP", popularidade: 0.35, precoCento: 75 },
  { nome: "SIMPLEX", prefixo: "SPX", popularidade: 0.3, precoCento: 60 },
  { nome: "RADIAL", prefixo: "ARI", popularidade: 0.25, precoCento: 210 },
  { nome: "MOLA", prefixo: "AMD", popularidade: 0.2, precoCento: 110 },
  { nome: "TUCHO CANALETA", prefixo: "TCC", popularidade: 0.2, precoCento: 260 },
  { nome: "STEPLESS", prefixo: "STP", popularidade: 0.15, precoCento: 230 },
] as const;

const MEDIDAS = ["8–12 mm", "10–16 mm", "12–22 mm", "16–27 mm", "20–32 mm", "25–40 mm", "32–50 mm", "40–60 mm", "50–70 mm", "60–80 mm"];

export type ProdutoBase = {
  codigo: string;
  familia: string;
  medida: string;
  /** Peças por embalagem. */
  embalagem: number;
  /** Preço do cento antes da tabela de cada cliente. */
  precoBase: number;
};

let catalogoEmCache: ProdutoBase[] | null = null;

/** O mesmo catálogo para todos os clientes; o preço muda pela tabela de cada um. */
export function catalogoFicticio(): ProdutoBase[] {
  catalogoEmCache ??= gerarCatalogo();
  return catalogoEmCache;
}

function gerarCatalogo(): ProdutoBase[] {
  const aleatorio = criarAleatorio(2026);
  const usados = new Set<string>();
  const codigoNovo = (prefixo: string): string => {
    let codigo: string;
    do codigo = `${prefixo}${aleatorio.inteiro(10_000, 99_999)}`;
    while (usados.has(codigo));
    usados.add(codigo);
    return codigo;
  };
  return FAMILIAS.flatMap((familia) =>
    MEDIDAS.map((medida, indice) => ({
      codigo: codigoNovo(familia.prefixo),
      familia: familia.nome,
      medida,
      embalagem: indice < 5 ? 100 : 50,
      precoBase: Math.round(familia.precoCento * (1 + 0.12 * indice)),
    })),
  );
}
