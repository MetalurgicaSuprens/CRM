import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { Valor } from "../../componentes/Valor";
import type { TotaisDoPedido } from "../../dados/dadosDoPedido";
import { formatarContagem, formatarNumero } from "../../formato";
import { ROTULOS_DAS_ETAPAS, etapaAnterior, etapaSeguinte, type Etapa } from "./etapas";
import estilos from "./RodapeDoPedido.module.css";

/*
 * O rodapé do documento, sempre à vista enquanto a página rola, como a faixa de totais do app antigo:
 * itens, peças, valor sem IPI, IPI e valor com IPI, e depois o salvar como rascunho, em cinza, e o
 * envio, em verde. No celular, ele leva de uma etapa à outra e só oferece os dois na revisão.
 */

type Props = {
  /** O cliente do pedido: com o alto da página fora da tela, ele continua à vista aqui. */
  cliente: string;
  totais: TotaisDoPedido;
  /** O que impede o envio; o primeiro aparece ao lado do botão. */
  problemas: readonly string[];
  etapa: Etapa;
  aoIrPara: (etapa: Etapa) => void;
  aoEnviar: () => void;
  /** Guarda o pedido nos rascunhos e sai dele, para enviar depois (pedido do Lucas em 2026-11-18). */
  aoSalvarRascunho: () => void;
};

export function RodapeDoPedido({ cliente, totais, problemas, etapa, aoIrPara, aoEnviar, aoSalvarRascunho }: Props) {
  const anterior = etapaAnterior(etapa);
  const seguinte = etapaSeguinte(etapa);
  const [primeiroProblema] = problemas;
  // Os dois juntos, sempre nesta ordem: o rascunho guarda até o pedido incompleto, mas não o vazio.
  const botoesDoFim = (
    <>
      <button type="button" className={`${botoes.secundario} ${estilos.salvarRascunho}`} disabled={totais.itens === 0} onClick={aoSalvarRascunho}>
        Salvar cotação
      </button>
      <button type="button" className={`${botoes.primario} ${botoes.positivo} ${estilos.enviar}`} disabled={problemas.length > 0} onClick={aoEnviar}>
        Enviar pedido
      </button>
    </>
  );
  return (
    <footer className={estilos.rodape} aria-label="Totais do pedido">
      <p className={estilos.cliente}>
        <span className={estilos.rotulo}>Pedido para</span>
        <span className={estilos.nomeDoCliente}>{cliente}</span>
      </p>
      <dl className={estilos.totais}>
        <Total rotulo="Itens">{formatarNumero(totais.itens)}</Total>
        <Total rotulo="Qtde">{formatarNumero(totais.pecas)} pç</Total>
        <Total rotulo={totais.ipi === null ? "Valor" : "Valor s/ IPI"} isDestaque={totais.ipi === null}>
          <Valor valor={totais.semIpi} comCentavos />
        </Total>
        {totais.ipi !== null && totais.comIpi !== null ? (
          <>
            <Total rotulo="IPI">
              <Valor valor={totais.ipi} comCentavos />
            </Total>
            <Total rotulo="Valor c/ IPI" isDestaque>
              <Valor valor={totais.comIpi} comCentavos />
            </Total>
          </>
        ) : null}
      </dl>
      {/* No celular, os totais numa linha curta: o resto está na revisão. */}
      <p className={estilos.totaisNoCelular}>
        <span>
          {formatarContagem(totais.itens, "item", "itens")} · <Valor valor={totais.semIpi} comCentavos />
        </span>
        {totais.comIpi !== null ? (
          <span className={estilos.comIpiNoCelular}>
            com IPI <Valor valor={totais.comIpi} comCentavos />
          </span>
        ) : null}
      </p>
      <div className={estilos.envio}>
        {primeiroProblema ? <p className={estilos.problema}>{primeiroProblema}</p> : null}
        {botoesDoFim}
      </div>
      <div className={estilos.passos}>
        {anterior ? (
          <button type="button" className={`${botoes.secundario} ${estilos.voltar}`} aria-label={`Voltar para ${ROTULOS_DAS_ETAPAS[anterior]}`} onClick={() => aoIrPara(anterior)}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        {seguinte ? (
          <button type="button" className={`${botoes.primario} ${estilos.avancar}`} onClick={() => aoIrPara(seguinte)}>
            {ROTULOS_DAS_ETAPAS[seguinte]}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ) : (
          botoesDoFim
        )}
      </div>
    </footer>
  );
}

function Total({ rotulo, isDestaque = false, children }: { rotulo: string; isDestaque?: boolean; children: ReactNode }) {
  return (
    <div className={isDestaque ? `${estilos.total} ${estilos.destaque}` : estilos.total}>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
