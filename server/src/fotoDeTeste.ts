import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ESQUEMA, VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";

/*
 * Foto pequena para os testes do servidor: o representante A (1401) e o B (9999), cada um com um
 * cliente, análises, pedido e nota. Os textos de B são únicos, para o teste achá-los em qualquer
 * resposta.
 */

export const CLIENTE_DE_A = "aaaaaaaaaaaaaaa1";
export const CLIENTE_DE_B = "bbbbbbbbbbbbbbb1";
/** O que nunca pode aparecer para o login de A. */
export const MARCAS_DE_B = [CLIENTE_DE_B, "CLIENTE SO DE B", "999001", "888001"];

function cliente(id: string, representante: string, nome: string): Foto["cliente"][number] {
  return {
    cliente: id,
    codigo_erp: representante === "1401" ? "123456780001" : "876543210001",
    representante,
    nome,
    razao_social: `${nome} LTDA`,
    cidade: "CAMPINAS",
    uf: "SP",
    mercado: "PRACA",
    situacao: "parado",
    ultima_compra: "2026-05-01",
    cliente_desde: 2015,
    ciclo_dias: 30,
    faturamento_12m: 12_000,
    variacao_12m: -0.3,
    evolucao_12m: JSON.stringify(Array.from({ length: 13 }, () => 12_000)),
    grupo_mix: "medio",
  };
}

function porCliente(id: string) {
  return {
    cliente_mes: [{ cliente: id, mes: "2026-09", valor: 1_000 }],
    cliente_familia: [{ cliente: id, familia: "FLEXIL", valor: 12_000, participacao: 1 }],
    ficha_produto: [{ cliente: id, produto: "F-100", pecas_12m: 500, valor_12m: 12_000, ultima_compra: "2026-05-01" }],
    cliente_mix: [{ cliente: id, familia: "PRESIL", penetracao: 0.6, ordem: 1 }],
    analise_parado: [{ cliente: id, perda_mensal: 1_000, ordem: id === CLIENTE_DE_A ? 1 : 2 }],
    analise_ritmo: [
      { cliente: id, direcao: "menos", semestre: 3_000, semestre_ano_anterior: 6_000, variacao: -0.5, variacao_pecas: null, ordem: 1 },
    ],
    analise_novo: [{ cliente: id, tipo: "reativado", desde: "2026-03-01", faturado_desde: 5_000, ordem: 1 }],
    analise_mix: [{ cliente: id, ordem: 1 }],
  };
}

function painel(representante: string): Foto["painel_mes"] {
  return Array.from({ length: 12 }, (_, i) => ({
    representante,
    mes: `2026-${String(i + 1).padStart(2, "0")}`,
    faturado: i < 10 ? 1_000 : null,
    ano_anterior: 900,
    ano_anterior_ate_dia_util: i === 9 ? 400 : null,
  }));
}

export function montarFotoDeTeste(): Foto {
  const a = porCliente(CLIENTE_DE_A);
  const b = porCliente(CLIENTE_DE_B);
  return {
    foto: {
      versao_esquema: VERSAO_DO_ESQUEMA,
      gerada_em: "2026-10-13T09:55",
      data_ref: "2026-10-13",
      mes_atual: "2026-10",
      dia_util: 7,
      dias_uteis: 20,
      semestre_inicio: "2026-04",
      semestre_fim: "2026-09",
    },
    representante: [
      { codigo: "1401", nome: "STAR VENDAS" },
      { codigo: "9999", nome: "OUTRA REPRESENTACAO" },
    ],
    cliente: [cliente(CLIENTE_DE_A, "1401", "CLIENTE DE A"), cliente(CLIENTE_DE_B, "9999", "CLIENTE SO DE B")],
    produto: [{ produto: "F-100", familia: "FLEXIL" }],
    cliente_mes: [...a.cliente_mes, ...b.cliente_mes],
    cliente_familia: [...a.cliente_familia, ...b.cliente_familia],
    ficha_produto: [...a.ficha_produto, ...b.ficha_produto],
    cliente_mix: [...a.cliente_mix, ...b.cliente_mix],
    analise_parado: [...a.analise_parado, ...b.analise_parado],
    analise_ritmo: [...a.analise_ritmo, ...b.analise_ritmo],
    analise_novo: [...a.analise_novo, ...b.analise_novo],
    analise_mix: [...a.analise_mix, ...b.analise_mix],
    painel_mes: [...painel("1401"), ...painel("9999")],
    pedido_aberto: [
      { pedido: "100001", representante: "1401", cliente: CLIENTE_DE_A, emissao: "2026-10-01", entrega: "2026-10-20", itens: 2, valor: 5_000, valor_entrega_no_mes: 5_000 },
      { pedido: "999001", representante: "9999", cliente: CLIENTE_DE_B, emissao: "2026-10-01", entrega: "2026-10-21", itens: 1, valor: 7_000, valor_entrega_no_mes: 7_000 },
      // Pedido do A para um cliente que hoje é de B: conta para A, sem mostrar o cliente.
      { pedido: "777001", representante: "1401", cliente: CLIENTE_DE_B, emissao: "2026-10-02", entrega: "2026-11-05", itens: 1, valor: 3_000, valor_entrega_no_mes: 0 },
    ],
    nota: [
      { nota: "100002", serie: "1", representante: "1401", cliente: CLIENTE_DE_A, emissao: "2026-10-05", valor: 1_000 },
      { nota: "888001", serie: "1", representante: "9999", cliente: CLIENTE_DE_B, emissao: "2026-10-06", valor: 2_000 },
    ],
  };
}

/** Grava a foto numa pasta temporária nova e devolve a pasta. */
export function gravarFotoDeTeste(foto: Foto = montarFotoDeTeste()): string {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-fotos-"));
  const db = new DatabaseSync(path.join(pasta, "foto-20261013-0955-1.db"));
  db.exec(ESQUEMA);
  for (const [tabela, conteudo] of Object.entries(foto)) {
    for (const linha of Array.isArray(conteudo) ? conteudo : [conteudo]) {
      const colunas = Object.keys(linha);
      const valores = Object.values(linha) as SQLInputValue[];
      db.prepare(`INSERT INTO ${tabela} (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`).run(...valores);
    }
  }
  db.close();
  return pasta;
}
