import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ajustarAEmbalagem } from "../dados/pedido";
import estilos from "./Quantidade.module.css";

type Props = {
  /** Em peças. */
  valor: number;
  /** Peças por embalagem: os botões andam uma embalagem, e o que for digitado fecha a embalagem. */
  embalagem: number;
  /** Nome do produto, para leitores de tela. */
  rotulo: string;
  aoMudar: (pecas: number) => void;
};

export function Quantidade({ valor, embalagem, rotulo, aoMudar }: Props) {
  const [digitado, setDigitado] = useState(valor ? String(valor) : "");
  useEffect(() => setDigitado(valor ? String(valor) : ""), [valor]);
  const confirmar = () => aoMudar(ajustarAEmbalagem(Number(digitado), embalagem));
  return (
    <span className={estilos.quantidade} role="group" aria-label={`Quantidade de ${rotulo}, em peças`}>
      <button type="button" className={estilos.botao} onClick={() => aoMudar(Math.max(0, valor - embalagem))} disabled={valor === 0} aria-label="Tirar uma embalagem">
        <Minus size={15} aria-hidden="true" />
      </button>
      <input
        className={estilos.campo}
        type="number"
        inputMode="numeric"
        min={0}
        step={embalagem}
        placeholder="0"
        value={digitado}
        aria-label="Peças"
        onChange={(evento) => setDigitado(evento.target.value)}
        onBlur={confirmar}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") confirmar();
        }}
      />
      <button type="button" className={estilos.botao} onClick={() => aoMudar(valor + embalagem)} aria-label="Pôr mais uma embalagem">
        <Plus size={15} aria-hidden="true" />
      </button>
    </span>
  );
}
