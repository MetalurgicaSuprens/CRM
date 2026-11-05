import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import { contarLinhasPorTabela, nomeDoManifesto, type ManifestoDaFoto } from "dominio/manifestoDaFoto";
import { FotoRecusada, gravarFoto } from "./gravar.ts";

const COMPARANDO = { aceitarMudanca: false };

let pasta: string;

beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-extrator-"));
});

afterEach(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

/** Uma foto vazia, a não ser pelas vendas por mês, que passam do mínimo da comparação de volume. */
function fotoDe(geradaEm: string, vendasPorMes = 1_200): Foto {
  return {
    foto: {
      versao_esquema: VERSAO_DO_ESQUEMA,
      gerada_em: geradaEm,
      data_ref: geradaEm.slice(0, 10),
      mes_atual: geradaEm.slice(0, 7),
      dia_util: 3,
      dias_uteis: 20,
      semestre_inicio: "2026-05",
      semestre_fim: "2026-10",
    },
    representante: [{ codigo: "1401", nome: "STAR VENDAS" }],
    cliente: [],
    cliente_mes: Array.from({ length: vendasPorMes }, (_, i) => ({ cliente: `cliente-${i}`, mes: "2026-10", valor: 100 })),
    cliente_familia: [],
    produto: [],
    lista_de_precos: [],
    produto_part_number: [],
    produto_comprado: [],
    ficha_produto: [],
    cliente_mix: [],
    analise_parado: [],
    analise_ritmo: [],
    analise_novo: [],
    analise_mix: [],
    painel_mes: [],
    painel_historico: [],
    pedido_aberto: [],
    pedido_aberto_item: [],
    pedido_faturado: [],
    pedido_faturado_item: [],
    nota: [],
    nota_item: [],
  };
}

function lerManifesto(arquivoDaFoto: string): ManifestoDaFoto {
  return JSON.parse(fs.readFileSync(path.join(pasta, nomeDoManifesto(path.basename(arquivoDaFoto))), "utf8")) as ManifestoDaFoto;
}

describe("gravarFoto", () => {
  it("grava ao lado da foto o manifesto com o hash, o tamanho e as linhas de cada tabela", () => {
    const { arquivo } = gravarFoto(fotoDe("2026-11-05T08:30"), pasta, COMPARANDO);

    const conteudo = fs.readFileSync(arquivo);
    const db = new DatabaseSync(arquivo, { readOnly: true });
    const contagens = contarLinhasPorTabela(db);
    db.close();
    expect(lerManifesto(arquivo)).toEqual({
      versaoDoEsquema: VERSAO_DO_ESQUEMA,
      geradaEm: "2026-11-05T08:30",
      tamanho: conteudo.length,
      sha256: crypto.createHash("sha256").update(conteudo).digest("hex"),
      contagens,
    });
    expect(contagens).toMatchObject({ foto: 1, representante: 1, cliente_mes: 1_200 });
  });

  it("diz que a primeira foto da pasta não teve com o que comparar", () => {
    expect(gravarFoto(fotoDe("2026-11-05T08:30"), pasta, COMPARANDO).semComparar).toBe("é a primeira foto da pasta");
  });

  it("grava a foto que mudou pouco desde a anterior", () => {
    gravarFoto(fotoDe("2026-11-05T08:30"), pasta, COMPARANDO);

    expect(gravarFoto(fotoDe("2026-11-05T09:00", 1_210), pasta, COMPARANDO).semComparar).toBeNull();
  });

  it("recusa a foto que encolheu demais e deixa a pasta como estava", () => {
    const { arquivo } = gravarFoto(fotoDe("2026-11-05T08:30"), pasta, COMPARANDO);

    expect(() => gravarFoto(fotoDe("2026-11-05T09:00", 400), pasta, COMPARANDO)).toThrow(FotoRecusada);
    expect(fs.readdirSync(pasta).sort()).toEqual([path.basename(arquivo), nomeDoManifesto(path.basename(arquivo))].sort());
  });

  it("explica a recusa com a tabela, as linhas e como gravar assim mesmo", () => {
    gravarFoto(fotoDe("2026-11-05T08:30"), pasta, COMPARANDO);

    expect(() => gravarFoto(fotoDe("2026-11-05T09:00", 400), pasta, COMPARANDO)).toThrow(/cliente_mes: de 1\.200 para 400 linhas \(−67%\)[\s\S]*--aceitar-mudanca/);
  });

  it("com --aceitar-mudanca, grava a foto que mudou demais", () => {
    gravarFoto(fotoDe("2026-11-05T08:30"), pasta, COMPARANDO);

    const gravada = gravarFoto(fotoDe("2026-11-05T09:00", 400), pasta, { aceitarMudanca: true });
    expect(gravada.semComparar).toBe("pedido com --aceitar-mudanca");
    expect(lerManifesto(gravada.arquivo).contagens.cliente_mes).toBe(400);
  });

  it("fica com as 3 fotos mais novas, cada uma com o seu manifesto", () => {
    const arquivos = ["08:30", "09:00", "09:30", "10:00"].map((hora) => gravarFoto(fotoDe(`2026-11-05T${hora}`), pasta, COMPARANDO).arquivo);

    const esperados = arquivos.slice(1).flatMap((arquivo) => [path.basename(arquivo), nomeDoManifesto(path.basename(arquivo))]);
    expect(fs.readdirSync(pasta).sort()).toEqual(esperados.sort());
  });
});
