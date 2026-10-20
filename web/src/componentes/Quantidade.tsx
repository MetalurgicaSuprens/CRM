import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { embalagemAnterior, proximaEmbalagem, quantidadeDigitada } from "../dados/pedido";
import estilos from "./Quantidade.module.css";

type Props = {
  /** Em peças. */
  valor: number;
  /** Peças por embalagem: os botões andam de embalagem fechada em embalagem fechada; o que for digitado fica como está. */
  embalagem: number;
  /** Nome do produto, para leitores de tela. */
  rotulo: string;
  aoMudar: (pecas: number) => void;
};

export function Quantidade({ valor, embalagem, rotulo, aoMudar }: Props) {
  const [digitado, setDigitado] = useState(valor ? String(valor) : "");
  useEffect(() => setDigitado(valor ? String(valor) : ""), [valor]);
  const confirmar = () => aoMudar(quantidadeDigitada(digitado));
  return (
    <span className={estilos.quantidade} role="group" aria-label={`Quantidade de ${rotulo}, em peças`}>
      <button type="button" className={estilos.botao} onClick={() => aoMudar(embalagemAnterior(valor, embalagem))} disabled={valor === 0} aria-label="Uma embalagem a menos">
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        className={estilos.campo}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="0"
        value={digitado}
        aria-label="Peças"
        onChange={(evento) => setDigitado(evento.target.value)}
        onBlur={confirmar}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") confirmar();
        }}
      />
      <button type="button" className={estilos.botao} onClick={() => aoMudar(proximaEmbalagem(valor, embalagem))} aria-label="Uma embalagem a mais">
        <Plus size={16} aria-hidden="true" />
      </button>
    </span>
  );
}
