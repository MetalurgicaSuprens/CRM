/*
 * Esquema da foto.db (docs/dados-por-tela.md, "Esquema proposto da foto"). O extrator grava, o
 * servidor só lê. Mudou o esquema, sobe a versão: o servidor recusa a foto de outra versão.
 * Todo cliente é o id opaco; o código do ERP só aparece em `cliente.codigo_erp`, e só de empresa.
 */

export const VERSAO_DO_ESQUEMA = 1;

export const ESQUEMA = `
CREATE TABLE foto (
  versao_esquema INTEGER NOT NULL,
  gerada_em TEXT NOT NULL,
  data_ref TEXT NOT NULL,
  mes_atual TEXT NOT NULL,
  dia_util INTEGER NOT NULL,
  dias_uteis INTEGER NOT NULL,
  semestre_inicio TEXT NOT NULL,
  semestre_fim TEXT NOT NULL
) STRICT;

CREATE TABLE representante (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL
) STRICT;

CREATE TABLE cliente (
  cliente TEXT PRIMARY KEY,
  codigo_erp TEXT,
  representante TEXT NOT NULL,
  nome TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  mercado TEXT NOT NULL,
  situacao TEXT NOT NULL,
  ultima_compra TEXT,
  cliente_desde INTEGER,
  ciclo_dias INTEGER,
  faturamento_12m REAL NOT NULL,
  variacao_12m REAL,
  evolucao_12m TEXT NOT NULL,
  grupo_mix TEXT
) STRICT;
CREATE INDEX cliente_representante ON cliente (representante);

CREATE TABLE cliente_mes (
  cliente TEXT NOT NULL,
  mes TEXT NOT NULL,
  valor REAL NOT NULL,
  PRIMARY KEY (cliente, mes)
) STRICT;

CREATE TABLE cliente_familia (
  cliente TEXT NOT NULL,
  familia TEXT NOT NULL,
  valor REAL NOT NULL,
  participacao REAL NOT NULL,
  PRIMARY KEY (cliente, familia)
) STRICT;

CREATE TABLE produto (
  produto TEXT PRIMARY KEY,
  familia TEXT NOT NULL
) STRICT;

CREATE TABLE ficha_produto (
  cliente TEXT NOT NULL,
  produto TEXT NOT NULL,
  pecas_12m REAL NOT NULL,
  valor_12m REAL NOT NULL,
  ultima_compra TEXT NOT NULL,
  PRIMARY KEY (cliente, produto)
) STRICT;

CREATE TABLE cliente_mix (
  cliente TEXT NOT NULL,
  familia TEXT NOT NULL,
  penetracao REAL NOT NULL,
  ordem INTEGER NOT NULL,
  PRIMARY KEY (cliente, familia)
) STRICT;

CREATE TABLE analise_parado (
  cliente TEXT PRIMARY KEY,
  perda_mensal REAL NOT NULL,
  ordem INTEGER NOT NULL
) STRICT;

CREATE TABLE analise_ritmo (
  cliente TEXT PRIMARY KEY,
  direcao TEXT NOT NULL,
  semestre REAL NOT NULL,
  semestre_ano_anterior REAL NOT NULL,
  variacao REAL NOT NULL,
  variacao_pecas REAL,
  ordem INTEGER NOT NULL
) STRICT;

CREATE TABLE analise_novo (
  cliente TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  desde TEXT NOT NULL,
  faturado_desde REAL NOT NULL,
  ordem INTEGER NOT NULL
) STRICT;

CREATE TABLE analise_mix (
  cliente TEXT PRIMARY KEY,
  ordem INTEGER NOT NULL
) STRICT;

CREATE TABLE painel_mes (
  representante TEXT NOT NULL,
  mes TEXT NOT NULL,
  faturado REAL,
  ano_anterior REAL NOT NULL,
  ano_anterior_ate_dia_util REAL,
  PRIMARY KEY (representante, mes)
) STRICT;

CREATE TABLE pedido_aberto (
  pedido TEXT PRIMARY KEY,
  representante TEXT NOT NULL,
  cliente TEXT,
  emissao TEXT NOT NULL,
  entrega TEXT NOT NULL,
  itens INTEGER NOT NULL,
  valor REAL NOT NULL,
  valor_entrega_no_mes REAL NOT NULL
) STRICT;
CREATE INDEX pedido_aberto_representante ON pedido_aberto (representante);

CREATE TABLE nota (
  nota TEXT NOT NULL,
  serie TEXT NOT NULL,
  representante TEXT NOT NULL,
  cliente TEXT,
  emissao TEXT NOT NULL,
  valor REAL NOT NULL,
  PRIMARY KEY (nota, serie)
) STRICT;
CREATE INDEX nota_representante ON nota (representante);
`;

/** O conteúdo da foto, tabela a tabela: o nome de cada campo é o nome da tabela e das colunas. */
export type Foto = {
  foto: {
    versao_esquema: number;
    gerada_em: string;
    data_ref: string;
    mes_atual: string;
    dia_util: number;
    dias_uteis: number;
    semestre_inicio: string;
    semestre_fim: string;
  };
  representante: { codigo: string; nome: string }[];
  cliente: {
    cliente: string;
    codigo_erp: string | null;
    representante: string;
    nome: string;
    razao_social: string;
    cidade: string;
    uf: string;
    mercado: string;
    situacao: string;
    ultima_compra: string | null;
    cliente_desde: number | null;
    ciclo_dias: number | null;
    faturamento_12m: number;
    variacao_12m: number | null;
    evolucao_12m: string;
    grupo_mix: string | null;
  }[];
  cliente_mes: { cliente: string; mes: string; valor: number }[];
  cliente_familia: { cliente: string; familia: string; valor: number; participacao: number }[];
  produto: { produto: string; familia: string }[];
  ficha_produto: { cliente: string; produto: string; pecas_12m: number; valor_12m: number; ultima_compra: string }[];
  cliente_mix: { cliente: string; familia: string; penetracao: number; ordem: number }[];
  analise_parado: { cliente: string; perda_mensal: number; ordem: number }[];
  analise_ritmo: {
    cliente: string;
    direcao: string;
    semestre: number;
    semestre_ano_anterior: number;
    variacao: number;
    variacao_pecas: number | null;
    ordem: number;
  }[];
  analise_novo: { cliente: string; tipo: string; desde: string; faturado_desde: number; ordem: number }[];
  analise_mix: { cliente: string; ordem: number }[];
  painel_mes: {
    representante: string;
    mes: string;
    faturado: number | null;
    ano_anterior: number;
    ano_anterior_ate_dia_util: number | null;
  }[];
  pedido_aberto: {
    pedido: string;
    representante: string;
    cliente: string | null;
    emissao: string;
    entrega: string;
    itens: number;
    valor: number;
    valor_entrega_no_mes: number;
  }[];
  nota: { nota: string; serie: string; representante: string; cliente: string | null; emissao: string; valor: number }[];
};
