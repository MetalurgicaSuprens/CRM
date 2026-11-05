import { describe, expect, it } from "vitest";
import { nomeDaFotoDoManifesto, nomeDoManifesto } from "./manifestoDaFoto.ts";

describe("nome do manifesto", () => {
  it("vai da foto ao manifesto e volta", () => {
    const foto = "foto-20261105-0830-1793878488099.db";
    expect(nomeDoManifesto(foto)).toBe("foto-20261105-0830-1793878488099.manifesto.json");
    expect(nomeDaFotoDoManifesto(nomeDoManifesto(foto))).toBe(foto);
  });

  it("não reconhece o que não é manifesto de foto, nem o caminho para outra pasta", () => {
    for (const nome of ["../foto-1.manifesto.json", "foto-1.manifesto.json.part", "estoque-1.manifesto.json", "foto-1.db", "foto-x.manifesto.json"]) {
      expect(nomeDaFotoDoManifesto(nome)).toBeNull();
    }
  });
});
