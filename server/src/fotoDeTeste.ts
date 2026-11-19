import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ESQUEMA, VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import { contarLinhasPorTabela, nomeDoManifesto, type ManifestoDaFoto } from "dominio/manifestoDaFoto";
import type { StatusDoCadastro } from "dominio/tipos";
import type { PastasDaFoto } from "./foto/conferirFoto.ts";

/*
 * Foto pequena para os testes do servidor: o representante A (1401) e o B (9999), cada um com um
 * cliente, análises, pedido e nota, com os itens, e um grupo do SGI com dois CNPJs. Os textos de B
 * são únicos, para o teste achá-los em qualquer resposta.
 */

export const CLIENTE_DE_A = "aaaaaaaaaaaaaaa1";
/** Cliente de A inativo no cadastro do SGI: aparece, mas não recebe pedido. */
export const CLIENTE_INATIVO_DE_A = "aaaaaaaaaaaaaaa2";
/** Cliente de A ativo, mas sem a tabela de preço principal: aparece, mas não recebe pedido. */
export const CLIENTE_SEM_TABELA_DE_A = "aaaaaaaaaaaaaaa6";
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
  "87.654.321/0001-99",
  "999005",
  "ENTREGA SO DE B",
  "TRANSPORTADORA SO DE B",
  "NOTA-SO-DE-B",
];

function cliente(id: string, representante: string, nome: string, status: StatusDoCadastro = "ativo"): Foto["cliente"][number] {
  return {
    cliente: id,
    codigo_erp: representante === "1401" ? "123456780001" : "876543210001",
    cpf: null,
    cnpj: representante === "1401" ? "12.345.678/0001-95" : "87.654.321/0001-99",
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

/** Os 60 meses fechados antes de outubro de 2026, com o mesmo faturado em todos. */
function historicoDoPainel(representante: string, faturado: number): Foto["painel_historico"] {
  return Array.from({ length: 60 }, (_, i) => {
    const mes = new Date(Date.UTC(2021, 9 + i, 1)).toISOString().slice(0, 7);
    return { representante, mes, faturado };
  });
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
      { ...cliente(CLIENTE_SEM_TABELA_DE_A, "1401", "CLIENTE SEM TABELA DE A"), tabela_preco: null, lista_de_precos: null },
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
      { lista: 1, produto: "F-100", preco_cento: 95.5 },
      { lista: 1, produto: "P-200", preco_cento: 120 },
      { lista: 2, produto: "PRODUTO-SO-DE-B", preco_cento: 80 },
    ],
    produto_part_number: [
      { produto: "F-100", part_number: "CF420118" },
      { produto: "F-100", part_number: "N906227" },
      { produto: "PRODUTO-SO-DE-B", part_number: "SO-DE-B" },
    ],
    produto_comprado: [
      { cliente: CLIENTE_DE_A, produto: "F-100", ultima_compra: "2026-09-15", preco_cento_na_ultima: 98.4 },
      { cliente: CLIENTE_DE_B, produto: "PRODUTO-SO-DE-B", ultima_compra: "2026-08-01", preco_cento_na_ultima: 82 },
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
    painel_historico: [...historicoDoPainel("1401", 1_000), ...historicoDoPainel("9999", 7_777)],
    pedido_aberto: [
      { pedido: "100001", representante: "1401", cliente: CLIENTE_DE_A, emissao: "2026-10-01", entrega: "2026-10-20", itens: 2, valor: 5_000, valor_ipi: 250, valor_entrega_no_mes: 5_000, cfop: "6101", cfop_descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
      { pedido: "999001", representante: "9999", cliente: CLIENTE_DE_B, emissao: "2026-10-01", entrega: "2026-10-21", itens: 1, valor: 7_000, valor_ipi: 0, valor_entrega_no_mes: 7_000, cfop: "6101", cfop_descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
      // Pedido do A para um cliente que hoje é de B: conta para A, sem mostrar o cliente.
      { pedido: "777001", representante: "1401", cliente: CLIENTE_DE_B, emissao: "2026-10-02", entrega: "2026-11-05", itens: 1, valor: 3_000, valor_ipi: 0, valor_entrega_no_mes: 0, cfop: "6101", cfop_descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
      { pedido: "100004", representante: "1401", cliente: FILIAL_BAHIA_DE_A, emissao: "2026-10-03", entrega: "2026-10-22", itens: 1, valor: 2_000, valor_ipi: 0, valor_entrega_no_mes: 2_000, cfop: "6101", cfop_descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
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
      {
        pedido: "100003",
        representante: "1401",
        cliente: CLIENTE_DE_A,
        emissao: "2026-09-02",
        faturado_em: "2026-09-10",
        itens: 3,
        valor: 4_500,
        valor_ipi: 225,
        cfop: "6101",
        cfop_descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO",
        notas: JSON.stringify([{ numero: "100013", emissao: "2026-09-10", valor_total: 4_725, transportadora: "RODONAVES" }]),
      },
      {
        pedido: "999003",
        representante: "9999",
        cliente: CLIENTE_DE_B,
        emissao: "2026-09-03",
        faturado_em: "2026-09-11",
        itens: 1,
        valor: 900,
        valor_ipi: 0,
        cfop: "6101",
        cfop_descricao: null,
        notas: JSON.stringify([{ numero: "NOTA-SO-DE-B", emissao: "2026-09-11", valor_total: 900, transportadora: "TRANSPORTADORA SO DE B" }]),
      },
      { pedido: "999004", representante: "9999", cliente: CLIENTE_DE_A, emissao: "2026-09-04", faturado_em: "2026-09-12", itens: 1, valor: 800, valor_ipi: 0, cfop: "6101", cfop_descricao: null, notas: "[]" },
      { pedido: "100005", representante: "1401", cliente: FILIAL_CURITIBA_DE_A, emissao: "2026-08-20", faturado_em: "2026-08-28", itens: 1, valor: 1_200, valor_ipi: 0, cfop: "6101", cfop_descricao: null, notas: "[]" },
    ],
    nota: [
      {
        nota: "100002",
        serie: "1",
        representante: "1401",
        cliente: CLIENTE_DE_A,
        emissao: "2026-10-05",
        valor: 1_000,
        valor_ipi: 50,
        valor_total: 1_050,
        transportadora: "RODONAVES",
        cfop: "5101",
        cfop_descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO",
        pedidos: '["100001"]',
      },
      {
        nota: "888001",
        serie: "1",
        representante: "9999",
        cliente: CLIENTE_DE_B,
        emissao: "2026-10-06",
        valor: 2_000,
        valor_ipi: 0,
        valor_total: 2_000,
        transportadora: "TRANSPORTADORA SO DE B",
        cfop: "6101",
        cfop_descricao: null,
        pedidos: '["999002"]',
      },
    ],
    nota_item: [
      { nota: "100002", serie: "1", ordem: 1, produto: "F-100", pecas: 100, valor: 1_000 },
      { nota: "888001", serie: "1", ordem: 1, produto: "PRODUTO-SO-DE-B", pecas: 200, valor: 2_000 },
    ],
    ...dadosDoPedidoDeTeste(),
  };
}

/**
 * A tela de pedido: o cadastro e o histórico de escolhas do cliente de A e do de B. A transportadora 999005
 * só aparece no uso de B, para o teste do escopo achar se ela vazar para A.
 */
function dadosDoPedidoDeTeste(): Pick<
  Foto,
  "cliente_cadastro" | "cliente_local" | "cliente_escolha" | "ultimo_pedido_item" | "transportadora" | "representante_transportadora" | "condicao_pagamento" | "produto_ipi"
> {
  const cadastro = (cliente: string, documento: string) => ({
    cliente,
    documento,
    inscricao_estadual: "123259029",
    suframa: null,
    telefone: "(19) 3232-1000",
    email_xml: "nfe@cliente.exemplo.com.br",
    endereco: "R BARAO DE JAGUARA, 1200 SALA 3",
    bairro: "CENTRO",
    cep: "13015002",
    condicao_pagamento: "1002",
    base_ipi: 1,
    ultimo_pedido_em: "2026-09-02",
  });
  return {
    cliente_cadastro: [cadastro(CLIENTE_DE_A, "12.345.678/0001-95"), cadastro(CLIENTE_DE_B, "87.654.321/0001-99")],
    cliente_local: [
      { cliente: CLIENTE_DE_A, tipo: "entrega", razao_social: "CLIENTE DE A LTDA", documento: "12.345.678/0002-76", endereco: "R DA ENTREGA, 10", bairro: null, cidade: "VALINHOS", uf: "SP", cep: null },
      { cliente: CLIENTE_DE_B, tipo: "entrega", razao_social: "ENTREGA SO DE B", documento: "87.654.321/0002-70", endereco: "R B, 1", bairro: null, cidade: "OSASCO", uf: "SP", cep: null },
    ],
    cliente_escolha: [
      { cliente: CLIENTE_DE_A, tipo: "transportadora", valor: "101", pedidos: 9 },
      { cliente: CLIENTE_DE_A, tipo: "transportadora", valor: "102", pedidos: 1 },
      { cliente: CLIENTE_DE_A, tipo: "condicao", valor: "1002", pedidos: 10 },
      { cliente: CLIENTE_DE_A, tipo: "classificacao", valor: "industrializacao", pedidos: 10 },
      { cliente: CLIENTE_DE_A, tipo: "parcial", valor: "sim", pedidos: 7 },
      { cliente: CLIENTE_DE_A, tipo: "parcial", valor: "nao", pedidos: 3 },
      { cliente: CLIENTE_DE_B, tipo: "transportadora", valor: "102", pedidos: 4 },
    ],
    ultimo_pedido_item: [
      { cliente: CLIENTE_DE_A, ordem: 1, produto: "P-200", pecas: 300 },
      { cliente: CLIENTE_DE_A, ordem: 2, produto: "F-100", pecas: 500 },
    ],
    transportadora: [
      { codigo: "101", nome: "TRANSPORTES IPE", cnpj: "11.222.333/0001-81", cidade: "CURITIBA", uf: "PR" },
      { codigo: "102", nome: "ROTA AZUL", cnpj: "45.997.418/0001-53", cidade: "JOINVILLE", uf: "SC" },
    ],
    representante_transportadora: [
      { representante: "1401", transportadora: "101", pedidos: 40 },
      { representante: "9999", transportadora: "999005", pedidos: 30 },
    ],
    condicao_pagamento: [
      { codigo: "1002", descricao: "30 DDL" },
      { codigo: "1010", descricao: "30/60 DDL" },
    ],
    produto_ipi: [
      { produto: "F-100", aliquota: 5 },
      { produto: "P-200", aliquota: 9.75 },
      { produto: "PRODUTO-SO-DE-B", aliquota: 5 },
    ],
  };
}

/** As pastas da foto dentro de uma pasta temporária, a raiz, que o teste apaga no fim. */
export type PastasDeTeste = PastasDaFoto & { raiz: string };

/** Entrega a foto, com o manifesto, na entrada de uma pasta temporária nova. */
export function gravarFotoDeTeste(foto: Foto = montarFotoDeTeste()): PastasDeTeste {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "crm-fotos-"));
  const pastas = { raiz, entrada: path.join(raiz, "entrada"), conferidas: path.join(raiz, "conferidas") };
  entregarFotoDeTeste(pastas.entrada, foto);
  return pastas;
}

/**
 * Grava a foto e, por último, o manifesto, como o extrator, e devolve o nome do manifesto.
 * `mudarManifesto` estraga o manifesto de propósito.
 */
export function entregarFotoDeTeste(entrada: string, foto: Foto, mudarManifesto = (manifesto: ManifestoDaFoto) => manifesto): string {
  fs.mkdirSync(entrada, { recursive: true });
  const nomeDaFoto = `foto-${foto.foto.gerada_em.replace(/[-:]/g, "").replace("T", "-")}-1.db`;
  const arquivo = path.join(entrada, nomeDaFoto);
  const db = new DatabaseSync(arquivo);
  db.exec(ESQUEMA);
  // Numa transação só: linha por linha, cada uma vai ao disco, e os testes ficam lentos.
  db.exec("BEGIN");
  for (const [tabela, conteudo] of Object.entries(foto)) {
    for (const linha of Array.isArray(conteudo) ? conteudo : [conteudo]) {
      const colunas = Object.keys(linha);
      const valores = Object.values(linha) as SQLInputValue[];
      db.prepare(`INSERT INTO ${tabela} (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`).run(...valores);
    }
  }
  db.exec("COMMIT");
  const contagens = contarLinhasPorTabela(db);
  db.close();
  const conteudo = fs.readFileSync(arquivo);
  const manifesto: ManifestoDaFoto = {
    versaoDoEsquema: foto.foto.versao_esquema,
    geradaEm: foto.foto.gerada_em,
    tamanho: conteudo.length,
    sha256: crypto.createHash("sha256").update(conteudo).digest("hex"),
    contagens,
  };
  const nome = nomeDoManifesto(nomeDaFoto);
  fs.writeFileSync(path.join(entrada, nome), JSON.stringify(mudarManifesto(manifesto)));
  return nome;
}
