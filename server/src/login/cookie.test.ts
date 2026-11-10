import { describe, expect, it } from "vitest";
import { cookieApagado, cookieDaSessao, lerTokenDoCookie } from "./cookie.ts";

const TOKEN = "a".repeat(43);
const OUTRO = "b".repeat(43);

describe("cookieDaSessao", () => {
  it("põe Secure no cookie dos portais, que usam o prefixo __Host-", () => {
    expect(cookieDaSessao("__Host-crm", TOKEN)).toMatch(/; Secure/);
    expect(cookieApagado("__Host-crm")).toMatch(/; Secure/);
  });

  it("deixa sem Secure só o cookie sem o prefixo, o da rede interna por http", () => {
    expect(cookieDaSessao("crm-rede-interna", TOKEN)).not.toMatch(/Secure/);
  });
});

describe("lerTokenDoCookie", () => {
  it("acha o token do portal entre outros cookies", () => {
    expect(lerTokenDoCookie("__Host-crm", `tema=escuro; __Host-crm=${TOKEN}; outro=1`)).toBe(TOKEN);
  });

  it("separa o cookie do CRM do da administração, que convivem no mesmo endereço neste computador", () => {
    const cabecalho = `__Host-crm=${TOKEN}; __Host-crm-admin=${OUTRO}`;
    expect(lerTokenDoCookie("__Host-crm", cabecalho)).toBe(TOKEN);
    expect(lerTokenDoCookie("__Host-crm-admin", cabecalho)).toBe(OUTRO);
  });

  it("ignora o cookie fora do formato do token e o de nome parecido", () => {
    expect(lerTokenDoCookie("__Host-crm", "__Host-crm=curto")).toBeNull();
    expect(lerTokenDoCookie("__Host-crm", `crm=${TOKEN}`)).toBeNull();
    expect(lerTokenDoCookie("__Host-crm", undefined)).toBeNull();
  });
});
