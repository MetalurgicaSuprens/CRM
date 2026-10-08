import { Ban, CircleCheck, CircleX, Hourglass, Inbox, ReceiptText, Send, Warehouse, type LucideIcon } from "lucide-react";
import type { EtapaDoPedido as Etapa } from "../dados/tipos";
import { Selo, type TomDoSelo } from "./Selo";

export const ETAPAS: Record<Etapa, { rotulo: string; icone: LucideIcon; tom: TomDoSelo }> = {
  enviado: { rotulo: "Enviado", icone: Send, tom: "neutro" },
  recebido: { rotulo: "Recebido pelo SGI", icone: Inbox, tom: "neutro" },
  recusado: { rotulo: "Recusado", icone: CircleX, tom: "critico" },
  em_aprovacao: { rotulo: "Em aprovação", icone: Hourglass, tom: "alerta" },
  aprovado: { rotulo: "Aprovado", icone: CircleCheck, tom: "ok" },
  no_erp: { rotulo: "No ERP", icone: Warehouse, tom: "ok" },
  faturado_parcial: { rotulo: "Faturado em parte", icone: ReceiptText, tom: "ok" },
  faturado: { rotulo: "Faturado", icone: ReceiptText, tom: "ok" },
  cancelado: { rotulo: "Cancelado", icone: Ban, tom: "critico" },
};

export function EtapaDoPedido({ etapa, tamanho }: { etapa: Etapa; tamanho?: "normal" | "grande" }) {
  return <Selo {...ETAPAS[etapa]} tamanho={tamanho} />;
}
