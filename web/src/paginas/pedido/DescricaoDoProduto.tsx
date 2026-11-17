import { partNumberDaBusca } from "../../dados/busca";
import type { ProdutoDoCatalogo } from "../../dados/tipos";

type Props = { produto: Pick<ProdutoDoCatalogo, "familia" | "medida" | "partNumbers">; busca?: string; className?: string };

/** A descrição do produto, com todos os part numbers na dica quando ele tem mais de um. */
export function DescricaoDoProduto({ produto, busca = "", className }: Props) {
  const dica = produto.partNumbers.length > 1 ? `Part numbers: ${produto.partNumbers.join(", ")}` : undefined;
  return (
    <span className={className} title={dica}>
      {descricaoDe(produto, busca)}
    </span>
  );
}

/**
 * "FLEXIL · 14–22 mm · part number N906227 +1": a medida e o part number só quando existem. Com mais
 * de um part number, o que a busca achou (ou o primeiro) e quantos mais o produto tem.
 */
function descricaoDe(produto: Props["produto"], busca: string): string {
  const destaque = partNumberDaBusca(produto.partNumbers, busca) ?? produto.partNumbers[0];
  const outros = produto.partNumbers.length - 1;
  const partNumber = destaque ? `part number ${destaque}${outros > 0 ? ` +${outros}` : ""}` : null;
  return [produto.familia, produto.medida, partNumber].filter(Boolean).join(" · ");
}
