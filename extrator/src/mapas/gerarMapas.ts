import fs from "node:fs";
import path from "node:path";
import type { MapaDaUf } from "dominio/mapa";
import { lerMalha, lerMunicipios } from "./ibge.ts";
import { montarMapaDaUf, montarMapaDoBrasil } from "./montarMapa.ts";

/*
 * Gera os arquivos do mapa (web/public/mapas) a partir das bases públicas do IBGE, baixadas uma vez.
 * Uso: npm run mapas --workspace extrator -- <pasta do IBGE> <população do Censo 2022> <pasta de saída>
 *   - a pasta do IBGE tem municipios.json, de servicodados.ibge.gov.br/api/v1/localidades/municipios, e
 *     malhas/<código da UF>.json, de servicodados.ibge.gov.br/api/v3/malhas/estados/<código da UF>
 *     ?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio;
 *   - a população é a base do protótipo (CRM-prototipo/data/geo/ibge-populacao.json).
 * Roda de novo só quando o IBGE mudar a malha ou o Censo.
 */

const [pastaDoIbge, arquivoDePopulacao, pastaDeSaida] = process.argv.slice(2);
if (!pastaDoIbge || !arquivoDePopulacao || !pastaDeSaida) {
  console.error("Uso: npm run mapas --workspace extrator -- <pasta do IBGE> <população do Censo 2022> <pasta de saída>");
  process.exit(1);
}

const lerJson = (arquivo: string): unknown => JSON.parse(fs.readFileSync(arquivo, "utf8"));
const municipios = lerMunicipios(lerJson(path.join(pastaDoIbge, "municipios.json")));
const populacao = (lerJson(arquivoDePopulacao) as { byMun: Record<string, number> }).byMun;
const pastaDasMalhas = path.join(pastaDoIbge, "malhas");

fs.mkdirSync(pastaDeSaida, { recursive: true });
const mapas: MapaDaUf[] = [];
for (const arquivo of fs.readdirSync(pastaDasMalhas).filter((nome) => nome.endsWith(".json")).sort()) {
  const { mapa, semPopulacao } = montarMapaDaUf(lerMalha(lerJson(path.join(pastaDasMalhas, arquivo))), municipios, populacao);
  const destino = path.join(pastaDeSaida, `${mapa.uf}.json`);
  fs.writeFileSync(destino, JSON.stringify(mapa));
  const tamanho = Math.round(fs.statSync(destino).size / 1024);
  const aviso = semPopulacao.length > 0 ? `; sem população: ${semPopulacao.join(", ")}` : "";
  console.log(`${mapa.uf}: ${mapa.municipios.length} municípios, ${mapa.regioes.length} regiões, ${tamanho} KB${aviso}`);
  mapas.push(mapa);
}
fs.writeFileSync(path.join(pastaDeSaida, "brasil.json"), JSON.stringify(montarMapaDoBrasil(mapas)));
console.log(`brasil: ${mapas.length} estados`);
