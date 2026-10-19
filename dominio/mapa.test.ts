import { describe, expect, it } from "vitest";
import { DETALHE_DA_CIDADE, distanciaEmKm, latitudeDoY, projetar, projetarNaCidade, unidadesDoMapa } from "./mapa.ts";

const GOIANIA = projetar(-49.25, -16.68);
const BRASILIA = projetar(-47.88, -15.79);

describe("projetar", () => {
  it("põe o cruzamento do equador com Greenwich na origem", () => {
    expect(projetar(0, 0)).toEqual([0, 0]);
  });

  it("mede em décimos de km: um grau no equador são uns 111 km", () => {
    expect(projetar(1, 0)[0]).toBe(1112);
  });

  it("faz o y crescer para o sul, como no SVG", () => {
    expect(GOIANIA[1]).toBeGreaterThan(BRASILIA[1]);
  });
});

describe("projetarNaCidade", () => {
  it("cai no mesmo lugar do estado, 20 vezes mais fino: unidades de 5 m", () => {
    const [x, y] = projetarNaCidade(-49.25, -16.68);
    expect(Math.abs(x / DETALHE_DA_CIDADE - (GOIANIA[0] ?? 0))).toBeLessThan(1);
    expect(Math.abs(y / DETALHE_DA_CIDADE - (GOIANIA[1] ?? 0))).toBeLessThan(1);
    expect(projetarNaCidade(1, 0)[0]).toBe(22239);
  });
});

describe("latitudeDoY", () => {
  it("desfaz a projeção: volta à latitude do ponto", () => {
    expect(latitudeDoY(GOIANIA[1])).toBeCloseTo(-16.68, 3);
  });
});

describe("distanciaEmKm", () => {
  it("mede em linha reta: de Goiânia a Brasília são uns 177 km", () => {
    expect(distanciaEmKm(GOIANIA, BRASILIA)).toBeGreaterThan(175);
    expect(distanciaEmKm(GOIANIA, BRASILIA)).toBeLessThan(178);
  });
});

describe("unidadesDoMapa", () => {
  it("é o caminho de volta da distância: o raio em unidades do mapa mede os mesmos km", () => {
    const raio = unidadesDoMapa(100, GOIANIA[1]);
    expect(distanciaEmKm(GOIANIA, [GOIANIA[0] + raio, GOIANIA[1]])).toBeCloseTo(100, 0);
  });
});
