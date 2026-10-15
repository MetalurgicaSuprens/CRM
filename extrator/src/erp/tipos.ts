import type { Mercado, StatusDoCadastro } from "dominio/tipos";

/*
 * O que o extrator lê do ERP, já com nomes do CRM. A chave do cliente ("empresa/código") só
 * existe na LAN: a foto leva o id opaco.
 */

export type ClienteDaCarteira = {
  chave: string;
  empresa: number;
  cliente: number;
  isPessoaFisica: boolean;
  /** NOM_FANTAS, que costuma vir cortado em 25 caracteres. */
  fantasia: string;
  /** RAZ_SOCIAL emendada com COMPLEM_RZ. */
  razaoSocial: string;
  cidade: string;
  uf: string;
  /** Código IBGE do município; null fora do formato (erp/carteira.ts, municipioDoCadastro). */
  municipio: string | null;
  mercado: Mercado;
  /** VEND_1: o representante dono do cliente. */
  representante: string;
  /** Fora de ativo no cadastro do SGI, o cliente aparece, mas não recebe pedido (dominio/statusDoCadastro.ts). */
  status: StatusDoCadastro;
};

export type VendaDoMes = { chave: string; mes: string; valor: number; pecas: number };

export type DatasDeCompra = {
  primeiraCompra: string;
  /** A última nota antes da janela de 36 meses: mostra se a volta é de um cliente reativado. */
  ultimaAntesDaJanela: string | null;
  /** Dias com nota de venda dentro da janela, em ordem. */
  datas: string[];
};

/** Faturado por família nos 24 meses fechados, de qualquer cliente da Suprens (para o mix). */
export type FamiliaDoCliente = {
  chave: string;
  mercado: Mercado;
  /** null para o produto sem grupo de custo. */
  familia: string | null;
  valor12m: number;
  valor24m: number;
};

/** Os 8 produtos de maior valor do cliente nos 12 meses fechados. */
export type ProdutoDoCliente = {
  chave: string;
  produto: string;
  familia: string | null;
  pecas: number;
  valor: number;
  ultimaCompra: string;
};

/** Item com saldo de um pedido do Omega. */
export type ItemEmAbertoNoErp = {
  produto: string;
  /** null para o produto sem grupo de custo. */
  familia: string | null;
  /** O saldo, em peças. */
  pecas: number;
  entrega: string;
  /** Saldo × preço, com os descontos do item e a Zona Franca do pedido. */
  valor: number;
};

/** Pedido do Omega com saldo, de qualquer representante. */
export type PedidoEmAbertoNoErp = {
  pedido: string;
  chave: string;
  /** VEPM.VENDEDOR e, sem ele, o dono atual do cliente. */
  representante: string;
  emissao: string;
  /** Os itens com saldo, na ordem do pedido: sempre pelo menos um. */
  itens: ItemEmAbertoNoErp[];
};

/** Pedido do Omega com nota de venda nos 12 meses fechados e no corrente: o histórico da ficha. */
export type PedidoFaturadoNoErp = {
  pedido: string;
  chave: string;
  /** VEPM.VENDEDOR e, sem ele, o dono atual do cliente. */
  representante: string;
  emissao: string;
  /** A última nota do pedido no período. */
  faturadoEm: string;
  /** As linhas das notas do pedido no período, em ordem; o mesmo produto pode vir em mais de uma. */
  itens: ItemDaNota[];
};

/** Item de uma nota de venda. */
export type ItemDaNota = {
  produto: string;
  /** null para o produto sem grupo de custo. */
  familia: string | null;
  pecas: number;
  /** O valor da RF: sem IPI e sem o desconto da Zona Franca. */
  valor: number;
};

/** Nota de venda dos últimos 45 dias de um representante autorizado. */
export type NotaRecente = {
  nota: string;
  serie: string;
  chave: string;
  representante: string;
  emissao: string;
  /** Os pedidos do Omega de onde a nota saiu (NFME.NRO_PEDIDO), sem repetir. */
  pedidos: string[];
  /** Na ordem da nota: sempre pelo menos um. */
  itens: ItemDaNota[];
};

/** Faturado de cada representante autorizado por dia, desde 1º de janeiro do ano anterior. */
export type VendaDoDia = { representante: string; dia: string; valor: number };

/** Uma tabela de preço ligada ao cliente no SGI (SGI5_TAB_VEN_CLI), com o cadastro dela (TP1). */
export type TabelaDoCliente = {
  /** O número do cliente (CLI_COD = CRCL.CLIENTE). */
  cliente: number;
  tabela: string;
  /** PRINCIPAL, SECUNDARIA ou null (CLI_STA). */
  papel: string | null;
  nome: string | null;
  /** REAL, DOLAR ou EURO (TP1_MOE). */
  moeda: string | null;
  /** ATIVO ou OBSOLETO (TP1_STA). */
  situacao: string | null;
};

/** Preço líquido de um produto ativo numa tabela do cliente, pela view do SGI. */
export type PrecoDoCliente = {
  cliente: number;
  tabela: string;
  produto: string;
  /** Preço do cento com o desconto do modelo do produto, ou o padrão do cliente; sem IPI. */
  precoCento: number;
  /** O part number da tabela: o código da montadora ou do cliente para o produto. */
  partNumber: string | null;
};

/** Família, medida e embalagem de um produto das tabelas de preço. */
export type ProdutoDaTabela = {
  produto: string;
  familia: string | null;
  medidaMinimaMm: number | null;
  medidaMaximaMm: number | null;
  /** Peças por embalagem (EAN_QTD); null sem EAN. */
  embalagem: number | null;
};

/** Produto que o cliente comprou nos últimos 24 meses: a aba "Já comprados" do pedido. */
export type ProdutoJaComprado = { chave: string; produto: string };

export type DadosDoErp = {
  geradaEm: string;
  /** Código → nome (CRVN) dos representantes autorizados. */
  representantes: Map<string, string>;
  carteira: ClienteDaCarteira[];
  vendasDoMes: VendaDoMes[];
  datasDeCompra: Map<string, DatasDeCompra>;
  familias: FamiliaDoCliente[];
  produtos: ProdutoDoCliente[];
  pedidos: PedidoEmAbertoNoErp[];
  pedidosFaturados: PedidoFaturadoNoErp[];
  notas: NotaRecente[];
  vendasDoDia: VendaDoDia[];
  tabelas: TabelaDoCliente[];
  precos: PrecoDoCliente[];
  produtosDasTabelas: ProdutoDaTabela[];
  jaComprados: ProdutoJaComprado[];
};
