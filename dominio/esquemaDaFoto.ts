/*
 * Esquema da foto.db (docs/dados-por-tela.md, "Esquema proposto da foto"). O extrator grava, o
 * servidor só lê. Mudou o esquema, sobe a versão: o servidor recusa a foto de outra versão.
 * Todo cliente é o id opaco; o código do ERP só aparece em `cliente.codigo_erp`, e só de empresa.
 * O grupo do SGI com dois ou mais CNPJs na carteira de um representante também é uma linha de
 * `cliente`, com as compras deles somadas; cada CNPJ aponta para ela em `cliente.grupo`.
 */

export const VERSAO_DO_ESQUEMA = 22;

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
  cpf TEXT,
  cnpj TEXT,
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
  embalagem INTEGER,
  peso_kg REAL
) STRICT;

CREATE TABLE lista_de_precos (
  lista INTEGER NOT NULL,
  produto TEXT NOT NULL,
  preco_cento REAL NOT NULL,
  PRIMARY KEY (lista, produto)
) STRICT;

CREATE TABLE produto_part_number (
  produto TEXT NOT NULL,
  part_number TEXT NOT NULL,
  PRIMARY KEY (produto, part_number)
) STRICT;

CREATE TABLE produto_comprado (
  cliente TEXT NOT NULL,
  produto TEXT NOT NULL,
  ultima_compra TEXT,
  preco_cento_na_ultima REAL,
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
  valor_ipi REAL NOT NULL,
  valor_entrega_no_mes REAL NOT NULL,
  cfop TEXT,
  cfop_descricao TEXT
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
  valor REAL NOT NULL,
  valor_ipi REAL NOT NULL,
  cfop TEXT,
  cfop_descricao TEXT,
  notas TEXT NOT NULL
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
  valor_ipi REAL NOT NULL,
  valor_total REAL NOT NULL,
  transportadora TEXT,
  cfop TEXT,
  cfop_descricao TEXT,
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

CREATE TABLE cliente_cadastro (
  cliente TEXT PRIMARY KEY,
  documento TEXT NOT NULL,
  inscricao_estadual TEXT,
  suframa TEXT,
  telefone TEXT,
  email_xml TEXT,
  endereco TEXT,
  bairro TEXT,
  cep TEXT,
  condicao_pagamento TEXT,
  base_ipi INTEGER NOT NULL,
  ultimo_pedido_em TEXT
) STRICT;

CREATE TABLE cliente_local (
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  documento TEXT NOT NULL,
  inscricao_estadual TEXT,
  endereco TEXT NOT NULL,
  bairro TEXT,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  cep TEXT,
  PRIMARY KEY (cliente, tipo)
) STRICT;

CREATE TABLE cliente_escolha (
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL,
  valor TEXT NOT NULL,
  pedidos INTEGER NOT NULL,
  PRIMARY KEY (cliente, tipo, valor)
) STRICT;

CREATE TABLE ultimo_pedido_item (
  cliente TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  produto TEXT NOT NULL,
  pecas REAL NOT NULL,
  PRIMARY KEY (cliente, ordem)
) STRICT;

CREATE TABLE transportadora (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  endereco TEXT,
  bairro TEXT,
  cep TEXT,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL
) STRICT;

CREATE TABLE representante_transportadora (
  representante TEXT NOT NULL,
  transportadora TEXT NOT NULL,
  pedidos INTEGER NOT NULL,
  PRIMARY KEY (representante, transportadora)
) STRICT;

CREATE TABLE condicao_pagamento (
  codigo TEXT PRIMARY KEY,
  descricao TEXT NOT NULL
) STRICT;

CREATE TABLE produto_ipi (
  produto TEXT PRIMARY KEY,
  aliquota REAL NOT NULL
) STRICT;
`;

/** Uma nota de um pedido faturado, na lista em JSON de `pedido_faturado.notas`. */
export type NotaDoPedidoNaFoto = { numero: string; emissao: string; valor_total: number; transportadora: string | null };

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
    /** Só da pessoa física (versão 19): o CPF com a pontuação, como o app antigo dos representantes mostra. */
    cpf: string | null;
    /** Só da empresa (versão 20): o CNPJ com a pontuação, como o app antigo dos representantes mostra. */
    cnpj: string | null;
    representante: string;
    nome: string;
    razao_social: string;
    cidade: string;
    uf: string;
    /** Código IBGE de 7 dígitos do município (CRCL.RESERVADO7); null fora do formato ou de outro estado. */
    municipio_ibge: string | null;
    /** CRCL.ENDERECO como está, com o número e o complemento; da empresa desde a versão 14 e da pessoa física desde a 19. */
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
  produto: {
    produto: string;
    familia: string;
    medida: string | null;
    embalagem: number | null;
    /** O peso de uma peça, em kg (ESTQ.PESO_POR_UNID), como o relatório do pedido do app antigo; null sem cadastro. */
    peso_kg: number | null;
  }[];
  /**
   * Preço do cento de cada produto vendável, por lista: clientes com a mesma tabela e os mesmos
   * descontos dividem uma lista (extrator/src/calculo/catalogo.ts).
   */
  lista_de_precos: {
    lista: number;
    produto: string;
    preco_cento: number;
  }[];
  /**
   * Os part numbers da Bíblia Montadora do SGI (versão 16): os itens ativos das tabelas de preço de
   * montadora, só dos produtos de alguma lista. Sem o nome da montadora, que nenhuma tela usa.
   */
  produto_part_number: { produto: string; part_number: string }[];
  /**
   * Os produtos da lista do cliente que ele comprou nos últimos 24 meses: a aba "Já comprados". Com a
   * última compra com preço (versão 17): o dia e o preço do cento na nota, o preço com que o item entra no
   * pedido. Nulos quando o produto só veio sem valor, como bonificação.
   */
  produto_comprado: { cliente: string; produto: string; ultima_compra: string | null; preco_cento_na_ultima: number | null }[];
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
    /** Sem IPI, como o faturamento. */
    valor: number;
    /** O IPI do saldo, pela alíquota de cada item do pedido (VEPD.PORC_IPI), desde a versão 20. */
    valor_ipi: number;
    valor_entrega_no_mes: number;
    /** O CFOP do pedido (VEPM.CFO) e a descrição dele no ERP (NFCF), desde a versão 20. */
    cfop: string | null;
    cfop_descricao: string | null;
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
    /** O IPI das notas do pedido (NFDE.VLR_IPI), desde a versão 20. */
    valor_ipi: number;
    cfop: string | null;
    cfop_descricao: string | null;
    /** Lista em JSON das notas do pedido no período (NotaDoPedidoNaFoto), da mais antiga à mais nova. */
    notas: string;
  }[];
  /** Os produtos de cada pedido faturado, um por produto, na ordem em que foram faturados. */
  pedido_faturado_item: { pedido: string; ordem: number; produto: string; pecas: number; valor: number }[];
  nota: {
    nota: string;
    serie: string;
    representante: string;
    cliente: string | null;
    emissao: string;
    /** Sem IPI, como o faturamento. */
    valor: number;
    /**
     * Desde a versão 20, como o app antigo dos representantes: o IPI, o total da nota com os impostos
     * (NFME.VLR_N_FISC), a transportadora e o CFOP.
     */
    valor_ipi: number;
    valor_total: number;
    transportadora: string | null;
    cfop: string | null;
    cfop_descricao: string | null;
    /** Lista em JSON dos pedidos do ERP de onde a nota saiu. */
    pedidos: string;
  }[];
  /** Os itens de cada nota, na ordem da nota. */
  nota_item: { nota: string; serie: string; ordem: number; produto: string; pecas: number; valor: number }[];
  /*
   * Os dados da tela de pedido (versão 18), como no app antigo dos representantes (SGI6R). Só dos CNPJs
   * da carteira, porque o pedido é sempre de um CNPJ, e também da pessoa física: pela regra 3 do
   * CLAUDE.md, mudada em 2026-11-17, entra o que o SGI6R mostra. Nada de crédito, banco ou contato de pessoa.
   */
  /** O cadastro que o representante confere. `base_ipi` é 1 quando o CFOP do cliente cobra IPI (NFTF.BASE_IPI = 'S'), como no SGI6R. */
  cliente_cadastro: {
    cliente: string;
    /** O CNPJ ou o CPF, já com a pontuação. */
    documento: string;
    inscricao_estadual: string | null;
    suframa: string | null;
    telefone: string | null;
    email_xml: string | null;
    /** O endereço do faturamento (CRCL), também da pessoa física. */
    endereco: string | null;
    bairro: string | null;
    cep: string | null;
    /** O código da condição de pagamento do cadastro (CRCL.COND_PGTO). */
    condicao_pagamento: string | null;
    base_ipi: number;
    /** O dia do último pedido do cliente nos 24 meses; null sem pedido. */
    ultimo_pedido_em: string | null;
  }[];
  /** A cobrança e a entrega do cadastro (CRCA, TIPO_REG C e E), quando o cliente as tem: `tipo` é cobranca ou entrega. */
  cliente_local: {
    cliente: string;
    tipo: string;
    razao_social: string;
    documento: string;
    inscricao_estadual: string | null;
    endereco: string;
    bairro: string | null;
    cidade: string;
    uf: string;
    cep: string | null;
  }[];
  /**
   * Quantos pedidos do cliente nos 24 meses usaram cada escolha: `tipo` é transportadora (o código),
   * condicao (o código), classificacao (comercializacao, industrializacao, uso_consumo), parcial (sim, nao) ou
   * xped (sim, nao: se algum item levou o item da ordem de compra do cliente).
   */
  cliente_escolha: { cliente: string; tipo: string; valor: string; pedidos: number }[];
  /** Os itens do último pedido do cliente, na ordem dele, em peças: o "repetir o último pedido". */
  ultimo_pedido_item: { cliente: string; ordem: number; produto: string; pecas: number }[];
  /** As transportadoras do ERP (CFOR, TIPO_FORN = 'T', fora as marcadas INATIVO): dado de empresa. */
  transportadora: {
    codigo: string;
    nome: string;
    razao_social: string;
    cnpj: string;
    /** O endereço do cadastro (CFOR), como o relatório do pedido do app antigo mostra; null quando vazio. */
    endereco: string | null;
    bairro: string | null;
    /** Só os 8 dígitos; null sem CEP. */
    cep: string | null;
    cidade: string;
    uf: string;
  }[];
  /** Quantos pedidos de cada representante autorizado foram com cada transportadora, nos 24 meses. */
  representante_transportadora: { representante: string; transportadora: string; pedidos: number }[];
  /** As condições de pagamento que o representante escolhe (1000 a 1349, como no SGI6R) e as dos cadastros da carteira. */
  condicao_pagamento: { codigo: string; descricao: string }[];
  /** A alíquota de IPI de cada produto de alguma lista, em %. */
  produto_ipi: { produto: string; aliquota: number }[];
};
