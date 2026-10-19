import fs from "node:fs";
import path from "node:path";
import type { MapaDaUf } from "dominio/mapa";
import { lerMalha, lerMunicipios } from "./ibge.ts";
import { montarMapaDaUf, montarMapaDoBrasil } from "./montarMapa.ts";

/*
 * Gera os arquivos do mapa (web/public/mapas) a partir das bases públicas do IBGE, baixadas uma vez.
 * Uso: npm run mapas --workspace extrator -- <pasta do IBGE> <população do Censo 2022> <PIB agro + indústria> <pasta de saída>
 *   - a pasta do IBGE tem municipios.json, de servicodados.ibge.gov.br/api/v1/localidades/municipios, e
 *     malhas/<código da UF>.json, de servicodados.ibge.gov.br/api/v3/malhas/estados/<código da UF>
 *     ?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio;
 *   - a população é a base do protótipo (CRM-prototipo/data/geo/ibge-populacao.json);
 *   - o PIB agro + indústria é {"byMun": {código do IBGE: R$}}, tirado de
 *     ftp.ibge.gov.br/Pib_Municipios/2022_2023/base/base_de_dados_2010_2023_xlsx.zip (de 12/2025): a
 *     soma das colunas "Valor adicionado bruto da Agropecuária" e "da Indústria" do ano de 2021, que
 *     vêm em R$ 1.000. 2021 é o último ano com os setores: em 2022 e 2023, a base traz só o PIB total.
 *     Onde a "Atividade com maior valor adicionado bruto" é "Eletricidade e gás..." ou "Indústrias
 *     extrativas", a indústria fica de fora e conta só a agropecuária: usina e extração (Itaipu,
 *     petróleo, minério) não compram o que a Suprens vende. São 210 municípios em 2021.
 * Roda de novo só quando o IBGE mudar a malha, o Censo ou o PIB dos Municípios.
 */

const [pastaDoIbge, arquivoDePopulacao, arquivoDoMercado, pastaDeSaida] = process.argv.slice(2);
if (!pastaDoIbge || !arquivoDePopulacao || !arquivoDoMercado || !pastaDeSaida) {
  console.error("Uso: npm run mapas --workspace extrator -- <pasta do IBGE> <população do Censo 2022> <PIB agro + indústria> <pasta de saída>");
  process.exit(1);
}

const lerJson = (arquivo: string): unknown => JSON.parse(fs.readFileSync(arquivo, "utf8"));
const municipios = lerMunicipios(lerJson(path.join(pastaDoIbge, "municipios.json")));
const populacao = (lerJson(arquivoDePopulacao) as { byMun: Record<string, number> }).byMun;
const mercado = (lerJson(arquivoDoMercado) as { byMun: Record<string, number> }).byMun;
const pastaDasMalhas = path.join(pastaDoIbge, "malhas");

fs.mkdirSync(pastaDeSaida, { recursive: true });
const mapas: MapaDaUf[] = [];
for (const arquivo of fs.readdirSync(pastaDasMalhas).filter((nome) => nome.endsWith(".json")).sort()) {
  const { mapa, semPopulacao, semMercado } = montarMapaDaUf(lerMalha(lerJson(path.join(pastaDasMalhas, arquivo))), municipios, { populacao, mercado });
  const destino = path.join(pastaDeSaida, `${mapa.uf}.json`);
  fs.writeFileSync(destino, JSON.stringify(mapa));
  const tamanho = Math.round(fs.statSync(destino).size / 1024);
  const avisos = [
    semPopulacao.length > 0 ? `sem população: ${semPopulacao.join(", ")}` : null,
    semMercado.length > 0 ? `sem PIB: ${semMercado.join(", ")}` : null,
  ].filter((aviso) => aviso !== null);
  console.log(`${mapa.uf}: ${mapa.municipios.length} municípios, ${mapa.regioes.length} regiões, ${tamanho} KB${avisos.length > 0 ? `; ${avisos.join("; ")}` : ""}`);
  mapas.push(mapa);
}
fs.writeFileSync(path.join(pastaDeSaida, "brasil.json"), JSON.stringify(montarMapaDoBrasil(mapas)));
console.log(`brasil: ${mapas.length} estados`);
