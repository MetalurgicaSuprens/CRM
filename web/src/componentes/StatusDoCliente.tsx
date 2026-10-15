import { Ban, Replace, type LucideIcon } from "lucide-react";
import type { StatusForaDeAtivo } from "dominio/statusDoCadastro";
import { ROTULOS_DE_STATUS } from "../dados/rotulos";
import type { StatusDoCadastro } from "../dados/tipos";
import { Selo } from "./Selo";
import estilos from "./StatusDoCliente.module.css";

const ICONES: Record<StatusForaDeAtivo, LucideIcon> = { inativo: Ban, substituido: Replace };

type Props = {
  status: StatusDoCadastro;
  /** "grande" ao lado do nome, na ficha do cliente. */
  tamanho?: "normal" | "grande";
};

/** O cliente fora de ativo no cadastro ganha o selo vermelho: ele aparece, mas não recebe pedido. O ativo não tem selo. */
export function SeloDoStatus({ status, tamanho }: Props) {
  if (status === "ativo") return null;
  return <Selo rotulo={ROTULOS_DE_STATUS[status]} icone={ICONES[status]} tom="critico" tamanho={tamanho} />;
}

/** Na coluna Status, todo cliente: o ativo em texto discreto, para o selo dos outros se destacar. */
export function StatusDoCliente({ status }: Pick<Props, "status">) {
  if (status === "ativo") return <span className={estilos.ativo}>{ROTULOS_DE_STATUS.ativo}</span>;
  return <SeloDoStatus status={status} />;
}

/** No lugar do pedido, por que o cliente não recebe pedido e com quem falar. */
export function AvisoDePedidoBloqueado({ texto }: { texto: string }) {
  return (
    <p className={estilos.aviso} role="alert">
      <Ban size={16} aria-hidden="true" />
      {texto}
    </p>
  );
}
