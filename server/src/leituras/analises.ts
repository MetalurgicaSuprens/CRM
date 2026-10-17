import type { DatabaseSync } from "node:sqlite";
import { diasEntre } from "dominio/datas";
import type { Analises, DestaqueCliente, GrupoDestaque, PainelInicio } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { grupoDoMix, lerOportunidades } from "./clientes.ts";
import {
  COLUNAS_DO_RESUMO,
  comResumos,
  escopo,
  lerDadosDaFoto,
  lerLinhas,
  numero,
  numeroOuNulo,
  texto,
  textoOuNulo,
  type Linha,
} from "./linhas.ts";

/*
 * As listas das análises, já calculadas e ordenadas pelo extrator. O servidor só filtra pelos
 * códigos do login.
 */

const DESTAQUES_POR_GRUPO = 5;

export function lerAnalises(db: DatabaseSync, sessao: Sessao): Analises {
  const foto = lerDadosDaFoto(db);
  const hoje = texto(foto, "data_ref");
  /** Cada linha da lista com o resumo do cliente; o do grupo traz os CNPJs dele. */
  const daCarteira = (tabela: string, colunas: string, direcao?: "menos" | "mais") => {
    const { marcas, codigos } = escopo(sessao);
    const linhas = lerLinhas(
      db,
      `SELECT ${COLUNAS_DO_RESUMO}, c.ciclo_dias, c.grupo_mix, ${colunas}
         FROM ${tabela} a JOIN cliente c ON c.cliente = a.cliente
        WHERE c.representante IN (${marcas}) ${direcao ? "AND a.direcao = ?" : ""}
        ORDER BY a.ordem`,
      direcao ? [...codigos, direcao] : codigos,
    );
    return comResumos(db, sessao, linhas);
  };
  const ritmo = (direcao: "menos" | "mais") =>
    daCarteira("analise_ritmo", "a.semestre, a.semestre_ano_anterior, a.variacao, a.variacao_pecas", direcao).map(
      ({ linha, cliente }) => ({
        cliente,
        semestre: numero(linha, "semestre"),
        semestreAnoAnterior: numero(linha, "semestre_ano_anterior"),
        variacao: numero(linha, "variacao"),
        variacaoPecas: numeroOuNulo(linha, "variacao_pecas"),
      }),
    );
  return {
    semestre: { inicio: texto(foto, "semestre_inicio"), fim: texto(foto, "semestre_fim") },
    pararam: daCarteira("analise_parado", "a.perda_mensal").map(({ linha, cliente }) => ({
      cliente,
      diasSemComprar: diasSemComprar(linha, hoje),
      cicloDias: numeroOuNulo(linha, "ciclo_dias"),
      perdaMensal: numero(linha, "perda_mensal"),
    })),
    menos: ritmo("menos"),
    mais: ritmo("mais"),
    novos: daCarteira("analise_novo", "a.tipo, a.desde, a.faturado_desde").map(({ linha, cliente }) => ({
      cliente,
      tipo: texto(linha, "tipo") as "novo" | "reativado",
      desde: texto(linha, "desde"),
      faturadoDesde: numero(linha, "faturado_desde"),
    })),
    mix: daCarteira("analise_mix", "a.ordem").map(({ linha, cliente }) => ({
      cliente,
      porte: grupoDoMix(textoOuNulo(linha, "grupo_mix"))?.porte ?? null,
      oportunidades: lerOportunidades(db, texto(linha, "cliente")),
    })),
  };
}

/** Os cartões do Início: contagem e total de cada lista, e os primeiros dela. */
export function destaquesDasAnalises(analises: Analises): PainelInicio["destaques"] {
  const diferenca = (item: Analises["menos"][number]): DestaqueCliente => ({
    cliente: item.cliente,
    valor: item.semestre - item.semestreAnoAnterior,
    variacao: item.variacao,
  });
  return {
    pararam: agrupar(analises.pararam.map((item) => ({ cliente: item.cliente, valor: item.perdaMensal, variacao: null }))),
    menos: agrupar(analises.menos.map(diferenca)),
    mais: agrupar(analises.mais.map(diferenca)),
    novos: agrupar(analises.novos.map((item) => ({ cliente: item.cliente, valor: item.faturadoDesde, variacao: null }))),
  };
}

function agrupar(itens: DestaqueCliente[]): GrupoDestaque {
  return {
    quantidade: itens.length,
    valorTotal: itens.reduce((soma, item) => soma + item.valor, 0),
    itens: itens.slice(0, DESTAQUES_POR_GRUPO),
  };
}

function diasSemComprar(linha: Linha, hoje: string): number {
  const ultima = textoOuNulo(linha, "ultima_compra");
  return ultima ? diasEntre(ultima, hoje) : 0;
}
