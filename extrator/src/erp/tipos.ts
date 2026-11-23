import type { Mercado, StatusDoCadastro } from "dominio/tipos";
import type { PontoLocalizado } from "../localizacao/cnefe.ts";

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
  /** O endereço do cadastro, da empresa e da pessoa física (regra 3 do CLAUDE.md, mudada em 2026-11-17). */
  endereco: EnderecoDoCliente | null;
  /** Os dígitos do CNPJ ou do CPF, como o app antigo dos representantes lê. */
  documento: string | null;
  /** O ponto do endereço no mapa. Quem preenche é a localização (localizacao/), não o ERP. */
  ponto: PontoLocalizado | null;
  mercado: Mercado;
  /** VEND_1: o representante dono do cliente. */
  representante: string;
  /** Fora de ativo no cadastro do SGI, o cliente aparece, mas não recebe pedido (dominio/statusDoCadastro.ts). */
  status: StatusDoCadastro;
  /**
   * O campo Grupo do cadastro do SGI, em maiúsculas, só quando alguém o digitou; null quando ele
   * tem o nome fantasia, que a tela grava sozinha com o campo vazio (erp/carteira.ts).
   */
  grupo: string | null;
};

export type EnderecoDoCliente = {
  /** CRCL.ENDERECO como está: a rua, o número e o complemento num texto só. */
  texto: string;
  bairro: string | null;
  /** 8 dígitos; null fora do formato. */
  cep: string | null;
};

export type VendaDoMes ={ chave: string; mes: string; valor: number; pecas: number };

export type DatasDeCompra = {
  primeiraCompra: string;
  /** A última nota antes da janela de 36 meses: mostra se a volta é de um cliente reativado. */
  ultimaAntesDaJanela: string | null;
  /** Dias com nota de venda dentro da janela, em ordem. */
  datas: string[];
};

/** Faturado por família nos 24 meses fechados, de qualquer cliente da Suprens (para o mix e a ficha). */
export type FamiliaDoCliente = {
  chave: string;
  mercado: Mercado;
  /** null para o produto sem grupo de custo. */
  familia: string | null;
  valor12m: number;
  valor24m: number;
  /** Peças nos 12 meses fechados, com o cento já em peças (erp/sql.ts, `emPecas`). */
  pecas12m: number;
};

/** Um produto que o cliente comprou nos 12 meses fechados; a ficha mostra os 8 de maior valor (calculo/clientes.ts). */
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
  /** O IPI do saldo, pela alíquota do item (VEPD.PORC_IPI). */
  ipi: number;
};

/** O CFOP de um pedido ou de uma nota, com a descrição do ERP (NFCF). */
export type CfopDoErp = { codigo: string; descricao: string | null };

/** A transportadora de uma nota (NFME.TRANSPORTADOR), como está no cadastro de fornecedores (CFOR). */
export type TransportadoraDaNota = { codigo: string; fantasia: string | null; razaoSocial: string | null };

/** Uma nota de um pedido faturado: o número, o total com os impostos (NFME.VLR_N_FISC) e quem levou. */
export type NotaDoPedidoDoErp = { numero: string; serie: string; emissao: string; valorTotal: number; transportadora: TransportadoraDaNota | null };

/** Pedido do Omega com saldo, de qualquer representante. */
export type PedidoEmAbertoNoErp = {
  pedido: string;
  chave: string;
  /** VEPM.VENDEDOR e, sem ele, o dono atual do cliente. */
  representante: string;
  emissao: string;
  cfop: CfopDoErp | null;
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
  cfop: CfopDoErp | null;
  /** As notas do pedido no período, da mais antiga à mais nova. */
  notas: NotaDoPedidoDoErp[];
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
  /** NFDE.VLR_IPI. */
  ipi: number;
};

/** Nota de venda dos últimos 45 dias de um representante autorizado. */
export type NotaRecente = {
  nota: string;
  serie: string;
  chave: string;
  representante: string;
  emissao: string;
  /** O total com os impostos (NFME.VLR_N_FISC), somado nos tipos de movimento da nota. */
  valorTotal: number;
  transportadora: TransportadoraDaNota | null;
  cfop: CfopDoErp | null;
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
  /** A alíquota de IPI do produto na view, em %: a mesma em toda tabela (conferido em 2026-11-17). */
  aliquotaIpi: number;
  /** Os part numbers do produto na tabela do cliente (VIEW_PNU, sem o "0"), juntos por vírgula; null sem nenhum. */
  partNumbers: string | null;
};

/** Um part number da Bíblia Montadora: o código que uma montadora dá ao produto. */
export type PartNumberDaBiblia = { produto: string; partNumber: string };

/** Família, medida e embalagem de um produto das tabelas de preço. */
export type ProdutoDaTabela = {
  produto: string;
  familia: string | null;
  medidaMinimaMm: number | null;
  medidaMaximaMm: number | null;
  /** Peças por embalagem (EAN_QTD); null sem EAN. */
  embalagem: number | null;
  /** O peso de uma peça, em kg (ESTQ.PESO_POR_UNID); null sem cadastro. */
  pesoKg: number | null;
};

/** Produto que o cliente comprou nos últimos 24 meses: a aba "Já comprados" do pedido. */
/** Produto que o cliente comprou nos 24 meses, com a última compra que tem preço: o dia e o preço do cento na nota. */
export type ProdutoJaComprado = { chave: string; produto: string; ultimaCompra: { data: string; precoCento: number } | null };

/** O cadastro do cliente que a tela de pedido mostra, como o SGI6R lê (erp/dadosDoPedido.ts). */
export type CadastroDoErp = {
  chave: string;
  isPessoaFisica: boolean;
  /** Só os dígitos do CNPJ ou do CPF, sem os zeros da esquerda que o número perde. */
  documento: string;
  inscricaoEstadual: string | null;
  suframa: string | null;
  ddd: number;
  telefone: number;
  emailDoXml: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: number;
  condicaoDePagamento: string | null;
  /** O CFOP do cliente cobra IPI (NFTF.BASE_IPI = 'S'): sem isso, o SGI6R não põe IPI no item. */
  isBaseDoIpi: boolean;
};

/** A cobrança ou a entrega do cadastro (CRCA). */
export type LocalDoErp = {
  chave: string;
  tipo: "cobranca" | "entrega";
  razaoSocial: string;
  documento: string;
  endereco: string;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: number;
  /** A inscrição estadual do CNPJ do local (CRCA.INSCR_ESTD), como o relatório do pedido do app antigo. */
  inscricaoEstadual: string | null;
};

export type TransportadoraDoErp = {
  codigo: string;
  fantasia: string | null;
  razaoSocial: string;
  documento: string;
  endereco: string | null;
  bairro: string | null;
  /** O CEP como o CFOR guarda: 0 quando não há. */
  cep: number;
  cidade: string;
  uf: string;
};

export type CondicaoDoErp = { codigo: string; descricao: string };

/** Pedidos do cliente com a mesma combinação de escolhas. */
export type EscolhasDoErp = {
  chave: string;
  transportadora: string | null;
  condicao: string | null;
  /** COMERCIALIZACAO, INDUSTRIALIZACAO ou USO/CONSUMO (PV1_CVE). */
  classificacao: string | null;
  /** ACEITA FRETE PARCIAL ou NAO ACEITA FRETE PARCIAL (PV1_TFR). */
  freteParcial: string | null;
  /** Algum item levou o item da ordem de compra do cliente (PV2_IOC > 0): o cliente que exige o xPed na nota. */
  isComItemDaOrdemDeCompra: boolean;
  pedidos: number;
};

export type UsoDaTransportadora = { representante: string; transportadora: string; pedidos: number };

/** Um item do último pedido do cliente. */
export type UltimoPedidoDoErp = { chave: string; dia: string; produto: string; pecas: number };

/** Tudo o que a tela de pedido precisa, além do catálogo. */
export type DadosDoPedidoDoErp = {
  cadastros: CadastroDoErp[];
  locais: LocalDoErp[];
  transportadoras: TransportadoraDoErp[];
  condicoes: CondicaoDoErp[];
  escolhas: EscolhasDoErp[];
  transportadorasDosRepresentantes: UsoDaTransportadora[];
  ultimosPedidos: UltimoPedidoDoErp[];
};

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
  partNumbers: PartNumberDaBiblia[];
  produtosDasTabelas: ProdutoDaTabela[];
  jaComprados: ProdutoJaComprado[];
  dadosDoPedido: DadosDoPedidoDoErp;
};
