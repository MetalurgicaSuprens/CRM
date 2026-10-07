import { useFormatoDeReais, useValores } from "../contexto/valores";
import estilos from "./Valor.module.css";

type Props = {
  valor: number;
  compacto?: boolean;
};

export function Valor({ valor, compacto = false }: Props) {
  const { visiveis } = useValores();
  const formato = useFormatoDeReais();
  const texto = compacto ? formato.reaisCompacto(valor) : formato.reais(valor);
  if (visiveis) return <span className={estilos.valor}>{texto}</span>;
  return (
    <span className={estilos.oculto}>
      <span aria-hidden="true">{texto}</span>
      <span className="visualmente-oculto">valor oculto</span>
    </span>
  );
}
