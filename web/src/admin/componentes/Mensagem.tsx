import { CircleCheck, TriangleAlert } from "lucide-react";
import estilos from "../admin.module.css";

export type Recado = { tom: "sucesso" | "erro"; texto: string };

/** O resultado da última ação: o que foi feito, ou por que o servidor recusou. */
export function Mensagem({ recado }: { recado: Recado }) {
  const Icone = recado.tom === "sucesso" ? CircleCheck : TriangleAlert;
  return (
    <p className={`${estilos.mensagem} ${estilos[recado.tom]}`} role={recado.tom === "erro" ? "alert" : "status"}>
      <Icone size={16} aria-hidden="true" />
      {recado.texto}
    </p>
  );
}
