import { Ban, CalendarX, CircleCheck, Clock, KeyRound, Repeat, type LucideIcon } from "lucide-react";
import { momentoEmBrasilia } from "dominio/datas";
import type { TomDoSelo } from "../componentes/Selo";
import { formatarMomento } from "../formato";
import type { CodigoDoLogin, EstadoDoConvite, SessaoNaGestao, SituacaoDoLogin } from "./tipos";

/*
 * Os nomes que a administração mostra para o que a API manda em código: a situação do login, o
 * estado do convite, o fim da sessão e os eventos do registro.
 */

export type RotuloComSelo = { rotulo: string; tom: TomDoSelo; icone: LucideIcon };

export const SITUACAO_DO_LOGIN: Record<SituacaoDoLogin, RotuloComSelo> = {
  ativo: { rotulo: "Ativo", tom: "ok", icone: CircleCheck },
  aguardando: { rotulo: "Convite pendente", tom: "pendente", icone: Clock },
  sem_acesso: { rotulo: "Sem acesso", tom: "alerta", icone: KeyRound },
  desativado: { rotulo: "Desativado", tom: "neutro", icone: Ban },
};

export const ESTADO_DO_CONVITE: Record<EstadoDoConvite, RotuloComSelo> = {
  valendo: { rotulo: "Valendo", tom: "pendente", icone: Clock },
  usado: { rotulo: "Usado", tom: "ok", icone: CircleCheck },
  expirado: { rotulo: "Venceu", tom: "neutro", icone: CalendarX },
  trocado: { rotulo: "Trocado por outro", tom: "neutro", icone: Repeat },
};

const EVENTOS: Readonly<Record<string, string>> = {
  usuario_criado: "Login criado",
  convite_criado: "Convite gerado",
  chave_criada: "Chave criada",
  chave_recusada: "Chave recusada",
  entrada: "Entrou",
  entrada_recusada: "Entrada recusada",
  saida: "Saiu",
  chaves_revogadas: "Chaves bloqueadas",
  chave_revogada: "Chave bloqueada",
  sessoes_encerradas: "Sessões encerradas",
  codigos_trocados: "Códigos trocados",
  usuario_desativado: "Login desativado",
  ficha_consultada: "Ficha consultada",
  visita_registrada: "Visita registrada",
  visita_desfeita: "Visita desfeita",
  rascunho_criado: "Rascunho de pedido criado",
  rascunho_descartado: "Rascunho de pedido descartado",
  foto_recusada: "Carga do ERP recusada",
  registros_apagados: "Registros antigos apagados",
};

const FIM_DA_SESSAO: Readonly<Record<string, string>> = {
  saiu: "Saiu",
  inatividade: "60 minutos sem uso",
  limite: "Limite de 12 horas",
  revogada: "Chave bloqueada ou login desativado",
  encerrada: "Encerrada pela administração",
};

/** O evento pelo nome; o que a tela ainda não conhece aparece como veio. */
export function rotuloDoEvento(evento: string): string {
  return EVENTOS[evento] ?? evento;
}

/** "Aberta" ou por que terminou; a que venceu sem ninguém usar não tem motivo gravado. */
export function situacaoDaSessao({ aberta, motivo }: Pick<SessaoNaGestao, "aberta" | "motivo">): string {
  if (aberta) return "Aberta";
  return motivo ? (FIM_DA_SESSAO[motivo] ?? motivo) : "Venceu";
}

/** "1401 · STAR VENDAS, 1402 · STAR VENDAS II"; o código sem nome na foto aparece sozinho. */
export function descreverCodigos(codigos: readonly CodigoDoLogin[]): string {
  return codigos.map(({ codigo, nome }) => (nome ? `${codigo} · ${nome}` : codigo)).join(", ");
}

/** "2026-10-16T12:15:00.000Z" → "hoje, 09:15", "ontem, 09:15" ou "14/10 às 09:15", em Brasília. */
export function formatarQuando(momentoIso: string, agora = new Date()): string {
  return formatarMomento(momentoEmBrasilia(new Date(momentoIso)), momentoEmBrasilia(agora));
}
