import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { History, PackageSearch, X } from "lucide-react";
import { valorDaLinha } from "dominio/pedido";
import botoes from "../../componentes/Botao.module.css";
import cartao from "../../componentes/Cartao.module.css";
import { Quantidade } from "../../componentes/Quantidade";
import { Valor } from "../../componentes/Valor";
import { useValores } from "../../contexto/valores";
import { valorDoIpi } from "../../dados/dadosDoPedido";
import { precoDigitado, type LinhaEscolhida } from "../../dados/pedido";
import type { DadosDoPedido, ProdutoDoCatalogo } from "../../dados/tipos";
import { formatarComCentavos, formatarContagem, formatarDataCurta, formatarNumero } from "../../formato";
import { BuscaDeProduto } from "./BuscaDeProduto";
import { FotoDaFamilia } from "../../componentes/FotoDaFamilia";
import { DescricaoDoProduto } from "./DescricaoDoProduto";
import estilos from "./ItensDoPedido.module.css";

/*
 * Os itens são o corpo do documento: a busca inclui o produto, o cursor cai na quantidade dele e, com
 * Enter, volta para a busca, pronto para o próximo. Cada item mostra o valor sem IPI, o IPI e o valor
 * com IPI, como a grade do app antigo dos representantes; o aviso de preço aparece no próprio item.
 */

type Props = {
  produtos: readonly ProdutoDoCatalogo[];
  linhas: readonly LinhaEscolhida[];
  /** A alíquota de cada produto, em %; null sem os dados do pedido na foto. */
  ipi: Readonly<Record<string, number>> | null;
  ultimoPedido: DadosDoPedido["ultimoPedido"];
  aoRepetirUltimoPedido: () => void;
  alterar: (codigo: string, pecas: number) => void;
  alterarPreco: (codigo: string, preco: number) => void;
  /** Entre a busca e os itens: o aviso do rascunho que voltou diferente. */
  children?: ReactNode;
};

export function ItensDoPedido({ produtos, linhas, ipi, ultimoPedido, aoRepetirUltimoPedido, alterar, alterarPreco, children }: Props) {
  const busca = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [recemIncluido, setRecemIncluido] = useState<string | null>(null);
  const noPedido = useMemo(() => new Map(linhas.map((linha) => [linha.codigo, linha.quantidade])), [linhas]);

  // O produto que acabou de entrar recebe o cursor na quantidade, já selecionada para digitar por cima.
  useEffect(() => {
    if (!recemIncluido) return;
    const campo = lista.current?.querySelector<HTMLInputElement>(`[data-produto="${CSS.escape(recemIncluido)}"] input[type="number"]`);
    campo?.focus();
    campo?.select();
    setRecemIncluido(null);
  }, [recemIncluido, linhas]);

  const incluir = (produto: ProdutoDoCatalogo) => {
    if (!noPedido.has(produto.codigo)) alterar(produto.codigo, produto.embalagem);
    setRecemIncluido(produto.codigo);
  };

  /** Enter na quantidade confirma (no próprio campo) e devolve o cursor à busca, para o próximo produto. */
  const aoTeclarNaLista = (evento: KeyboardEvent<HTMLUListElement>) => {
    if (evento.key === "Enter" && evento.target instanceof HTMLInputElement && evento.target.type === "number") busca.current?.focus();
  };

  return (
    <section className={`${cartao.cartao} ${estilos.itens}`} aria-label="Itens do pedido">
      {/* A busca na linha do título: uma linha a menos até os itens, que é onde o pedido anda. */}
      <header className={estilos.cabecalho}>
        <div className={cartao.identificacao}>
          <span className={cartao.icone} aria-hidden="true">
            <PackageSearch size={18} strokeWidth={1.75} />
          </span>
          <h2 className={cartao.titulo}>Itens do pedido</h2>
        </div>
        <BuscaDeProduto produtos={produtos} noPedido={noPedido} aoEscolher={incluir} campo={busca} />
        {linhas.length === 0 && ultimoPedido ? (
          <button type="button" className={`${botoes.secundario} ${estilos.repetir}`} onClick={aoRepetirUltimoPedido}>
            <History size={16} aria-hidden="true" />
            Repetir o último pedido ({formatarDataCurta(ultimoPedido.data)}, {formatarContagem(ultimoPedido.itens.length, "produto", "produtos")})
          </button>
        ) : null}
      </header>
      {children}
      {linhas.length === 0 ? (
        <p className={estilos.vazio}>
          Nenhum item ainda. Clique na busca para ver o que o cliente já comprou, ou digite o código, a medida ou o part number: Enter inclui o produto e leva à
          quantidade. O preço começa no da última compra e não pode ficar abaixo da tabela do cliente.
        </p>
      ) : (
        <ul ref={lista} className={ipi ? estilos.lista : `${estilos.lista} ${estilos.semIpi}`} onKeyDown={aoTeclarNaLista}>
          <li className={estilos.titulos} aria-hidden="true">
            <span className={estilos.tituloDoProduto}>Produto</span>
            <span className={estilos.tituloDaQuantidade}>Qtde (peças)</span>
            <span className={estilos.tituloDoPreco}>Cento R$</span>
            <span className={estilos.tituloDoValor}>{ipi ? "Valor s/ IPI" : "Valor"}</span>
            {ipi ? (
              <>
                <span className={estilos.tituloDoIpi}>IPI</span>
                <span className={estilos.tituloDoComIpi}>Valor c/ IPI</span>
              </>
            ) : null}
          </li>
          {linhas.map((linha) => (
            <Item key={linha.codigo} linha={linha} ipi={ipi} alterar={alterar} alterarPreco={alterarPreco} />
          ))}
        </ul>
      )}
    </section>
  );
}

type PropsDoItem = Pick<Props, "ipi" | "alterar" | "alterarPreco"> & { linha: LinhaEscolhida };

function Item({ linha, ipi, alterar, alterarPreco }: PropsDoItem) {
  const semIpi = valorDaLinha(linha);
  return (
    <li className={estilos.item} data-produto={linha.codigo}>
      <FotoDaFamilia codigo={linha.codigo} familia={linha.familia} className={estilos.foto} />
      <span className={estilos.produto}>
        <span className={estilos.codigo}>{linha.codigo}</span>
        <DescricaoDoProduto produto={linha} className={estilos.descricao} />
      </span>
      <Quantidade valor={linha.quantidade} embalagem={linha.embalagem} rotulo={linha.codigo} aoMudar={(pecas) => alterar(linha.codigo, pecas)} />
      <PrecoDoItem linha={linha} aoMudar={(preco) => alterarPreco(linha.codigo, preco)} />
      <span className={estilos.valor}>
        <Valor valor={semIpi} comCentavos />
      </span>
      {ipi ? <IpiDoItem semIpi={semIpi} valor={valorDoIpi(linha, ipi)} aliquota={ipi[linha.codigo] ?? 0} /> : null}
      <button type="button" className={estilos.tirar} aria-label={`Tirar ${linha.codigo} do pedido`} title="Tirar do pedido" onClick={() => alterar(linha.codigo, 0)}>
        <X size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

/** O IPI e o valor com IPI: colunas no computador; no celular, uma linha embaixo do item, com o nome de cada um. */
function IpiDoItem({ semIpi, valor, aliquota }: { semIpi: number; valor: number; aliquota: number }) {
  const percentual = `${formatarNumero(aliquota)}%`;
  return (
    <>
      <span className={estilos.ipi} title={`IPI de ${percentual}`}>
        <span className={estilos.rotuloNoCelular}>IPI {percentual} </span>
        <Valor valor={valor} comCentavos />
      </span>
      <span className={estilos.comIpi}>
        <span className={estilos.rotuloNoCelular}>com IPI </span>
        <Valor valor={semIpi + valor} comCentavos />
      </span>
    </>
  );
}

/**
 * O preço do cento do item, que o representante pode mudar: vale ao sair do campo ou com Enter. Abaixo
 * da tabela do cliente, que é o mínimo, ele sobe para ela e avisa. Com os valores ocultos, o campo some.
 */
function PrecoDoItem({ linha, aoMudar }: { linha: LinhaEscolhida; aoMudar: (preco: number) => void }) {
  const { visiveis } = useValores();
  const [digitado, setDigitado] = useState(formatarComCentavos(linha.precoCento));
  const [subiuAoMinimo, setSubiuAoMinimo] = useState(false);
  useEffect(() => setDigitado(formatarComCentavos(linha.precoCento)), [linha.precoCento]);
  const confirmar = () => {
    const resultado = precoDigitado(digitado, linha.precoDaTabela);
    setSubiuAoMinimo(resultado?.subiuAoMinimo ?? false);
    setDigitado(formatarComCentavos(resultado?.preco ?? linha.precoCento));
    if (resultado) aoMudar(resultado.preco);
  };
  // Duas células do item: o campo, na linha da quantidade, e de onde o preço vem, embaixo do produto.
  return (
    <>
      <label className={estilos.preco} title="Preço do cento">
        <span className={estilos.prefixoDoPreco} aria-hidden="true">
          R$
        </span>
        {visiveis ? (
          <input
            type="text"
            inputMode="decimal"
            value={digitado}
            aria-label={`Preço do cento de ${linha.codigo}, em reais`}
            onChange={(evento) => setDigitado(evento.target.value)}
            onBlur={confirmar}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") confirmar();
            }}
          />
        ) : (
          <span className={estilos.precoOculto}>••••</span>
        )}
      </label>
      {subiuAoMinimo ? (
        <span className={estilos.avisoDoPreco} role="status" title="O menor preço é o da tabela do cliente, com o desconto dele">
          Subiu para o mínimo, a tabela do cliente
        </span>
      ) : (
        <ReferenciasDoPreco linha={linha} />
      )}
    </>
  );
}

/** O mínimo primeiro: se faltar espaço, o que se corta é a última compra. Igual ao mínimo, o preço aparece uma vez só. */
function ReferenciasDoPreco({ linha }: { linha: LinhaEscolhida }) {
  const { precoDaTabela, ultimaCompra } = linha;
  if (ultimaCompra && Math.abs(ultimaCompra.precoCento - precoDaTabela) < 0.005) {
    return (
      <span className={estilos.referencias}>
        Mínimo e última compra <Valor valor={precoDaTabela} comCentavos />, em {formatarDataCurta(ultimaCompra.data)}
      </span>
    );
  }
  return (
    <span className={estilos.referencias}>
      Mínimo <Valor valor={precoDaTabela} comCentavos />
      {ultimaCompra ? (
        <>
          {" "}
          · última compra <Valor valor={ultimaCompra.precoCento} comCentavos />, em {formatarDataCurta(ultimaCompra.data)}
        </>
      ) : null}
    </span>
  );
}
