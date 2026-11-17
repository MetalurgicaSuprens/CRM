import { ETAPAS, ROTULOS_DAS_ETAPAS, type Etapa } from "./etapas";
import estilos from "./EtapasDoPedido.module.css";

type Props = { etapa: Etapa; aoIrPara: (etapa: Etapa) => void };

/** O caminho do pedido no celular, no alto da página: onde o representante está e por onde já passou. */
export function EtapasDoPedido({ etapa, aoIrPara }: Props) {
  const atual = ETAPAS.indexOf(etapa);
  return (
    <nav className={estilos.etapas} aria-label="Etapas do pedido">
      <ol>
        {ETAPAS.map((outra, indice) => (
          <li key={outra}>
            <button
              type="button"
              className={estilos.etapa}
              aria-current={outra === etapa ? "step" : undefined}
              data-feita={indice < atual ? "" : undefined}
              onClick={() => aoIrPara(outra)}
            >
              <span className={estilos.numero} aria-hidden="true">
                {indice + 1}
              </span>
              {ROTULOS_DAS_ETAPAS[outra]}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
