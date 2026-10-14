import type { Mercado } from "dominio/tipos";

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
  mercado: Mercado;
  /** VEND_1: o representante dono do cliente. */
  representante: string;
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
  notas: NotaRecente[];
  vendasDoDia: VendaDoDia[];
  /** Calendário do SGI: dia → é dia útil. Dia sem linha cai para segunda a sexta. */
  diasUteis: Map<string, boolean>;
};
