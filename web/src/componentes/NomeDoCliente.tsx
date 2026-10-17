import { Building2 } from "lucide-react";
import type { ClienteResumo } from "../dados/tipos";
import { Selo } from "./Selo";
import estilos from "./NomeDoCliente.module.css";

/** O selo do grupo do SGI: o cliente junta vários CNPJs, com os números somados. */
export function SeloDoGrupo({ tamanho }: { tamanho?: "normal" | "grande" }) {
  return <Selo rotulo="Grupo" icone={Building2} tom="grupo" tamanho={tamanho} />;
}

/** O nome do cliente; no grupo, com o selo ao lado, para ele não passar por um cliente só. */
export function NomeDoCliente({ cliente }: { cliente: Pick<ClienteResumo, "nome" | "cnpjs"> }) {
  if (!cliente.cnpjs) return cliente.nome;
  return (
    <span className={estilos.comSelo}>
      {cliente.nome}
      <SeloDoGrupo />
    </span>
  );
}
