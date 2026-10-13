import type { LucideIcon } from "lucide-react";
import estilos from "./Selo.module.css";

/**
 * Os primeiros seguem a situação (bom, atenção, crítico, sem situação); "novo" é o cliente que acabou
 * de chegar; "rascunho" e "pendente" são o pedido ainda não enviado e o que está em aberto no ERP.
 */
export type TomDoSelo = "ok" | "alerta" | "critico" | "neutro" | "novo" | "rascunho" | "pendente";

type Props = {
  rotulo: string;
  icone: LucideIcon;
  tom: TomDoSelo;
  /** "grande" ao lado de um título, como o nome do cliente na ficha. */
  tamanho?: "normal" | "grande";
};

/** Estado com ícone e texto, nunca só pela cor. */
export function Selo({ rotulo, icone: Icone, tom, tamanho = "normal" }: Props) {
  const grande = tamanho === "grande";
  return (
    <span className={`${estilos.selo} ${estilos[tom]} ${grande ? estilos.grande : ""}`}>
      <Icone size={grande ? 17 : 14} strokeWidth={2.25} aria-hidden="true" />
      {rotulo}
    </span>
  );
}
