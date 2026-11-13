import { describe, expect, it } from "vitest";
import { arquivosProibidos, motivoParaFicarFora } from "./conteudoDoPacote.ts";

describe("motivoParaFicarFora", () => {
  it.each(["server/.env", ".env", ".env.producao", "server/.ENV"])("recusa_o_arquivo_de_ambiente %s", (caminho) => {
    expect(motivoParaFicarFora(caminho)).toBe("segredo (.env)");
  });

  it("aceita_o_exemplo_do_arquivo_de_ambiente", () => {
    expect(motivoParaFicarFora("server/.env.example")).toBeNull();
  });

  it.each(["certificado.pem", "server/tls.key", "a/b/id_ed25519", "id_rsa.pub", "cliente.pfx"])("recusa_chave_e_certificado %s", (caminho) => {
    expect(motivoParaFicarFora(caminho)).toBe("chave ou certificado");
  });

  it.each(["app.db", "app.db-wal", "foto-20261113-0800.db", "server/x.sqlite", "entrada/foto.db.part"])("recusa_banco_de_dados %s", (caminho) => {
    expect(motivoParaFicarFora(caminho)).toBe("banco de dados");
  });

  it.each(["data/representantes-autorizados.txt", "extrator/src/erp/oracle.ts"])("recusa_o_que_fica_na_rede_interna %s", (caminho) => {
    expect(motivoParaFicarFora(caminho)).toBe("só fica na rede interna");
  });

  it("recusa_o_driver_do_oracle_em_qualquer_node_modules", () => {
    expect(motivoParaFicarFora("node_modules/oracledb/index.js")).toBe("driver do Oracle");
  });

  it.each(["server/src/principal.ts", "site/assets/index-abc.js", "node_modules/fastify/fastify.js", "dominio/datas.ts"])("aceita_o_codigo_e_o_site %s", (caminho) => {
    expect(motivoParaFicarFora(caminho)).toBeNull();
  });

  it("entende_a_barra_do_windows", () => {
    expect(motivoParaFicarFora("data\\app.db")).toBe("banco de dados");
  });
});

describe("arquivosProibidos", () => {
  it("lista_so_os_proibidos_com_o_motivo", () => {
    expect(arquivosProibidos(["server/src/app.ts", "server/.env", "app.db"])).toEqual(["server/.env: segredo (.env)", "app.db: banco de dados"]);
  });
});
