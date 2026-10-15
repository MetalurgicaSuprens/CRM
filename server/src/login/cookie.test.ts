import { describe, expect, it } from "vitest";
import { lerTokenDoCookie } from "./cookie.ts";

const TOKEN = "a".repeat(43);

describe("lerTokenDoCookie", () => {
  it("acha o token do CRM entre outros cookies", () => {
    expect(lerTokenDoCookie(`tema=escuro; __Host-crm=${TOKEN}; outro=1`)).toBe(TOKEN);
  });

  it("ignora o cookie fora do formato do token e o de nome parecido", () => {
    expect(lerTokenDoCookie("__Host-crm=curto")).toBeNull();
    expect(lerTokenDoCookie(`crm=${TOKEN}`)).toBeNull();
    expect(lerTokenDoCookie(undefined)).toBeNull();
  });
});
