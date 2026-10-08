import { Link } from "react-router";
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
