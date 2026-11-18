import { describe, expect, it } from "vitest";
import { lerEsquemaDasTabelasRestritas } from "./configuracao.ts";

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
