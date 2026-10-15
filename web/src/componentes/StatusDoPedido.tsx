import { ClipboardList, FilePen, ReceiptText, Send, type LucideIcon } from "lucide-react";
import type { StatusDoPedido } from "../dados/tipos";
import { Selo, type TomDoSelo } from "./Selo";

/** Nome, ícone e tom de cada status: os mesmos nos cartões de Pedidos e na coluna Status da ficha. */
export const STATUS_DO_PEDIDO = {
  faturado: { rotulo: "Faturado", icone: ReceiptText, tom: "ok" },
  em_aberto: { rotulo: "Em aberto", icone: ClipboardList, tom: "pendente" },
  enviado: { rotulo: "Enviado pelo CRM", icone: Send, tom: "neutro" },
  rascunho: { rotulo: "Rascunho", icone: FilePen, tom: "rascunho" },
} as const satisfies Record<StatusDoPedido, { rotulo: string; icone: LucideIcon; tom: TomDoSelo }>;

export function SeloDoPedido({ status }: { status: StatusDoPedido }) {
  return <Selo {...STATUS_DO_PEDIDO[status]} />;
}
