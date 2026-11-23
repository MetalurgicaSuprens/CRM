import { dataDoMomento, somarDias } from "dominio/datas";
import { primeiraEntregaPossivel } from "dominio/pedido";
import type { CadastroDoPedido, EnderecoDaTransportadora, PrecosMinimos, ProdutoDoPedido } from "../erp/dadosDaGravacao.ts";
import type { PedidoNoErp } from "./conferencia.ts";
import type { PedidoRecebido } from "./formato.ts";

/*
 * As chamadas às procedures de pedido do SGI, com os mesmos valores que o app antigo dos representantes
 * manda, campo a campo (docs/pedido-no-sgi.md; SGI6R: untPedidos_Incluir.pas, btnGravarClick, e
 * untPedidos_IncluirItens.pas, edPacExit). Sem o Oracle: quem chama lê os dados e executa.
 * O pedido entra como COTACAO (operação 1), com os itens, e é efetivado em seguida (operação 13), o que
 * o deixa PEDIDO BLOQUEADO, esperando as liberações de sempre. Nenhum dado de crédito vai junto.
 */

/** Uma data vai como texto "2026-11-23" e vira DATE na chamada, sem fuso no caminho. */
export type Data = { data: string };
export type Valor = string | number | Data | null;
export type Procedure = "SGI5_IUD_VEN_PV1_V2" | "SGI5_IUD_VEN_PV2_V2";
export type Chamada = { procedure: Procedure; parametros: readonly (readonly [nome: string, valor: Valor])[] };

export type DadosDaGravacao = {
  pedido: PedidoRecebido;
  erp: PedidoNoErp;
  cadastro: CadastroDoPedido;
  produtos: ReadonlyMap<string, ProdutoDoPedido>;
  minimos: ReadonlyMap<string, PrecosMinimos>;
  enderecoDaTransportadora: EnderecoDaTransportadora | null;
  /** Hoje no relógio do Oracle, "2026-11-23". */
  hoje: string;
  /** O número do pedido no SGI. */
  numero: number;
};

/**
 * Os parâmetros do cabeçalho que o SGI6R passa, na ordem dele (ServerMethodsUnit1.dfm, spPve1). Os de
 * crédito (V_LIM_CRE, V_TIT_ABE, V_PED_ABE, V_VLR_PED, V_REC_VEN e V_JLB_CRE) nunca vão.
 */
export const PARAMETROS_DO_CABECALHO = [
  "V_OPE", "V_NPE", "V_DCA", "V_CLI", "V_CVE", "V_CFO", "V_CTR", "V_TMO", "V_ORI", "V_CPG", "V_TPM", "V_STA", "V_TXT", "V_OCO",
  "V_DEN", "V_DVE", "V_DVA", "V_TRA", "V_PFR", "V_BAS_IPI", "V_BAS_ICM", "V_PIC", "V_BCO", "V_CAR", "V_VEN", "V_TER", "V_PCV",
  "V_ORC", "V_LR1", "V_LR2", "V_NFA", "V_TFO", "V_DLB_CTR", "V_ULB_CTR", "V_DLB_VD1", "V_ULB_VD1", "V_DLB_CON", "V_ULB_CON",
  "V_DLB_CRE", "V_ULB_CRE", "V_DLB_VD2", "V_ULB_VD2", "V_DLB_BPV", "V_ULB_BPV", "V_JUS_BPV", "V_DCO", "V_OBS", "V_UCO", "V_USU",
  "V_JCA", "V_MOE", "V_CBO", "V_DCB", "V_TRA_END", "V_TRA_NUM", "V_TRA_COM", "V_TRA_BAI", "V_TRA_CID", "V_TRA_UFE", "V_TRA_CEP",
  "V_FPG", "V_TEN", "V_TEB", "V_SEN", "V_TRF",
] as const;

/** Os parâmetros do item, todos, na ordem do SGI6R (spPve2). */
export const PARAMETROS_DO_ITEM = [
  "V_OPE", "V_NPE", "V_ITE", "V_DEN", "V_CTR", "V_PIC", "V_PIP", "V_PAC", "V_PNU", "V_PNU_FOR", "V_UNI", "V_QTD", "V_VLR_TAB",
  "V_DES", "V_DES_IND", "V_VLR_LIQ", "V_VLR_VEN", "V_APV_DES", "V_DTA_DES", "V_JUS_DES", "V_PMV_MB", "V_PMV_ML", "V_LR1", "V_LR2",
  "V_OCO", "V_IOC", "V_NPP", "V_SPP", "V_JPP", "V_CCL", "V_FAB", "V_LEN", "V_DOC", "V_USU", "V_CLI",
] as const;

type NomeDoCabecalho = (typeof PARAMETROS_DO_CABECALHO)[number];
type NomeDoItem = (typeof PARAMETROS_DO_ITEM)[number];

const COTACAO = 1;
const EFETIVACAO = 13;
const DIAS_DE_VALIDADE = 10;
const PECAS_POR_CENTO = 100;
/** Os textos das listas da tela do SGI6R (untPedidos_Incluir.dfm). */
const CLASSIFICACAO_NO_SGI: Readonly<Record<string, string>> = {
  comercializacao: "COMERCIALIZACAO",
  industrializacao: "INDUSTRIALIZACAO",
  uso_consumo: "USO/CONSUMO",
};
/** Quem paga o frete, pela transportadora (SGI6R, qryPosTransp): a própria Suprens e o cliente que retira. */
const PAGAMENTO_DO_FRETE: Readonly<Record<string, string>> = { "616108610001": "P", "85819999": "S", "78499999": "S" };
const PAGAMENTO_DO_FRETE_PADRAO = "T";
/** Na venda para outro estado (CFOP 6...), o produto importado (procedência 1, 3 ou 8) paga 4% de ICMS. */
const PROCEDENCIAS_IMPORTADAS = new Set([1, 3, 8]);
const ICMS_DO_IMPORTADO = 4;

export function montarChamadas(dados: DadosDaGravacao): Chamada[] {
  const entrega = dados.pedido.entrega ?? primeiraEntregaPossivel(dataDoMomento(dados.pedido.enviadoEm));
  return [
    chamada("SGI5_IUD_VEN_PV1_V2", PARAMETROS_DO_CABECALHO, cabecalho(dados, entrega)),
    ...dados.pedido.itens.map((item, i) => chamada("SGI5_IUD_VEN_PV2_V2", PARAMETROS_DO_ITEM, itemDoPedido(dados, entrega, item, i + 1))),
    chamada("SGI5_IUD_VEN_PV1_V2", PARAMETROS_DO_CABECALHO, { V_OPE: EFETIVACAO, V_NPE: dados.numero }),
  ];
}

/** Todos os parâmetros da procedure, na ordem; o que não está em `valores` vai nulo, como no SGI6R. */
function chamada<Nome extends string>(procedure: Procedure, nomes: readonly Nome[], valores: Partial<Record<Nome, Valor>>): Chamada {
  return { procedure, parametros: nomes.map((nome) => [nome, valores[nome] ?? null] as const) };
}

function cabecalho({ pedido, erp, cadastro, enderecoDaTransportadora: endereco, hoje, numero }: DadosDaGravacao, entrega: string): Partial<Record<NomeDoCabecalho, Valor>> {
  const { escolhas } = pedido;
  return {
    V_OPE: COTACAO,
    V_NPE: numero,
    V_DCA: { data: hoje },
    V_CLI: erp.cliente,
    V_CVE: CLASSIFICACAO_NO_SGI[escolhas.classificacao] ?? null,
    V_CFO: cadastro.cfop,
    V_CTR: cadastro.tributacao,
    V_TMO: cadastro.tipoDeMovimento,
    V_ORI: "REPRESENTANTE",
    V_CPG: Number(escolhas.condicaoDePagamento),
    V_TPM: cadastro.tabela,
    V_STA: "COTACAO",
    V_TXT: cadastro.textoGenerico,
    V_OCO: textoOuNulo(escolhas.pedidoDoCliente),
    V_DEN: { data: entrega },
    // Com condição de pagamento, o vencimento vai nulo (ServerMethodsUnit1.pas, IUDMestre).
    V_DVA: { data: somarDias(hoje, DIAS_DE_VALIDADE) },
    V_TRA: Number(erp.transportadora),
    V_PFR: PAGAMENTO_DO_FRETE[erp.transportadora] ?? PAGAMENTO_DO_FRETE_PADRAO,
    V_BAS_IPI: cadastro.baseDoIpi,
    V_BAS_ICM: cadastro.baseDoIcms,
    V_PIC: cadastro.aliquotaDoIcms,
    V_BCO: cadastro.banco,
    V_CAR: cadastro.carteira,
    V_VEN: cadastro.vendedor,
    V_TER: cadastro.territorio,
    V_PCV: cadastro.comissao,
    // O "orçamentista": a matrícula do funcionário ou SGI6R. Outro texto derruba o Relatório de Cotações do SGI.
    V_ORC: "SGI6R",
    V_OBS: textoOuNulo(pedido.observacao),
    V_USU: Number(erp.vendedor),
    V_MOE: cadastro.moeda,
    V_TRA_END: endereco?.endereco ?? null,
    V_TRA_NUM: endereco?.numero ?? null,
    V_TRA_COM: endereco?.complemento ?? null,
    V_TRA_BAI: endereco?.bairro ?? null,
    V_TRA_CID: endereco?.cidade ?? null,
    V_TRA_UFE: endereco?.uf ?? null,
    V_TRA_CEP: endereco?.cep ?? null,
    V_FPG: cadastro.formaDePagamento,
    V_TEN: pedido.entrega === null ? "IMEDIATA" : "PROGRAMADA",
    V_TRF: escolhas.aceitaParcial ? "ACEITA FRETE PARCIAL" : "NAO ACEITA FRETE PARCIAL",
  };
}

function itemDoPedido(
  { pedido, erp, cadastro, produtos, minimos, numero }: DadosDaGravacao,
  entrega: string,
  item: PedidoRecebido["itens"][number],
  ordem: number,
): Partial<Record<NomeDoItem, Valor>> {
  const produto = produtos.get(item.codigo);
  if (!produto) throw new Error(`O produto ${item.codigo} não está na tabela do cliente.`);
  const icms = PROCEDENCIAS_IMPORTADAS.has(produto.procedencia) && String(cadastro.cfop).startsWith("6") ? ICMS_DO_IMPORTADO : cadastro.aliquotaDoIcms;
  const semPartNumber = produto.partNumber === "0" || produto.partNumber === "";
  const minimo = precoMinimo(minimos.get(item.codigo), produto.mercado, icms, cadastro.comissao);
  return {
    V_OPE: COTACAO,
    V_NPE: numero,
    V_ITE: ordem,
    V_DEN: { data: entrega },
    V_CTR: cadastro.tributacao,
    V_PIC: icms,
    V_PIP: cadastro.baseDoIpi === "SIM" ? produto.aliquotaDoIpi : 0,
    V_PAC: produto.produto,
    V_PNU: semPartNumber ? null : produto.partNumber,
    V_PNU_FOR: semPartNumber ? null : textoOuNulo(produto.partNumberDoFornecedor),
    V_UNI: "CT",
    V_QTD: item.quantidade / PECAS_POR_CENTO,
    V_VLR_TAB: produto.valorDeTabela,
    V_DES: textoOuNulo(produto.desconto),
    V_DES_IND: produto.indiceDoDesconto,
    V_VLR_LIQ: produto.valorLiquido,
    V_VLR_VEN: item.precoCento,
    V_PMV_MB: minimo.margemBruta,
    V_PMV_ML: minimo.margemLiquida,
    V_OCO: item.ordemDeCompra ?? textoOuNulo(pedido.escolhas.pedidoDoCliente),
    // Sem item da ordem de compra, o SGI6R manda 0, e o servidor dele o troca por nulo.
    V_IOC: item.itemDaOrdemDeCompra,
    V_USU: Number(erp.vendedor),
  };
}

/**
 * O preço mínimo por margem, como o SGI6R (untPedidos.pas, CalculaValorMinimoVenda): na exportação, a
 * faixa EXP; nos outros, a faixa do ICMS do item; a coluna "_COM" quando o vendedor tem comissão. O
 * ICMS fora das faixas, ou o produto sem preço mínimo no dia, fica 0.
 */
export function precoMinimo(precos: PrecosMinimos | undefined, mercado: string, icms: number, comissao: number): { margemBruta: number; margemLiquida: number } {
  const faixa = ["E", "EXP", "EXPORTACAO"].includes(mercado.toUpperCase()) ? "EXP" : ({ 0: "PRAIS", 4: "PRA4", 7: "PRA7", 12: "PRA12", 18: "PRA18" } as Record<number, string>)[icms];
  if (!precos || !faixa) return { margemBruta: 0, margemLiquida: 0 };
  const sufixo = comissao > 0 ? "_COM" : "";
  return { margemBruta: (precos[`${faixa}_MGB${sufixo}`] ?? 0) * 100, margemLiquida: (precos[`${faixa}_MGL${sufixo}`] ?? 0) * 100 };
}

/** O texto vazio vai nulo: no Oracle, '' já é NULL. */
function textoOuNulo(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === "" ? null : limpo;
}
