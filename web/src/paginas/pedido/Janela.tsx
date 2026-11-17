import { useEffect, useRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { formatarParte, type Frequencia } from "../../dados/dadosDoPedido";
import estilos from "./Janela.module.css";

/*
 * A lista que abre por cima da tela para escolher a transportadora ou a condição de pagamento: as
 * opções em seções, a mais usada com o cliente no alto, cada uma com a fatia dos pedidos.
 */

type PropsDaJanela = { titulo: string; icone: ReactNode; aberta: boolean; aoFechar: () => void; children: ReactNode };

export function Janela({ titulo, icone, aberta, aoFechar, children }: PropsDaJanela) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberta && !elemento.open) elemento.showModal();
    if (!aberta && elemento.open) elemento.close();
  }, [aberta]);
  return (
    <dialog ref={dialogo} className={estilos.janela} onClose={aoFechar} aria-label={titulo}>
      <div className={estilos.cabecalho}>
        <h2 className={estilos.titulo}>
          {icone}
          {titulo}
        </h2>
        <button type="button" className={botoes.secundario} onClick={aoFechar}>
          Fechar
        </button>
      </div>
      {/* Só com a janela aberta: cada abertura começa com a busca vazia e na lista, e não no cadastro. */}
      <div className={estilos.conteudo}>{aberta ? children : null}</div>
    </dialog>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className={estilos.secao}>
      <h3 className={estilos.tituloDaSecao}>{titulo}</h3>
      {children}
    </section>
  );
}

type PropsDaOpcao = { titulo: string; detalhe: string | null; frequencia?: Frequencia; escolhida: boolean; aoEscolher: () => void };

/** Uma opção da lista; com a frequência, a barra mostra a fatia dos pedidos do cliente: "98% · 49 pedidos". */
export function Opcao({ titulo, detalhe, frequencia, escolhida, aoEscolher }: PropsDaOpcao) {
  return (
    <button type="button" className={estilos.opcao} aria-pressed={escolhida} onClick={aoEscolher}>
      <span className={estilos.textoDaOpcao}>
        <span className={estilos.tituloDaOpcao}>{titulo}</span>
        {detalhe ? <span className={estilos.detalheDaOpcao}>{detalhe}</span> : null}
      </span>
      {frequencia ? (
        <span className={estilos.frequencia}>
          <span className={estilos.parte}>{formatarParte(frequencia.parte)}</span>
          <span className={estilos.pedidos}>{frequencia.pedidos === 1 ? "1 pedido" : `${frequencia.pedidos} pedidos`}</span>
          <span className={estilos.barra} aria-hidden="true">
            <span className={estilos.preenchimento} style={{ inlineSize: `${Math.max(frequencia.parte * 100, 2)}%` }} />
          </span>
        </span>
      ) : null}
      {escolhida ? <Check size={18} className={estilos.marca} aria-label="escolhida" /> : null}
    </button>
  );
}
