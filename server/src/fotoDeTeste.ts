import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ESQUEMA, VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import type { StatusDoCadastro } from "dominio/tipos";

/*
 * Foto pequena para os testes do servidor: o representante A (1401) e o B (9999), cada um com um
 * cliente, análises, pedido e nota, com os itens, e um grupo do SGI com dois CNPJs. Os textos de B
 * são únicos, para o teste achá-los em qualquer resposta.
 */

export const CLIENTE_DE_A = "aaaaaaaaaaaaaaa1";
/** Cliente de A inativo no cadastro do SGI: aparece, mas não recebe pedido. */
export const CLIENTE_INATIVO_DE_A = "aaaaaaaaaaaaaaa2";
/** O grupo de A e os dois CNPJs dele: o de Curitiba fatura mais. */
export const GRUPO_DE_A = "aaaaaaaaaaaaaaa3";
export const FILIAL_CURITIBA_DE_A = "aaaaaaaaaaaaaaa4";
export const FILIAL_BAHIA_DE_A = "aaaaaaaaaaaaaaa5";
export const CLIENTE_DE_B = "bbbbbbbbbbbbbbb1";
export const GRUPO_DE_B = "bbbbbbbbbbbbbbb2";
export const FILIAL_DE_B = "bbbbbbbbbbbbbbb3";
/** O que nunca pode aparecer para o login de A. O pedido 999004 é de B, mas para um cliente de A. */
export const MARCAS_DE_B = [
  CLIENTE_DE_B,
  "CLIENTE SO DE B",
  "999001",
  "888001",
  "PRODUTO-SO-DE-B",
  "999002",
  "TABELA SO DE B",
  "999003",
  "999004",
  GRUPO_DE_B,
  "GRUPO SO DE B",
  FILIAL_DE_B,
  "FILIAL SO DE B",
];

function cliente(id: string, representante: string, nome: string, status: StatusDoCadastro = "ativo"): Foto["cliente"][number] {
  return {
    cliente: id,
    codigo_erp: representante === "1401" ? "123456780001" : "876543210001",
    representante,
    nome,
    razao_social: `${nome} LTDA`,
    cidade: "CAMPINAS",
    uf: "SP",
    municipio_ibge: "3509502",
    endereco: "R BARAO DE JAGUARA, 1200 SALA 3",
    bairro: "CENTRO",
    cep: "13015002",
    latitude: -22.9,
    longitude: -47.06,
    precisao_do_ponto: "numero",
    mercado: "PRACA",
    situacao: "parado",
    status,
    ultima_compra: "2026-05-01",
    cliente_desde: 2015,
    ciclo_dias: 30,
    faturamento_12m: 12_000,
    variacao_12m: -0.3,
    evolucao_12m: JSON.stringify(Array.from({ length: 13 }, () => 12_000)),
    grupo_mix: "medio",
    tabela_preco: representante === "1401" ? "PADRAO - FEV" : "TABELA SO DE B",
    lista_de_precos: representante === "1401" ? 1 : 2,
    queda_no_semestre: -0.5,
    grupo: null,
    cnpjs: null,
  };
}

/** A linha do grupo: sem cidade, endereço, código do ERP nem tabela, com os números dos CNPJs somados. */
function grupo(id: string, representante: string, nome: string, cnpjs: number): Foto["cliente"][number] {
  return {
    ...cliente(id, representante, nome),
    codigo_erp: null,
    razao_social: "",
    cidade: "",
    uf: "",
    municipio_ibge: null,
    endereco: null,
    bairro: null,
    cep: null,
    latitude: null,
    longitude: null,
    precisao_do_ponto: null,
    situacao: "ativo",
    faturamento_12m: 30_000,
    queda_no_semestre: null,
    tabela_preco: null,
    lista_de_precos: null,
    cnpjs,
  };
}

function doGrupo(id: string, representante: string, nome: string, idDoGrupo: string, faturamento12m: number): Foto["cliente"][number] {
  return { ...cliente(id, representante, nome), situacao: "ativo", faturamento_12m: faturamento12m, queda_no_semestre: null, grupo: idDoGrupo };
}

function porCliente(id: string) {
  return {
    cliente_mes: [{ cliente: id, mes: "2026-09", valor: 1_000 }],
    cliente_familia: [{ cliente: id, familia: "FLEXIL", valor: 12_000, participacao: 1, pecas: 4_000 }],
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
    ritmo_por_dia_util: i === 9 ? 1_000 : null,
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
    cliente: [
      cliente(CLIENTE_DE_A, "1401", "CLIENTE DE A"),
      cliente(CLIENTE_INATIVO_DE_A, "1401", "CLIENTE INATIVO DE A", "inativo"),
      grupo(GRUPO_DE_A, "1401", "GRUPO DE A", 2),
      doGrupo(FILIAL_CURITIBA_DE_A, "1401", "FILIAL CURITIBA DE A", GRUPO_DE_A, 20_000),
      doGrupo(FILIAL_BAHIA_DE_A, "1401", "FILIAL BAHIA DE A", GRUPO_DE_A, 10_000),
      cliente(CLIENTE_DE_B, "9999", "CLIENTE SO DE B"),
      grupo(GRUPO_DE_B, "9999", "GRUPO SO DE B", 2),
      doGrupo(FILIAL_DE_B, "9999", "FILIAL SO DE B", GRUPO_DE_B, 10_000),
    ],
    produto: [
      { produto: "F-100", familia: "FLEXIL", medida: "14–22 mm", embalagem: 100 },
      { produto: "P-200", familia: "PRESIL", medida: null, embalagem: null },
      { produto: "PRODUTO-SO-DE-B", familia: "FLEXIL", medida: null, embalagem: 50 },
    ],
    lista_de_precos: [
      { lista: 1, produto: "F-100", preco_cento: 95.5, part_number: "CF420118" },
      { lista: 1, produto: "P-200", preco_cento: 120, part_number: null },
      { lista: 2, produto: "PRODUTO-SO-DE-B", preco_cento: 80, part_number: null },
    ],
    produto_comprado: [
      { cliente: CLIENTE_DE_A, produto: "F-100" },
      { cliente: CLIENTE_DE_B, produto: "PRODUTO-SO-DE-B" },
    ],
    cliente_mes: [...a.cliente_mes, ...b.cliente_mes],
    cliente_familia: [...a.cliente_familia, ...b.cliente_familia],
    ficha_produto: [...a.ficha_produto, ...b.ficha_produto],
    cliente_mix: [...a.cliente_mix, ...b.cliente_mix],
    analise_parado: [...a.analise_parado, ...b.analise_parado],
    analise_ritmo: [...a.analise_ritmo, ...b.analise_ritmo],
    // O grupo de A é reativado: a lista traz o grupo, com os CNPJs dele.
    analise_novo: [...a.analise_novo, ...b.analise_novo, { cliente: GRUPO_DE_A, tipo: "reativado", desde: "2026-04-01", faturado_desde: 9_000, ordem: 2 }],
    analise_mix: [...a.analise_mix, ...b.analise_mix],
    painel_mes: [...painel("1401"), ...painel("9999")],
    pedido_aberto: [
      { pedido: "100001", representante: "1401", cliente: CLIENTE_DE_A, emissao: "2026-10-01", entrega: "2026-10-20", itens: 2, valor: 5_000, valor_entrega_no_mes: 5_000 },
      { pedido: "999001", representante: "9999", cliente: CLIENTE_DE_B, emissao: "2026-10-01", entrega: "2026-10-21", itens: 1, valor: 7_000, valor_entrega_no_mes: 7_000 },
      // Pedido do A para um cliente que hoje é de B: conta para A, sem mostrar o cliente.
      { pedido: "777001", representante: "1401", cliente: CLIENTE_DE_B, emissao: "2026-10-02", entrega: "2026-11-05", itens: 1, valor: 3_000, valor_entrega_no_mes: 0 },
      { pedido: "100004", representante: "1401", cliente: FILIAL_BAHIA_DE_A, emissao: "2026-10-03", entrega: "2026-10-22", itens: 1, valor: 2_000, valor_entrega_no_mes: 2_000 },
    ],
    pedido_aberto_item: [
      { pedido: "100001", ordem: 1, produto: "F-100", pecas: 1_000, entrega: "2026-10-20", valor: 3_000 },
      { pedido: "100001", ordem: 2, produto: "P-200", pecas: 500, entrega: "2026-10-27", valor: 2_000 },
      { pedido: "999001", ordem: 1, produto: "PRODUTO-SO-DE-B", pecas: 700, entrega: "2026-10-21", valor: 7_000 },
      { pedido: "777001", ordem: 1, produto: "F-100", pecas: 300, entrega: "2026-11-05", valor: 3_000 },
      { pedido: "100004", ordem: 1, produto: "F-100", pecas: 200, entrega: "2026-10-22", valor: 2_000 },
    ],
    pedido_faturado_item: [
      { pedido: "100003", ordem: 1, produto: "F-100", pecas: 2_000, valor: 3_000 },
      { pedido: "100003", ordem: 2, produto: "P-200", pecas: 1_000, valor: 1_500 },
      { pedido: "999003", ordem: 1, produto: "PRODUTO-SO-DE-B", pecas: 100, valor: 900 },
      { pedido: "999004", ordem: 1, produto: "PRODUTO-SO-DE-B", pecas: 100, valor: 800 },
      { pedido: "100005", ordem: 1, produto: "P-200", pecas: 400, valor: 1_200 },
    ],
    pedido_faturado: [
      { pedido: "100003", representante: "1401", cliente: CLIENTE_DE_A, emissao: "2026-09-02", faturado_em: "2026-09-10", itens: 3, valor: 4_500 },
      { pedido: "999003", representante: "9999", cliente: CLIENTE_DE_B, emissao: "2026-09-03", faturado_em: "2026-09-11", itens: 1, valor: 900 },
      { pedido: "999004", representante: "9999", cliente: CLIENTE_DE_A, emissao: "2026-09-04", faturado_em: "2026-09-12", itens: 1, valor: 800 },
      { pedido: "100005", representante: "1401", cliente: FILIAL_CURITIBA_DE_A, emissao: "2026-08-20", faturado_em: "2026-08-28", itens: 1, valor: 1_200 },
    ],
    nota: [
      { nota: "100002", serie: "1", representante: "1401", cliente: CLIENTE_DE_A, emissao: "2026-10-05", valor: 1_000, pedidos: '["100001"]' },
      { nota: "888001", serie: "1", representante: "9999", cliente: CLIENTE_DE_B, emissao: "2026-10-06", valor: 2_000, pedidos: '["999002"]' },
    ],
    nota_item: [
      { nota: "100002", serie: "1", ordem: 1, produto: "F-100", pecas: 100, valor: 1_000 },
      { nota: "888001", serie: "1", ordem: 1, produto: "PRODUTO-SO-DE-B", pecas: 200, valor: 2_000 },
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
