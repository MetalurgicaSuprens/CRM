import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fotoDoProduto } from "./fotoDaFamilia";

describe("fotoDoProduto", () => {
  it("escolhe a foto pela família do produto", () => {
    expect(fotoDoProduto("FAB1319P", "FLEXIL")).toBe("/familias/flexil.png");
    expect(fotoDoProduto("ZIP0300", "ABRAC. ZIP")).toBe("/familias/zip.png");
  });

  it("dá às borboletas, que o cadastro guarda dentro de Flexil, Micro e Presil, a foto delas pelo começo do código", () => {
    expect(fotoDoProduto("FAN1622", "FLEXIL")).toBe("/familias/flexil-borboleta.png");
    expect(fotoDoProduto("pan2032", "PRESIL")).toBe("/familias/presil-borboleta.png");
  });

  it("não dá foto à família que não tem", () => {
    expect(fotoDoProduto("FIT0012", "FITA PERFURADA")).toBeNull();
    expect(fotoDoProduto("ALI0001", "ALICATE")).toBeNull();
  });

  it("aponta só para fotos que existem na pasta pública", () => {
    const familias = ["FLEXIL", "KIT FLEXIL", "FLEXIL SUPER", "MICRO", "CRON 9MM", "CRON 12MM", "CRON 9/12MM COM MOLA", "PRESIL", "TUCHO", "TIGRE(MT)", "STEPLESS (G)", "RADIAL", "BORRACHA", "BORRACHA DIN3016-1", "MANGOTE(MS)", "SIMPLEX", "U", "ABRAC. ZIP", "MOLA", "ESTAMPADOS"];
    const fotos = [...familias.map((familia) => fotoDoProduto("X", familia)), fotoDoProduto("FAN", ""), fotoDoProduto("MAN", ""), fotoDoProduto("PAN", "")];
    for (const foto of fotos) expect(fs.existsSync(path.join(import.meta.dirname, "../../public", foto ?? "nenhuma"))).toBe(true);
  });
});
