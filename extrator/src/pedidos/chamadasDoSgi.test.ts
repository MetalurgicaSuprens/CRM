import { describe, expect, it } from "vitest";
import type { CadastroDoPedido, ProdutoDoPedido } from "../erp/dadosDaGravacao.ts";
import { PARAMETROS_DO_CABECALHO, PARAMETROS_DO_ITEM, montarChamadas, precoMinimo, type Chamada, type DadosDaGravacao, type Valor } from "./chamadasDoSgi.ts";
import { blocoDaChamada } from "./gravacao.ts";
import { pedidoDeTeste } from "./pedidoDeTeste.ts";

const CADASTRO: CadastroDoPedido = {
  cfop: 5101,
  tributacao: 1,
  tipoDeMovimento: 310,
  tabela: "PDR02",
  moeda: "REAL",
  baseDoIpi: "SIM",
  baseDoIcms: "SIM",
  aliquotaDoIcms: 18,
  vendedor: 1401,
  comissao: 5,
  territorio: 3,
  banco: 341,
  carteira: 1,
  textoGenerico: 7,
  formaDePagamento: 2,
};

const PRODUTO: ProdutoDoPedido = {
  produto: "F-100",
  partNumber: "CF420118",
  partNumberDoFornecedor: "PNF-1",
  procedencia: 0,
  aliquotaDoIpi: 5,
  desconto: "10+5",
  indiceDoDesconto: 0.855,
  valorDeTabela: 111.7,
  valorLiquido: 95.5,
  mercado: "PRACA",
};

const MINIMOS = { PRA18_MGB_COM: 0.9, PRA18_MGL_COM: 0.8, PRA18_MGB: 0.7, PRA4_MGB_COM: 0.6, PRA4_MGL_COM: 0.5 };

function dados(parcial: Partial<DadosDaGravacao> = {}): DadosDaGravacao {
  return {
    pedido: pedidoDeTeste(),
    erp: { empresa: 1, cliente: 123456, vendedor: "1401", tabela: "PDR02", condicaoDePagamento: "1030", transportadora: "101" },
    cadastro: CADASTRO,
    produtos: new Map([["F-100", PRODUTO]]),
    minimos: new Map([["F-100", MINIMOS]]),
    enderecoDaTransportadora: null,
    hoje: "2026-11-23",
    numero: 1001,
    ...parcial,
  };
}

function valores(chamada: Chamada | undefined): Record<string, Valor> {
  if (!chamada) throw new Error("faltou a chamada");
  return Object.fromEntries(chamada.parametros);
}

describe("montarChamadas", () => {
  it("grava a cotação, os itens e a efetivação, nessa ordem, como o SGI6R", () => {
    const chamadas = montarChamadas(dados());
    expect(chamadas.map(({ procedure, parametros }) => [procedure, parametros[0]?.[1]])).toEqual([
      ["SGI5_IUD_VEN_PV1_V2", 1],
      ["SGI5_IUD_VEN_PV2_V2", 1],
      ["SGI5_IUD_VEN_PV1_V2", 13],
    ]);
  });

  it("monta o cabeçalho com os valores do SGI6R e sem nenhum dado de crédito", () => {
    const cabecalho = montarChamadas(dados())[0];
    expect(cabecalho?.parametros.map(([nome]) => nome)).toEqual(PARAMETROS_DO_CABECALHO);
    expect(PARAMETROS_DO_CABECALHO).not.toContain("V_LIM_CRE");
    expect(valores(cabecalho)).toMatchObject({
      V_NPE: 1001,
      V_DCA: { data: "2026-11-23" },
      V_CLI: 123456,
      V_CVE: "INDUSTRIALIZACAO",
      V_CFO: 5101,
      V_CTR: 1,
      V_TMO: 310,
      V_ORI: "REPRESENTANTE",
      V_CPG: 1030,
      V_TPM: "PDR02",
      V_STA: "COTACAO",
      V_TXT: 7,
      V_OCO: "OC 4512",
      V_DVE: null,
      V_DVA: { data: "2026-12-03" },
      V_TRA: 101,
      V_PFR: "T",
      V_BAS_IPI: "SIM",
      V_PIC: 18,
      V_BCO: 341,
      V_CAR: 1,
      V_VEN: 1401,
      V_TER: 3,
      V_PCV: 5,
      V_ORC: "SGI6R",
      V_LR1: null,
      V_LR2: null,
      V_USU: 1401,
      V_MOE: "REAL",
      V_CBO: null,
      V_FPG: 2,
      V_TRF: "ACEITA FRETE PARCIAL",
    });
  });

  it("deixa as liberações vazias: o pedido nasce sem aprovação", () => {
    const cabecalho = valores(montarChamadas(dados())[0]);
    for (const nome of PARAMETROS_DO_CABECALHO.filter((parametro) => /^V_(DLB|ULB)_|^V_(JUS_BPV|DCO|UCO)$/.test(parametro))) expect(cabecalho[nome], nome).toBeNull();
  });

  it("sem data pedida, entrega na primeira data possível como IMEDIATA; com data, PROGRAMADA", () => {
    // Enviado em 2026-11-18: com o feriado de 20/11, a primeira entrega é 2026-11-26.
    expect(valores(montarChamadas(dados())[0])).toMatchObject({ V_DEN: { data: "2026-11-26" }, V_TEN: "IMEDIATA" });
    const programado = dados({ pedido: pedidoDeTeste({ entrega: "2026-12-10" }) });
    expect(valores(montarChamadas(programado)[0])).toMatchObject({ V_DEN: { data: "2026-12-10" }, V_TEN: "PROGRAMADA" });
  });

  it.each([
    ["616108610001", "P"],
    ["85819999", "S"],
    ["78499999", "S"],
    ["101", "T"],
  ])("o frete da transportadora %s é %s, como no SGI6R", (transportadora, frete) => {
    const comTransportadora = dados({ erp: { ...dados().erp, transportadora } });
    expect(valores(montarChamadas(comTransportadora)[0]).V_PFR).toBe(frete);
  });

  it("monta o item em centos, com o preço do pedido e os valores da view de preço", () => {
    const item = montarChamadas(dados())[1];
    expect(item?.parametros.map(([nome]) => nome)).toEqual(PARAMETROS_DO_ITEM);
    expect(valores(item)).toMatchObject({
      V_NPE: 1001,
      V_ITE: 1,
      V_DEN: { data: "2026-11-26" },
      V_CTR: 1,
      V_PIC: 18,
      V_PIP: 5,
      V_PAC: "F-100",
      V_PNU: "CF420118",
      V_PNU_FOR: "PNF-1",
      V_UNI: "CT",
      V_QTD: 3,
      V_VLR_TAB: 111.7,
      V_DES: "10+5",
      V_DES_IND: 0.855,
      V_VLR_LIQ: 95.5,
      V_VLR_VEN: 98.4,
      V_APV_DES: null,
      V_PMV_MB: 90,
      V_PMV_ML: 80,
      V_OCO: "OC 4512",
      V_IOC: null,
      V_USU: 1401,
      V_CLI: null,
    });
  });

  it("põe a ordem de compra e o item dela no item, para o xPed", () => {
    const pedido = pedidoDeTeste({ itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: "151220/ES", itemDaOrdemDeCompra: 3 }] });
    expect(valores(montarChamadas(dados({ pedido }))[1])).toMatchObject({ V_OCO: "151220/ES", V_IOC: 3 });
  });

  it("usa 4% de ICMS no produto importado vendido para outro estado", () => {
    const interestadual = dados({ cadastro: { ...CADASTRO, cfop: 6101 }, produtos: new Map([["F-100", { ...PRODUTO, procedencia: 1 }]]) });
    expect(valores(montarChamadas(interestadual)[1])).toMatchObject({ V_PIC: 4, V_PMV_MB: 60, V_PMV_ML: 50 });
    const nacional = dados({ cadastro: { ...CADASTRO, cfop: 6101 } });
    expect(valores(montarChamadas(nacional)[1]).V_PIC).toBe(18);
  });

  it("não cobra IPI do cliente fora da base e deixa sem o part number '0'", () => {
    const semIpi = dados({ cadastro: { ...CADASTRO, baseDoIpi: "NAO" }, produtos: new Map([["F-100", { ...PRODUTO, partNumber: "0" }]]) });
    expect(valores(montarChamadas(semIpi)[1])).toMatchObject({ V_PIP: 0, V_PNU: null, V_PNU_FOR: null });
  });

  it("efetiva só com a operação e o número, o resto nulo", () => {
    const efetivacao = valores(montarChamadas(dados())[2]);
    expect(Object.entries(efetivacao).filter(([, valor]) => valor !== null)).toEqual([
      ["V_OPE", 13],
      ["V_NPE", 1001],
    ]);
  });
});

describe("precoMinimo", () => {
  it("usa a faixa de exportação no mercado de exportação", () => {
    expect(precoMinimo({ EXP_MGB: 0.3, EXP_MGL: 0.2 }, "EXPORTACAO", 0, 0)).toEqual({ margemBruta: 30, margemLiquida: 20 });
  });

  it("usa a coluna sem comissão quando o vendedor não tem comissão", () => {
    expect(precoMinimo(MINIMOS, "PRACA", 18, 0).margemBruta).toBe(70);
  });

  it("fica 0 sem preço mínimo do dia ou com ICMS fora das faixas", () => {
    expect(precoMinimo(undefined, "PRACA", 18, 5)).toEqual({ margemBruta: 0, margemLiquida: 0 });
    expect(precoMinimo(MINIMOS, "PRACA", 17, 5)).toEqual({ margemBruta: 0, margemLiquida: 0 });
  });
});

describe("blocoDaChamada", () => {
  it("chama a procedure pelos nomes dos parâmetros, com a data convertida no Oracle", () => {
    const { plsql, binds } = blocoDaChamada({ procedure: "SGI5_IUD_VEN_PV1_V2", parametros: [["V_OPE", 1], ["V_DCA", { data: "2026-11-23" }], ["V_DVE", null]] });
    expect(plsql).toBe("BEGIN ABC71.SGI5_IUD_VEN_PV1_V2(V_OPE => :V_OPE, V_DCA => TO_DATE(:V_DCA, 'YYYY-MM-DD'), V_DVE => :V_DVE); END;");
    expect(binds).toEqual({ V_OPE: 1, V_DCA: "2026-11-23", V_DVE: null });
  });
});
