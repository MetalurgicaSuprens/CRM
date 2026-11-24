import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical, History, ListOrdered, PackageSearch, X } from "lucide-react";
import { LIMITE_DA_ORDEM_DE_COMPRA, LIMITE_DO_PART_NUMBER, valorDaLinha, type OrdemDeCompraDoItem } from "dominio/pedido";
import botoes from "../../componentes/Botao.module.css";
import cartao from "../../componentes/Cartao.module.css";
import { Quantidade } from "../../componentes/Quantidade";
import { Valor } from "../../componentes/Valor";
import { useValores } from "../../contexto/valores";
import { valorDoIpi } from "../../dados/dadosDoPedido";
import { itemDaOrdemDigitado, ordemDeCompraDigitada, partNumberDigitado, precoDigitado, type LinhaEscolhida } from "../../dados/pedido";
import type { DadosDoPedido, ProdutoDoCatalogo } from "../../dados/tipos";
import { formatarComCentavos, formatarContagem, formatarDataCurta, formatarNumero } from "../../formato";
import { BuscaDeProduto } from "./BuscaDeProduto";
import { FotoDaFamilia } from "../../componentes/FotoDaFamilia";
import estilos from "./ItensDoPedido.module.css";

/*
 * Os itens são o corpo do documento: a busca inclui o produto, o cursor cai na quantidade dele e, com
 * Enter, volta para a busca, pronto para o próximo. Cada item mostra a ordem de compra do cliente e o
 * item dela, o valor sem IPI, o IPI e o valor com IPI, como a grade do app antigo dos representantes; o
 * aviso de preço aparece no próprio item. A ordem dos itens muda arrastando pela alça (no celular, pelas
 * setas): é a ordem do pedido no SGI e, no cliente xPed, a do item da ordem de compra.
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
  alterarOrdemDeCompra: (codigo: string, ordem: OrdemDeCompraDoItem) => void;
  alterarPartNumber: (codigo: string, partNumber: string | null) => void;
  /** Leva o item para a posição `destino` (0 é o primeiro). */
  mover: (codigo: string, destino: number) => void;
  /** Com o item da ordem de compra digitado à mão no pedido xPed: volta à numeração de 1 a N. */
  aoRenumerar: (() => void) | null;
  /** A ordem de compra do pedido (pedidoDoCliente): é a de cada item que não tem outra. */
  ordemDeCompraDoPedido: string;
  /** Entre a busca e os itens: o aviso da cotação que voltou diferente. */
  children?: ReactNode;
};

export function ItensDoPedido(props: Props) {
  const { produtos, linhas, ipi, ultimoPedido, aoRepetirUltimoPedido, alterar, aoRenumerar, children } = props;
  const busca = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [recemIncluido, setRecemIncluido] = useState<string | null>(null);
  const [arrastado, setArrastado] = useState<string | null>(null);
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
      {aoRenumerar ? (
        <p className={estilos.avisoDaNumeracao} role="status">
          O item da O.C. foi digitado à mão e não acompanha mais a ordem dos itens.
          <button type="button" className={botoes.secundario} onClick={aoRenumerar}>
            <ListOrdered size={16} aria-hidden="true" />
            Renumerar de 1 a {linhas.length}
          </button>
        </p>
      ) : null}
      {linhas.length === 0 ? (
        <p className={estilos.vazio}>
          Nenhum item ainda. Clique na busca para ver o que o cliente já comprou, ou digite o código, a medida ou o part number: Enter inclui o produto e leva à
          quantidade. O preço começa no da última compra e não pode ficar abaixo da tabela do cliente.
        </p>
      ) : (
        <ul ref={lista} className={ipi ? estilos.lista : `${estilos.lista} ${estilos.semIpi}`} onKeyDown={aoTeclarNaLista}>
          <li className={estilos.titulos} aria-hidden="true">
            <span className={estilos.tituloDoProduto}>Produto</span>
            <span className={estilos.tituloDaOrdem}>Ordem compra</span>
            <span className={estilos.tituloDoItemDaOrdem}>Item OC</span>
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
          {linhas.map((linha, posicao) => (
            <Item
              key={linha.codigo}
              {...props}
              linha={linha}
              posicao={posicao}
              total={linhas.length}
              arrasto={{ arrastado, aoComecar: setArrastado, aoTerminar: () => setArrastado(null) }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** O item que está sendo arrastado, de todos os itens: cada um vira alvo ao passar por cima dele. */
type Arrasto = { arrastado: string | null; aoComecar: (codigo: string) => void; aoTerminar: () => void };

type PropsDoItem = Pick<Props, "ipi" | "alterar" | "alterarPreco" | "alterarOrdemDeCompra" | "alterarPartNumber" | "ordemDeCompraDoPedido" | "mover"> & {
  linha: LinhaEscolhida;
  posicao: number;
  total: number;
  arrasto: Arrasto;
};

function Item({ linha, posicao, total, ipi, alterar, alterarPreco, alterarOrdemDeCompra, alterarPartNumber, ordemDeCompraDoPedido, mover, arrasto }: PropsDoItem) {
  const semIpi = valorDaLinha(linha);
  // O item só fica arrastável enquanto a alça está apertada: arrastar pelos campos seleciona o texto, como sempre.
  const [isArrastavel, setArrastavel] = useState(false);
  const [isAlvo, setAlvo] = useState(false);
  const recebe = arrasto.arrastado !== null && arrasto.arrastado !== linha.codigo;
  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault();
    setAlvo(false);
    if (arrasto.arrastado) mover(arrasto.arrastado, posicao);
  };
  const classes = [estilos.item, arrasto.arrastado === linha.codigo ? estilos.arrastado : "", isAlvo && recebe ? estilos.alvo : ""].filter(Boolean).join(" ");
  return (
    <li
      className={classes}
      data-produto={linha.codigo}
      draggable={isArrastavel}
      onDragStart={(evento) => {
        evento.dataTransfer.effectAllowed = "move";
        evento.dataTransfer.setData("text/plain", linha.codigo);
        arrasto.aoComecar(linha.codigo);
      }}
      onDragEnd={() => {
        setArrastavel(false);
        arrasto.aoTerminar();
      }}
      onDragOver={(evento) => {
        if (!recebe) return;
        evento.preventDefault();
        setAlvo(true);
      }}
      onDragLeave={() => setAlvo(false)}
      onDrop={aoSoltar}
    >
      <span className={estilos.mover}>
        <button
          type="button"
          className={estilos.alca}
          aria-label={`Mover ${linha.codigo}, item ${posicao + 1} de ${total}: arraste, ou use as setas para cima e para baixo`}
          title="Arraste para mudar a ordem"
          onPointerDown={() => setArrastavel(true)}
          onPointerUp={() => setArrastavel(false)}
          onKeyDown={(evento) => {
            const destino = evento.key === "ArrowUp" ? posicao - 1 : evento.key === "ArrowDown" ? posicao + 1 : null;
            if (destino === null || destino < 0 || destino >= total) return;
            evento.preventDefault();
            mover(linha.codigo, destino);
          }}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <button type="button" className={estilos.seta} aria-label={`Subir ${linha.codigo}`} disabled={posicao === 0} onClick={() => mover(linha.codigo, posicao - 1)}>
          <ChevronUp size={18} aria-hidden="true" />
        </button>
        <button type="button" className={estilos.seta} aria-label={`Descer ${linha.codigo}`} disabled={posicao === total - 1} onClick={() => mover(linha.codigo, posicao + 1)}>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </span>
      <FotoDaFamilia codigo={linha.codigo} familia={linha.familia} className={estilos.foto} />
      <span className={estilos.produto}>
        <span className={estilos.codigo}>{linha.codigo}</span>
        <span className={estilos.descricao}>{linha.familia}</span>
      </span>
      <PartNumberDoItem linha={linha} aoMudar={(partNumber) => alterarPartNumber(linha.codigo, partNumber)} />
      <OrdemDeCompraDoItem linha={linha} doPedido={ordemDeCompraDoPedido} aoMudar={(ordem) => alterarOrdemDeCompra(linha.codigo, ordem)} />
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

/**
 * A ordem de compra do cliente no item e o número do item nela, como o "Ordem Compra:" e o "Item O.C.:"
 * do app antigo dos representantes: os clientes que pedem o xPed na nota fiscal querem nela o pedido
 * deles e o item correspondente. A ordem vazia é a do pedido, que aparece em cinza no campo.
 */
function OrdemDeCompraDoItem({ linha, doPedido, aoMudar }: { linha: LinhaEscolhida; doPedido: string; aoMudar: (ordem: OrdemDeCompraDoItem) => void }) {
  const [ordem, setOrdem] = useState(linha.ordemDeCompra ?? "");
  const [item, setItem] = useState(linha.itemDaOrdemDeCompra?.toString() ?? "");
  // A numeração automática do xPed muda o item de fora: o campo acompanha.
  useEffect(() => setOrdem(linha.ordemDeCompra ?? ""), [linha.ordemDeCompra]);
  useEffect(() => setItem(linha.itemDaOrdemDeCompra?.toString() ?? ""), [linha.itemDaOrdemDeCompra]);
  const confirmarOrdem = () => {
    const nova = ordemDeCompraDigitada(ordem, doPedido);
    setOrdem(nova ?? "");
    aoMudar({ ordemDeCompra: nova, itemDaOrdemDeCompra: linha.itemDaOrdemDeCompra });
  };
  const confirmarItem = () => {
    const novo = itemDaOrdemDigitado(item);
    const valendo = novo === undefined ? linha.itemDaOrdemDeCompra : novo;
    setItem(valendo?.toString() ?? "");
    aoMudar({ ordemDeCompra: linha.ordemDeCompra, itemDaOrdemDeCompra: valendo });
  };
  const aoTeclar = (confirmar: () => void) => (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Enter") confirmar();
  };
  return (
    <>
      <label className={estilos.ordem}>
        <span className={estilos.rotuloNoCelular}>Ordem compra</span>
        <input
          className={estilos.campoDaOrdem}
          type="text"
          value={ordem}
          maxLength={LIMITE_DA_ORDEM_DE_COMPRA}
          placeholder={doPedido.trim() || "a do pedido"}
          aria-label={`Ordem de compra de ${linha.codigo}; vazia, é a do pedido`}
          title="Ordem de compra do cliente neste item; vazia, é a do pedido"
          onChange={(evento) => setOrdem(evento.target.value)}
          onBlur={confirmarOrdem}
          onKeyDown={aoTeclar(confirmarOrdem)}
        />
      </label>
      <label className={estilos.itemDaOrdem}>
        <span className={estilos.rotuloNoCelular}>Item OC</span>
        <input
          className={estilos.campoDoItemDaOrdem}
          type="text"
          inputMode="numeric"
          value={item}
          maxLength={6}
          placeholder="—"
          aria-label={`Item da ordem de compra de ${linha.codigo}`}
          title="Item da ordem de compra do cliente, como está no pedido dele"
          onChange={(evento) => setItem(evento.target.value)}
          onBlur={confirmarItem}
          onKeyDown={aoTeclar(confirmarItem)}
        />
      </label>
    </>
  );
}

/**
 * O part number do cliente no item, embaixo do produto, como o "Part Number:" do app antigo: vem com o
 * sugerido para o cliente, e o representante troca ou apaga. As opções da tabela própria do cliente e a
 * última que ele usou aparecem na lista do campo; com mais de uma e nenhuma sugerida, ele escolhe.
 */
function PartNumberDoItem({ linha, aoMudar }: { linha: LinhaEscolhida; aoMudar: (partNumber: string | null) => void }) {
  const [texto, setTexto] = useState(linha.partNumber ?? "");
  useEffect(() => setTexto(linha.partNumber ?? ""), [linha.partNumber]);
  const { opcoes } = linha.partNumberDoCliente;
  const idDasOpcoes = `part-numbers-${linha.codigo}`;
  const confirmar = () => {
    const novo = partNumberDigitado(texto);
    setTexto(novo ?? "");
    if (novo !== linha.partNumber) aoMudar(novo);
  };
  return (
    <label className={estilos.partNumber}>
      <span className={estilos.rotuloDoPartNumber}>PN</span>
      <input
        className={estilos.campoDoPartNumber}
        type="text"
        value={texto}
        maxLength={LIMITE_DO_PART_NUMBER}
        list={opcoes.length > 0 ? idDasOpcoes : undefined}
        placeholder={opcoes.length > 1 && !linha.partNumber ? "escolha o part number" : "sem part number"}
        aria-label={`Part number do cliente para ${linha.codigo}`}
        title="Part number do cliente neste item; vazio, o item vai sem"
        onChange={(evento) => setTexto(evento.target.value)}
        onBlur={confirmar}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") confirmar();
        }}
      />
      {opcoes.length > 0 ? (
        <datalist id={idDasOpcoes}>
          {opcoes.map((opcao) => (
            <option key={opcao} value={opcao} />
          ))}
        </datalist>
      ) : null}
    </label>
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
 * da tabela do cliente, que é o mínimo, ele sobe para ela e avisa embaixo do produto. Com os valores
 * ocultos, o campo some. O mínimo e a última compra não aparecem no item (pedido do Lucas em 2026-11-23).
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
  // Duas células do item: o campo, na linha da quantidade, e o aviso, embaixo do produto.
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
      ) : null}
    </>
  );
}
