import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Search } from "lucide-react";
import { FotoDaFamilia } from "../../componentes/FotoDaFamilia";
import { Valor } from "../../componentes/Valor";
import { correspondeAoProduto } from "../../dados/busca";
import { precoInicialDoItem } from "../../dados/pedido";
import type { ProdutoDoCatalogo } from "../../dados/tipos";
import { formatarDataCurta, formatarNumero } from "../../formato";
import estilos from "./BuscaDeProduto.module.css";
import { DescricaoDoProduto } from "./DescricaoDoProduto";

/*
 * A busca que inclui o item no pedido: o representante digita o código, a medida ou o part number,
 * anda pela lista com as setas e inclui com Enter. Com a busca vazia, a lista mostra o que o cliente já
 * comprou. O catálogo deixou de ser uma lista fixa ao lado do pedido (redesenho de 2026-11-17).
 */

/** Produtos na lista de uma vez: o catálogo de um cliente tem centenas, e a busca afunila. */
const MAXIMO_NA_LISTA = 40;
/** O espaço, em px, que a lista e os primeiros itens pedem embaixo do campo, contando o rodapé preso. */
const ALTURA_PARA_A_LISTA = 440;

type Props = {
  produtos: readonly ProdutoDoCatalogo[];
  /** As peças de cada produto que já está no pedido. */
  noPedido: ReadonlyMap<string, number>;
  aoEscolher: (produto: ProdutoDoCatalogo) => void;
  /** O campo da busca, para a lista de itens devolver o foco a ele depois da quantidade. */
  campo: RefObject<HTMLInputElement | null>;
};

export function BuscaDeProduto({ produtos, noPedido, aoEscolher, campo }: Props) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const [isAberta, setAberta] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const jaComprados = useMemo(() => produtos.filter((produto) => produto.jaComprou), [produtos]);
  const termo = busca.trim();
  const achados = useMemo(() => (termo ? produtos.filter((produto) => correspondeAoProduto(produto, termo)) : jaComprados), [produtos, jaComprados, termo]);
  const visiveis = achados.slice(0, MAXIMO_NA_LISTA);
  const raiz = useRef<HTMLDivElement>(null);
  const idDaOpcao = (indice: number) => `${id}-opcao-${indice}`;

  // Depois de a lista aparecer: é ela que estica a página, e só então há para onde rolar.
  useEffect(() => {
    if (isAberta && raiz.current) darLugarParaALista(raiz.current);
  }, [isAberta]);

  useEffect(() => {
    if (isAberta) document.getElementById(`${id}-opcao-${destaque}`)?.scrollIntoView({ block: "nearest" });
  }, [id, isAberta, destaque]);

  const escolher = (produto: ProdutoDoCatalogo) => {
    setBusca("");
    setAberta(false);
    setDestaque(0);
    aoEscolher(produto);
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape") return setAberta(false);
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setDestaque((atual) => (isAberta ? Math.min(Math.max(atual + passo, 0), Math.max(visiveis.length - 1, 0)) : 0));
      return setAberta(true);
    }
    const escolhido = visiveis[destaque];
    if (evento.key === "Enter" && isAberta && escolhido) {
      evento.preventDefault();
      escolher(escolhido);
    }
  };

  return (
    <div
      ref={raiz}
      className={estilos.busca}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setAberta(false);
      }}
    >
      <label className={estilos.campo}>
        <Search size={18} aria-hidden="true" />
        <span className="visualmente-oculto">Incluir produto no pedido</span>
        <input
          ref={campo}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={isAberta}
          aria-controls={`${id}-lista`}
          aria-activedescendant={isAberta && visiveis.length > 0 ? idDaOpcao(destaque) : undefined}
          value={busca}
          placeholder="Incluir produto: código, medida ou part number"
          onChange={(evento) => {
            setBusca(evento.target.value);
            setDestaque(0);
            setAberta(true);
          }}
          // Abre com o clique, a digitação ou a seta, e não só com o foco: depois de cada item o cursor volta
          // para cá, e a lista aberta cobriria o item que acabou de entrar.
          onClick={() => setAberta(true)}
          onKeyDown={aoTeclar}
        />
      </label>
      {isAberta ? (
        <div className={estilos.lista}>
          <p className={estilos.titulo}>{tituloDaLista(termo, achados.length, { jaComprados: jaComprados.length, total: produtos.length })}</p>
          <ul id={`${id}-lista`} role="listbox" aria-label="Produtos" className={estilos.opcoes}>
            {visiveis.map((produto, indice) => (
              <li
                key={produto.codigo}
                id={idDaOpcao(indice)}
                role="option"
                aria-selected={indice === destaque}
                className={estilos.opcao}
                // Sem isto, o clique tira o foco do campo e a lista fecha antes de o produto entrar.
                onMouseDown={(evento) => evento.preventDefault()}
                // Só com o mouse andando: parado sobre a lista, ele não rouba o destaque de quem usa as setas.
                onMouseMove={() => setDestaque(indice)}
                onClick={() => escolher(produto)}
              >
                <FotoDaFamilia codigo={produto.codigo} familia={produto.familia} className={estilos.foto} />
                <span className={estilos.produto}>
                  <span className={estilos.codigo}>{produto.codigo}</span>
                  <DescricaoDoProduto produto={produto} busca={busca} className={estilos.descricao} />
                </span>
                <span className={estilos.situacao}>{situacaoDoProduto(produto, noPedido.get(produto.codigo) ?? 0)}</span>
                <span className={estilos.embalagem}>{formatarNumero(produto.embalagem)} pç</span>
                <span className={estilos.preco}>
                  <Valor valor={precoInicialDoItem(produto)} comCentavos />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sem lugar para a lista embaixo do campo (tela baixa, ou o teclado do celular aberto), a página rola
 * até a busca ficar no alto: o cliente e as condições já foram conferidos, e a tela fica para os itens.
 * A folha dos itens tem pelo menos a altura da janela (DocumentoDoPedido.module.css), então há para onde rolar.
 */
function darLugarParaALista(campo: HTMLElement): void {
  if (window.innerHeight - campo.getBoundingClientRect().bottom >= ALTURA_PARA_A_LISTA) return;
  const isSemMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  campo.scrollIntoView({ block: "start", behavior: isSemMovimento ? "auto" : "smooth" });
}

/** Com a busca vazia, o atalho do que o cliente já comprou; o que se digita procura na tabela de preço inteira do cliente. */
function tituloDaLista(termo: string, achados: number, { jaComprados, total }: { jaComprados: number; total: number }): string {
  const naTabela = `Digite o código, a medida ou o part number para buscar nos ${formatarNumero(total)} produtos da tabela do cliente.`;
  if (!termo) return jaComprados > 0 ? `Já comprados pelo cliente (${formatarNumero(jaComprados)}). ${naTabela}` : naTabela;
  if (achados === 0) return "Nenhum produto com essa busca no catálogo do cliente.";
  if (achados > MAXIMO_NA_LISTA) return `${formatarNumero(achados)} produtos: os ${MAXIMO_NA_LISTA} primeiros. Continue digitando para afunilar.`;
  return achados === 1 ? "1 produto. Enter inclui." : `${formatarNumero(achados)} produtos. Setas escolhem, Enter inclui.`;
}

/** O que ajuda a decidir: quanto do produto já está no pedido ou quando o cliente o comprou pela última vez. */
function situacaoDoProduto(produto: ProdutoDoCatalogo, pecasNoPedido: number): string {
  if (pecasNoPedido > 0) return `no pedido: ${formatarNumero(pecasNoPedido)} pç`;
  return produto.ultimaCompra ? `comprou em ${formatarDataCurta(produto.ultimaCompra.data)}` : "";
}
