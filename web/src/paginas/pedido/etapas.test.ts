import { describe, expect, it } from "vitest";
import { etapaAnterior, etapaDoEndereco, etapaSeguinte } from "./etapas";

describe("etapas do pedido no celular", () => {
  it("começa pelo cliente quando o endereço não diz a etapa, ou diz uma que não existe", () => {
    expect(etapaDoEndereco(null)).toBe("cliente");
    expect(etapaDoEndereco("pagamento")).toBe("cliente");
    expect(etapaDoEndereco("itens")).toBe("itens");
  });

  it("anda na ordem em que o representante trabalha: cliente, condições (onde se decide o xPed), itens e revisão", () => {
    expect(etapaSeguinte("cliente")).toBe("condicoes");
    expect(etapaSeguinte("condicoes")).toBe("itens");
    expect(etapaSeguinte("itens")).toBe("revisar");
    expect(etapaAnterior("revisar")).toBe("itens");
  });

  it("não passa da revisão nem volta antes do cliente", () => {
    expect(etapaSeguinte("revisar")).toBeNull();
    expect(etapaAnterior("cliente")).toBeNull();
  });
});
