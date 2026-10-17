import { Link, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import estilos from "./Voltar.module.css";

export function Voltar({ para, rotulo }: { para: string; rotulo: string }) {
  return (
    <Link to={para} className={estilos.voltar}>
      <ArrowLeft size={15} aria-hidden="true" />
      {rotulo}
    </Link>
  );
}

/** Volta pelo histórico: a tela de onde se veio reaparece como estava, com a aba, a ordem e a rolagem. */
export function VoltarAoAnterior({ rotulo }: { rotulo: string }) {
  const navegar = useNavigate();
  return (
    <button type="button" className={`${estilos.voltar} ${estilos.botao}`} onClick={() => navegar(-1)}>
      <ArrowLeft size={15} aria-hidden="true" />
      {rotulo}
    </button>
  );
}
