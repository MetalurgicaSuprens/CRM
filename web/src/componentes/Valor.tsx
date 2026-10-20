import { useFormatoDeReais, useValores } from "../contexto/valores";
import estilos from "./Valor.module.css";

type Props = {
  valor: number;
  compacto?: boolean;
  /** Com os centavos, como nos pedidos: o preço do cento, os itens e os totais. */
  comCentavos?: boolean;
  /** Põe "+" nos valores positivos, para ganhos. */
  comSinal?: boolean;
  /** Valor positivo que é ruim (o que deixou de entrar): no vermelho de queda, sem sinal. */
  comoPerda?: boolean;
};

/** Dinheiro sempre em verde; perda (valor negativo, ou marcado comoPerda) no vermelho de queda, para não parecer ganho. */
export function Valor({ valor, compacto = false, comCentavos = false, comSinal = false, comoPerda = false }: Props) {
  const { visiveis } = useValores();
  const formato = useFormatoDeReais();
  const sinal = comSinal && valor > 0 ? "+" : "";
  const formatar = compacto ? formato.reaisCompacto : comCentavos ? formato.reaisComCentavos : formato.reais;
  const texto = `${sinal}${formatar(valor)}`;
  if (visiveis) return <span className={comoPerda || valor < 0 ? estilos.perda : estilos.valor}>{texto}</span>;
  return (
    <span className={estilos.oculto}>
      <span aria-hidden="true">{texto}</span>
      <span className="visualmente-oculto">valor oculto</span>
    </span>
  );
}
