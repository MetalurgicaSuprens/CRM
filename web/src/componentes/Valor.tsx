import { useFormatoDeReais, useValores } from "../contexto/valores";
import estilos from "./Valor.module.css";

type Props = {
  valor: number;
  compacto?: boolean;
  /** Põe "+" nos valores positivos, para ganhos. */
  comSinal?: boolean;
};

/** Dinheiro sempre em verde; perda (valor negativo) no vermelho de queda, para não parecer ganho. */
export function Valor({ valor, compacto = false, comSinal = false }: Props) {
  const { visiveis } = useValores();
  const formato = useFormatoDeReais();
  const sinal = comSinal && valor > 0 ? "+" : "";
  const texto = `${sinal}${compacto ? formato.reaisCompacto(valor) : formato.reais(valor)}`;
  if (visiveis) return <span className={valor < 0 ? estilos.perda : estilos.valor}>{texto}</span>;
  return (
    <span className={estilos.oculto}>
      <span aria-hidden="true">{texto}</span>
      <span className="visualmente-oculto">valor oculto</span>
    </span>
  );
}
