import { fotoDoProduto } from "../dados/fotoDaFamilia";
import estilos from "./FotoDaFamilia.module.css";

/*
 * O quadrinho com a foto da família do produto, nos itens do pedido e na busca: ajuda a achar o produto
 * certo de relance. A foto é ilustração, e o nome da família já está escrito ao lado: ela não tem texto
 * alternativo. A família sem foto fica com o quadrinho vazio, para as linhas continuarem alinhadas.
 */

export function FotoDaFamilia({ codigo, familia, className }: { codigo: string; familia: string; className?: string }) {
  const foto = fotoDoProduto(codigo, familia);
  const classes = className ? `${estilos.quadro} ${className}` : estilos.quadro;
  return (
    <span className={classes} aria-hidden="true">
      {foto ? <img className={estilos.foto} src={foto} alt="" loading="lazy" decoding="async" /> : <span className={estilos.semFoto}>sem foto</span>}
    </span>
  );
}
