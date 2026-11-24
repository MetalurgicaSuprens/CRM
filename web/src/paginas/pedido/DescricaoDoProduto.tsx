import { partNumberDaBusca } from "../../dados/busca";
import type { ProdutoDoCatalogo } from "../../dados/tipos";

type Props = { produto: Pick<ProdutoDoCatalogo, "familia" | "medida" | "partNumberDoCliente">; busca?: string; className?: string };

/** A descrição do produto, com todos os part numbers do cliente na dica quando ele tem mais de um. */
export function DescricaoDoProduto({ produto, busca = "", className }: Props) {
  const { opcoes } = produto.partNumberDoCliente;
  const dica = opcoes.length > 1 ? `Part numbers do cliente: ${opcoes.join(", ")}` : undefined;
  return (
    <span className={className} title={dica}>
      {descricaoDe(produto, busca)}
    </span>
  );
}

/**
 * "FLEXIL · 14–22 mm · part number 01853 +1": a medida e o part number só quando existem. O part number é
 * só o do cliente, o mesmo que o item oferece; o da Bíblia Montadora, igual para todos, não aparece
 * (pedido do Lucas em 2026-11-24). Com mais de um, o que a busca achou (ou o sugerido, ou o primeiro) e
 * quantos mais o cliente tem.
 */
function descricaoDe(produto: Props["produto"], busca: string): string {
  const { opcoes, sugerido } = produto.partNumberDoCliente;
  const destaque = partNumberDaBusca(opcoes, busca) ?? sugerido ?? opcoes[0];
  const outros = opcoes.length - 1;
  const partNumber = destaque ? `part number ${destaque}${outros > 0 ? ` +${outros}` : ""}` : null;
  return [produto.familia, produto.medida, partNumber].filter(Boolean).join(" · ");
}
