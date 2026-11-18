import { describe, expect, it } from "vitest";
import { apontarTabelasRestritas } from "./oracle.ts";

describe("apontarTabelasRestritas", () => {
  it("le_as_quatro_tabelas_restritas_pelo_esquema_das_views", () => {
    const sql = "SELECT 1 FROM ABC71.CRCL C JOIN ABC71.NFME N ON 1=1 JOIN ABC71.VEPM P ON 1=1 JOIN ABC71.CFOR F ON 1=1";
    expect(apontarTabelasRestritas(sql, "CRM_DADOS")).toBe(
      "SELECT 1 FROM CRM_DADOS.CRCL C JOIN CRM_DADOS.NFME N ON 1=1 JOIN CRM_DADOS.VEPM P ON 1=1 JOIN CRM_DADOS.CFOR F ON 1=1",
    );
  });

  it("mantem_no_ABC71_as_tabelas_liberadas_direto", () => {
    const sql = "SELECT 1 FROM ABC71.NFDE D, ABC71.VEPD V, ABC71.SGI5_TAB_VEN_CLI3 S";
    expect(apontarTabelasRestritas(sql, "CRM_DADOS")).toBe(sql);
  });

  it("nao_confunde_tabela_de_nome_parecido", () => {
    expect(apontarTabelasRestritas("FROM ABC71.CRCLX X, ABC71.CRCLH H", "CRM_DADOS")).toBe("FROM ABC71.CRCLX X, ABC71.CRCLH H");
  });

  it("deixa_o_sql_igual_com_o_esquema_do_erp", () => {
    const sql = "SELECT 1 FROM ABC71.CRCL C";
    expect(apontarTabelasRestritas(sql, "ABC71")).toBe(sql);
  });
});
