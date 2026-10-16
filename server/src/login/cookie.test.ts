import { describe, expect, it } from "vitest";
import { lerTokenDoCookie } from "./cookie.ts";

const TOKEN = "a".repeat(43);
const OUTRO = "b".repeat(43);

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
