import { describe, expect, it } from "vitest";
import { lerEsquemaDasTabelasRestritas, lerGravacaoNoSgi } from "./configuracao.ts";

describe("lerEsquemaDasTabelasRestritas", () => {
  it("usa_o_ABC71_quando_vazio", () => {
    expect(lerEsquemaDasTabelasRestritas(undefined)).toBe("ABC71");
    expect(lerEsquemaDasTabelasRestritas("")).toBe("ABC71");
  });

  it("aceita_o_esquema_das_views_em_qualquer_caixa", () => {
    expect(lerEsquemaDasTabelasRestritas("crm_dados")).toBe("CRM_DADOS");
  });

  it.each(["CRM DADOS", "CRM_DADOS.CRCL", "CRM_DADOS; DROP", '"CRM_DADOS"', "1CRM"])("recusa_o_que_nao_e_nome_de_esquema %s", (valor) => {
    expect(() => lerEsquemaDasTabelasRestritas(valor)).toThrow(/ORACLE_ESQUEMA_DAS_VIEWS/);
  });
});

describe("lerGravacaoNoSgi", () => {
  it("só grava no SGI com ligado, escrito assim", () => {
    expect(lerGravacaoNoSgi("ligado")).toBe(true);
    expect(lerGravacaoNoSgi(undefined)).toBe(false);
    expect(lerGravacaoNoSgi("")).toBe(false);
    expect(lerGravacaoNoSgi("desligado")).toBe(false);
  });

  it("recusa outro valor, em vez de adivinhar", () => {
    expect(() => lerGravacaoNoSgi("sim")).toThrow(/CRM_GRAVAR_NO_SGI/);
  });
});
