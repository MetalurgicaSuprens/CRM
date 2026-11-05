import type { DatabaseSync } from "node:sqlite";
import { auditar } from "./auditoria.ts";
import { emTransacao } from "./bancoDoApp.ts";

/*
 * O registro de acessos não fica para sempre (docs/plano.md, "Auditoria"): o que passou de 12 meses
 * sai do app.db. O Marco Civil pede pelo menos 6 meses; a minimização de dados pede não guardar além
 * do que serve. As sessões e os convites mostram quem entrou e quando, e seguem o mesmo prazo.
 */

export const MESES_GUARDADOS = 12;

export type RegistrosApagados = { registro: number; sessoes: number; convites: number };

/** Apaga o que passou do prazo e registra a limpeza no próprio registro, quando apagou alguma coisa. */
export function apagarRegistrosAntigos(banco: DatabaseSync, agora: Date): RegistrosApagados {
  const limite = new Date(agora);
  limite.setUTCMonth(limite.getUTCMonth() - MESES_GUARDADOS);
  const antesDe = limite.toISOString();
  return emTransacao(banco, () => {
    const apagados = {
      registro: apagar(banco, "DELETE FROM auditoria WHERE momento < ?", antesDe),
      // A sessão dura no máximo 12 horas: a que não é usada há 12 meses terminou faz tempo.
      sessoes: apagar(banco, "DELETE FROM sessoes WHERE ultimo_uso < ?", antesDe),
      // O convite vale 48 horas no máximo: o que venceu há 12 meses foi usado, trocado ou perdido.
      convites: apagar(banco, "DELETE FROM convites WHERE expira_em < ?", antesDe),
    };
    if (apagados.registro + apagados.sessoes + apagados.convites > 0) {
      auditar(banco, { usuario: null, evento: "registros_apagados", resultado: descrever(apagados) });
    }
    return apagados;
  });
}

function apagar(banco: DatabaseSync, sql: string, antesDe: string): number {
  return Number(banco.prepare(sql).run(antesDe).changes);
}

function descrever({ registro, sessoes, convites }: RegistrosApagados): string {
  return `${registro} do registro, ${sessoes} sessões e ${convites} convites, de mais de ${MESES_GUARDADOS} meses`;
}
