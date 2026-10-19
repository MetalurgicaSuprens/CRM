/*
 * Esquema da foto.db (docs/dados-por-tela.md, "Esquema proposto da foto"). O extrator grava, o
 * servidor só lê. Mudou o esquema, sobe a versão: o servidor recusa a foto de outra versão.
 * Todo cliente é o id opaco; o código do ERP só aparece em `cliente.codigo_erp`, e só de empresa.
 * O grupo do SGI com dois ou mais CNPJs na carteira de um representante também é uma linha de
 * `cliente`, com as compras deles somadas; cada CNPJ aponta para ela em `cliente.grupo`.
 */

export const VERSAO_DO_ESQUEMA = 15;

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
  municipio_ibge TEXT,
  endereco TEXT,
  bairro TEXT,
  cep TEXT,
  latitude REAL,
  longitude REAL,
  precisao_do_ponto TEXT,
  mercado TEXT NOT NULL,
  situacao TEXT NOT NULL,
  status TEXT NOT NULL,
  ultima_compra TEXT,
  cliente_desde INTEGER,
  ciclo_dias INTEGER,
  faturamento_12m REAL NOT NULL,
  variacao_12m REAL,
  evolucao_12m TEXT NOT NULL,
  grupo_mix TEXT,
  tabela_preco TEXT,
  lista_de_precos INTEGER,
  queda_no_semestre REAL,
  grupo TEXT,
  cnpjs INTEGER
) STRICT;
CREATE INDEX cliente_representante ON cliente (representante);
CREATE INDEX cliente_grupo ON cliente (grupo);

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
  pecas REAL NOT NULL,
  PRIMARY KEY (cliente, familia)
) STRICT;

CREATE TABLE produto (
  produto TEXT PRIMARY KEY,
  familia TEXT NOT NULL,
  medida TEXT,
  embalagem INTEGER
) STRICT;

CREATE TABLE lista_de_precos (
  lista INTEGER NOT NULL,
  produto TEXT NOT NULL,
  preco_cento REAL NOT NULL,
  part_number TEXT,
  PRIMARY KEY (lista, produto)
) STRICT;

CREATE TABLE produto_comprado (
  cliente TEXT NOT NULL,
  produto TEXT NOT NULL,
  PRIMARY KEY (cliente, produto)
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
  ritmo_por_dia_util REAL,
  PRIMARY KEY (representante, mes)
) STRICT;

CREATE TABLE painel_historico (
  representante TEXT NOT NULL,
  mes TEXT NOT NULL,
  faturado REAL NOT NULL,
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

CREATE TABLE pedido_aberto_item (
  pedido TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  produto TEXT NOT NULL,
  pecas REAL NOT NULL,
  entrega TEXT NOT NULL,
  valor REAL NOT NULL,
  PRIMARY KEY (pedido, ordem)
) STRICT;

CREATE TABLE pedido_faturado (
  pedido TEXT PRIMARY KEY,
  representante TEXT NOT NULL,
  cliente TEXT NOT NULL,
  emissao TEXT NOT NULL,
  faturado_em TEXT NOT NULL,
  itens INTEGER NOT NULL,
  valor REAL NOT NULL
) STRICT;
CREATE INDEX pedido_faturado_cliente ON pedido_faturado (cliente);

CREATE TABLE pedido_faturado_item (
  pedido TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  produto TEXT NOT NULL,
  pecas REAL NOT NULL,
  valor REAL NOT NULL,
  PRIMARY KEY (pedido, ordem)
) STRICT;

CREATE TABLE nota (
  nota TEXT NOT NULL,
  serie TEXT NOT NULL,
  representante TEXT NOT NULL,
  cliente TEXT,
  emissao TEXT NOT NULL,
  valor REAL NOT NULL,
  pedidos TEXT NOT NULL,
  PRIMARY KEY (nota, serie)
) STRICT;
CREATE INDEX nota_representante ON nota (representante);

CREATE TABLE nota_item (
  nota TEXT NOT NULL,
  serie TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  produto TEXT NOT NULL,
  pecas REAL NOT NULL,
  valor REAL NOT NULL,
  PRIMARY KEY (nota, serie, ordem)
) STRICT;
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
    /** Código IBGE de 7 dígitos do município (CRCL.RESERVADO7); null fora do formato ou de outro estado. */
    municipio_ibge: string | null;
    /** Só da empresa (versão 14): CRCL.ENDERECO como está, com o número e o complemento. */
    endereco: string | null;
    bairro: string | null;
    /** 8 dígitos. */
    cep: string | null;
    /** O ponto do endereço pelo CNEFE do IBGE (extrator/src/localizacao); null sem endereço ou sem achar. */
    latitude: number | null;
    longitude: number | null;
    /** dominio/tipos.ts, PrecisaoDoPonto; null sem ponto. */
    precisao_do_ponto: string | null;
    mercado: string;
    /** A situação de compra (dominio/tipos.ts, Situacao). */
    situacao: string;
    /** O status no cadastro do SGI: ativo, inativo ou substituido (dominio/tipos.ts, StatusDoCadastro). */
    status: string;
    ultima_compra: string | null;
    cliente_desde: number | null;
    ciclo_dias: number | null;
    faturamento_12m: number;
    variacao_12m: number | null;
    evolucao_12m: string;
    grupo_mix: string | null;
    /** Nome da tabela de preço do cliente; null sem catálogo. */
    tabela_preco: string | null;
    /** A lista de `lista_de_precos` do cliente; null sem catálogo. */
    lista_de_precos: number | null;
    /** Só no cliente em risco: a variação do semestre que o pôs em risco (a de `analise_ritmo`, "menos"). */
    queda_no_semestre: number | null;
    /** No CNPJ de um grupo: a linha do grupo. Null no cliente sozinho e na linha do próprio grupo. */
    grupo: string | null;
    /** Na linha do grupo: quantos CNPJs ele tem na carteira. Null nas outras linhas. */
    cnpjs: number | null;
  }[];
  cliente_mes: { cliente: string; mes: string; valor: number }[];
  /** Os 12 meses fechados: o valor, a parte no faturado e as peças (versão 11). */
  cliente_familia: { cliente: string; familia: string; valor: number; participacao: number; pecas: number }[];
  /** Medida ("14–22 mm") e embalagem (peças) só nos produtos de alguma lista de preços. */
  produto: { produto: string; familia: string; medida: string | null; embalagem: number | null }[];
  /**
   * Preço do cento de cada produto vendável, por lista: clientes com a mesma tabela e os mesmos
   * descontos dividem uma lista (extrator/src/calculo/catalogo.ts).
   */
  lista_de_precos: { lista: number; produto: string; preco_cento: number; part_number: string | null }[];
  /** Os produtos da lista do cliente que ele comprou nos últimos 24 meses: a aba "Já comprados". */
  produto_comprado: { cliente: string; produto: string }[];
  ficha_produto: { cliente: string; produto: string; pecas_12m: number; valor_12m: number; ultima_compra: string }[];
  cliente_mix: { cliente: string; familia: string; penetracao: number; ordem: number }[];
  /** As listas das análises têm o grupo no lugar dos CNPJs dele. */
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
    /** Só no mês corrente: faturado por dia útil nos últimos 6 meses fechados (dominio/projecao.ts). */
    ritmo_por_dia_util: number | null;
  }[];
  /** O faturado de cada um dos 60 meses fechados, na visão do representante: a tendência do Início (versão 15). */
  painel_historico: { representante: string; mes: string; faturado: number }[];
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
  /** Os itens com saldo de cada pedido, na ordem do pedido; o mesmo produto pode vir em duas entregas. */
  pedido_aberto_item: { pedido: string; ordem: number; produto: string; pecas: number; entrega: string; valor: number }[];
  /**
   * Pedidos sem saldo com nota de venda nos 12 meses fechados e no corrente, só de cliente da carteira
   * de um autorizado: o histórico da ficha. `faturado_em` é a última nota; `itens`, os produtos das notas.
   */
  pedido_faturado: {
    pedido: string;
    representante: string;
    cliente: string;
    emissao: string;
    faturado_em: string;
    itens: number;
    valor: number;
  }[];
  /** Os produtos de cada pedido faturado, um por produto, na ordem em que foram faturados. */
  pedido_faturado_item: { pedido: string; ordem: number; produto: string; pecas: number; valor: number }[];
  nota: {
    nota: string;
    serie: string;
    representante: string;
    cliente: string | null;
    emissao: string;
    valor: number;
    /** Lista em JSON dos pedidos do ERP de onde a nota saiu. */
    pedidos: string;
  }[];
  /** Os itens de cada nota, na ordem da nota. */
  nota_item: { nota: string; serie: string; ordem: number; produto: string; pecas: number; valor: number }[];
};
