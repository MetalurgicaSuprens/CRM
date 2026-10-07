import { Construction } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import estilos from "./EmPreparacao.module.css";

export function EmPreparacao({ titulo, etapa }: { titulo: string; etapa: string }) {
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo={titulo} />
      <div className={estilos.aviso}>
        <Construction size={22} aria-hidden="true" />
        <p>Esta tela entra {etapa}.</p>
      </div>
    </div>
  );
}
