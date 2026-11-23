import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SlidersHorizontal, Trash } from "lucide-react";
import { dataDoMomento } from "dominio/datas";
import { primeiraEntregaPossivel, type OrdemDeCompraDoItem } from "dominio/pedido";
import { CabecalhoPagina } from "../../componentes/CabecalhoPagina";
import cartao from "../../componentes/Cartao.module.css";
import { Voltar } from "../../componentes/Voltar";
import { carregarPedidos, enviarPedido, excluirRascunho } from "../../dados/api";
import { escolhasNoCatalogo, itensDoUltimoPedido, pedidoJaEnviadoHoje, problemasDasEscolhas, totaisDoPedido } from "../../dados/dadosDoPedido";
import { comMarcaXped, comNumeracao, comOrdemDeCompra, comQuantidade, isNumeracaoAutomatica, linhasEscolhidas, moverItem, numerarItens, problemasDoPedido, rascunhoNoCatalogo, type ItemEscolhido } from "../../dados/pedido";
import type { CatalogoDoCliente, EscolhasDoPedido, Rascunho } from "../../dados/tipos";
import { useCarga } from "../../dados/useCarga";
import { formatarContagem, formatarMomento, formatarNumero } from "../../formato";
import { ClienteDoPedido } from "./ClienteDoPedido";
import { CondicoesDoPedido } from "./CondicoesDoPedido";
import { ConfirmarEnvio } from "./ConfirmarEnvio";
import estilos from "./DocumentoDoPedido.module.css";
import { EtapasDoPedido } from "./EtapasDoPedido";
import { etapaDoEndereco, type Etapa } from "./etapas";
import { ItensDoPedido } from "./ItensDoPedido";
import { mensagemDo } from "./mensagemDo";
import { ResumoDoPedido, RevisaoDoPedido, type PedidoParaRevisar } from "./RevisaoDoPedido";
import { RodapeDoPedido } from "./RodapeDoPedido";
import { conteudoDoPedido, useRascunhoAutomatico } from "./useRascunhoAutomatico";

/*
 * O pedido como um documento, de cima para baixo, como no app antigo dos representantes (redesenho
 * aprovado pelo Lucas em 2026-11-17): o cliente, que se confere; as condições, que se escolhem, sempre
 * abertas; os itens, o corpo do pedido; e os totais, presos no rodapé. No computador, tudo numa tela.
 * No celular, as mesmas partes viram etapas (etapas.ts): quem decide qual parte aparece é o CSS, pela
 * largura, e não a tela.
 */

type Props = { catalogo: CatalogoDoCliente; idDoRascunho: string; inicial: Rascunho | null; relogio: string };

/** Só os preços que o representante mudou, ou que vieram do rascunho; o resto usa o preço inicial do item. */
type Precos = Record<string, number>;

export function DocumentoDoPedido({ catalogo, idDoRascunho, inicial, relogio }: Props) {
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const etapa = etapaDoEndereco(parametros.get("etapa"));
  const hoje = dataDoMomento(relogio);
  const primeiraEntrega = primeiraEntregaPossivel(hoje);
  const dados = catalogo.dadosDoPedido;
  // O rascunho diante do catálogo de hoje: o produto que saiu dele fica de fora, e o preço abaixo da tabela sobe para ela.
  const [doRascunho] = useState(() => rascunhoNoCatalogo(inicial?.itens ?? [], catalogo.produtos));
  const [itens, setItens] = useState<ItemEscolhido[]>(() =>
    doRascunho.itens.map(({ codigo, quantidade, ordemDeCompra, itemDaOrdemDeCompra }) => ({ codigo, quantidade, ordemDeCompra, itemDaOrdemDeCompra })),
  );
  const [precos, setPrecos] = useState<Precos>(() => Object.fromEntries(doRascunho.itens.map((item) => [item.codigo, item.precoCento])));
  const [entrega, setEntrega] = useState<string | null>(inicial?.entrega ?? null);
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [escolhas, setEscolhas] = useState<EscolhasDoPedido | null>(() => (dados ? escolhasNoCatalogo(inicial?.escolhas ?? null, dados) : null));
  const [confirmando, setConfirmando] = useState(false);
  const [erroAoEnviar, setErroAoEnviar] = useState<string | null>(null);
  const { dados: pedidos } = useCarga("pedidos", carregarPedidos);

  const linhas = useMemo(() => linhasEscolhidas(itens, precos, catalogo.produtos), [itens, precos, catalogo.produtos]);
  const conteudo = useMemo(() => conteudoDoPedido(catalogo.cliente.codigo, linhas, entrega, observacao, escolhas), [catalogo, linhas, entrega, observacao, escolhas]);
  const { existe, salvoEm, erroAoSalvar, salvarAgora, pararDeSalvar } = useRascunhoAutomatico(idDoRascunho, inicial, conteudo);
  const totais = totaisDoPedido(linhas, dados?.ipi ?? null);
  const problemas = [...problemasDoPedido(linhas, observacao, entrega, hoje), ...(escolhas ? problemasDasEscolhas(escolhas) : [])];
  const enviadoHojeAs = pedidos ? pedidoJaEnviadoHoje(pedidos.enviados, catalogo.cliente.codigo, hoje) : null;
  const paraRevisar: PedidoParaRevisar = { cliente: catalogo.cliente.nome, totais, entrega: entrega ?? primeiraEntrega, isProgramada: entrega !== null, dados, escolhas };
  const ultimoPedido = dados?.ultimoPedido ?? null;

  const isXped = escolhas?.clienteXped ?? false;
  /** Incluir, tirar e mover passam por aqui: no pedido xPed, o item da ordem de compra acompanha a ordem. */
  const mudarItens = useCallback((mudar: (atuais: ItemEscolhido[]) => ItemEscolhido[]) => setItens((atuais) => comNumeracao(atuais, mudar(atuais), isXped)), [isXped]);
  const alterar = useCallback((codigo: string, pecas: number) => mudarItens((atuais) => comQuantidade(atuais, codigo, pecas)), [mudarItens]);
  const mover = useCallback((codigo: string, destino: number) => mudarItens((atuais) => moverItem(atuais, codigo, destino)), [mudarItens]);
  const renumerar = useCallback(() => setItens(numerarItens), []);
  const mudarEscolhas = (novas: EscolhasDoPedido) => {
    if (novas.clienteXped !== isXped) setItens((atuais) => comMarcaXped(atuais, novas.clienteXped));
    setEscolhas(novas);
  };
  const alterarPreco = useCallback((codigo: string, preco: number) => setPrecos((atuais) => ({ ...atuais, [codigo]: preco })), []);
  const alterarOrdemDeCompra = useCallback((codigo: string, ordem: OrdemDeCompraDoItem) => setItens((atuais) => comOrdemDeCompra(atuais, codigo, ordem)), []);
  const repetirUltimoPedido = () => {
    if (ultimoPedido) mudarItens(() => itensDoUltimoPedido(ultimoPedido, catalogo.produtos));
  };

  /** A etapa vai para o endereço como uma página nova: o voltar do navegador volta uma etapa. */
  const irPara = (proxima: Etapa) => {
    const proximos = new URLSearchParams(parametros);
    proximos.set("etapa", proxima);
    setParametros(proximos);
    window.scrollTo({ top: 0 });
  };

  const enviar = useCallback(async () => {
    try {
      const rascunho = await salvarAgora();
      const pedido = await enviarPedido(rascunho.id);
      pararDeSalvar();
      navegar(`/pedidos/${pedido.numero}?enviado=1`, { replace: true });
    } catch (erro) {
      setConfirmando(false);
      setErroAoEnviar(mensagemDo(erro));
    }
  }, [salvarAgora, pararDeSalvar, navegar]);

  /** Guarda o pedido como está e volta para os rascunhos, para o representante decidir depois se envia. */
  const salvarComoRascunho = () => {
    salvarAgora().then(
      () => navegar("/pedidos?aba=rascunhos"),
      (erro: unknown) => setErroAoEnviar(mensagemDo(erro)),
    );
  };

  const descartar = () => {
    if (!existe || !window.confirm("Descartar este rascunho?")) return;
    pararDeSalvar();
    excluirRascunho(idDoRascunho).then(
      () => navegar("/pedidos?aba=rascunhos", { replace: true }),
      (erro: unknown) => setErroAoEnviar(mensagemDo(erro)),
    );
  };

  return (
    <div className={estilos.documento} data-etapa={etapa}>
      <CabecalhoPagina antes={<Voltar para="/pedidos" rotulo="Pedidos" />} titulo="Incluir pedido" />
      <EtapasDoPedido etapa={etapa} aoIrPara={irPara} />
      <section className={`${cartao.cartao} ${estilos.cabecalho}`} aria-label="Cliente e condições do pedido">
        <div className={estilos.parte} data-parte="cliente">
          <ClienteDoPedido cliente={catalogo.cliente} tabela={catalogo.tabela} cadastro={dados?.cadastro ?? null} />
        </div>
        <div className={estilos.parte} data-parte="condicoes">
          <header className={cartao.identificacao}>
            <span className={cartao.icone} aria-hidden="true">
              <SlidersHorizontal size={18} strokeWidth={1.75} />
            </span>
            <h2 className={cartao.titulo}>Condições do pedido</h2>
          </header>
          <CondicoesDoPedido
            dados={dados}
            escolhas={escolhas}
            aoMudarEscolhas={mudarEscolhas}
            entrega={entrega}
            aoMudarEntrega={setEntrega}
            primeiraEntrega={primeiraEntrega}
            observacao={observacao}
            aoMudarObservacao={setObservacao}
          />
        </div>
      </section>
      <div className={estilos.parte} data-parte="itens">
        <ItensDoPedido
            produtos={catalogo.produtos}
            linhas={linhas}
            ipi={dados?.ipi ?? null}
            ultimoPedido={ultimoPedido}
            aoRepetirUltimoPedido={repetirUltimoPedido}
            alterar={alterar}
            alterarPreco={alterarPreco}
            alterarOrdemDeCompra={alterarOrdemDeCompra}
            mover={mover}
            ordemDeCompraDoPedido={escolhas?.pedidoDoCliente ?? ""}
            aoRenumerar={isXped && !isNumeracaoAutomatica(itens) ? renumerar : null}
          >
            <AvisoDoRascunho foraDoCatalogo={doRascunho.foraDoCatalogo} subiramAoMinimo={doRascunho.subiramAoMinimo} />
          </ItensDoPedido>
      </div>
      <div className={estilos.parte} data-parte="revisar">
        <RevisaoDoPedido pedido={paraRevisar} linhas={linhas} observacao={observacao} problemas={problemas} />
      </div>
      <div className={estilos.rascunho}>
        <p className={estilos.salvo} role="status">
          {erroAoEnviar ??
            erroAoSalvar ??
            (salvoEm ? `Rascunho salvo ${formatarMomento(salvoEm, relogio)}: fica em Pedidos, na aba Rascunhos.` : "O rascunho é salvo sozinho enquanto você monta o pedido.")}
        </p>
        {existe ? (
          <button type="button" className={estilos.descartar} onClick={descartar}>
            <Trash size={14} aria-hidden="true" />
            Descartar rascunho
          </button>
        ) : null}
      </div>
      <RodapeDoPedido
        cliente={catalogo.cliente.nome}
        totais={totais}
        problemas={problemas}
        etapa={etapa}
        aoIrPara={irPara}
        aoEnviar={() => setConfirmando(true)}
        aoSalvarRascunho={salvarComoRascunho}
      />
      <ConfirmarEnvio
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        aoConfirmar={enviar}
        resumo={<ResumoDoPedido {...paraRevisar} />}
        aviso={enviadoHojeAs ? `Você já enviou um pedido para este cliente hoje, às ${enviadoHojeAs.slice(11, 16)}. Enviar outro?` : null}
      />
    </div>
  );
}

/** O rascunho que voltou diferente do salvo, porque o catálogo do cliente mudou. */
function AvisoDoRascunho({ foraDoCatalogo, subiramAoMinimo }: { foraDoCatalogo: number; subiramAoMinimo: number }) {
  if (foraDoCatalogo === 0 && subiramAoMinimo === 0) return null;
  const avisos = [
    foraDoCatalogo === 1 ? "1 produto do rascunho saiu do catálogo do cliente e ficou fora do pedido." : null,
    foraDoCatalogo > 1 ? `${formatarNumero(foraDoCatalogo)} produtos do rascunho saíram do catálogo do cliente e ficaram fora do pedido.` : null,
    subiramAoMinimo > 0 ? `O preço de ${formatarContagem(subiramAoMinimo, "produto", "produtos")} subiu para a tabela do cliente, que aumentou.` : null,
  ];
  return (
    <p className={estilos.avisoDoRascunho} role="status">
      {avisos.filter(Boolean).join(" ")}
    </p>
  );
}
