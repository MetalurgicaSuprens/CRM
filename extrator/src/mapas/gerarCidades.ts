import fs from "node:fs";
import path from "node:path";
import { projetarNaCidade } from "dominio/mapa";
import { lerArquivoDoZip } from "../zip.ts";
import { lerMalha, projetarAneis } from "./ibge.ts";
import { montarMapaDaCidade, type AreaParaDesenhar } from "./montarCidade.ts";
import { lerPoligonosDoShp, lerRegistrosDoDbf } from "./shapefile.ts";

/*
 * Gera o desenho de cada cidade com cliente (web/public/mapas/cidades), para o mapa aproximar dela, a
 * partir das bases públicas do IBGE, baixadas uma vez.
 * Uso: npm run cidades --workspace extrator -- <pasta dos contornos> <zip dos bairros> <pasta dos distritos> <pasta de saída>
 *   - a pasta dos contornos tem <código>.json de cada cidade com cliente, de servicodados.ibge.gov.br/
 *     api/v3/malhas/municipios/<código>?formato=application/vnd.geo%2Bjson&qualidade=intermediaria;
 *   - as malhas do Censo 2022 vêm de geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/
 *     malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022: o zip dos bairros é
 *     bairros/shp/BR/BR_bairros_CD2022.zip, e a pasta dos distritos tem os zips de distritos/shp/UF
 *     (<UF>_distritos_CD2022.zip).
 * Gera uma cidade por arquivo da pasta dos contornos. Roda de novo quando entrar cliente em cidade nova.
 */

const [pastaDosContornos, zipDosBairros, pastaDosDistritos, pastaDeSaida] = process.argv.slice(2);
if (!pastaDosContornos || !zipDosBairros || !pastaDosDistritos || !pastaDeSaida) {
  console.error("Uso: npm run cidades --workspace extrator -- <pasta dos contornos> <zip dos bairros> <pasta dos distritos> <pasta de saída>");
  process.exit(1);
}

const lerJson = (arquivo: string): unknown => JSON.parse(fs.readFileSync(arquivo, "utf8"));
const codigos = fs
  .readdirSync(pastaDosContornos)
  .filter((nome) => /^\d{7}\.json$/.test(nome))
  .map((nome) => nome.slice(0, 7))
  .sort();
const cidades = new Set(codigos);
const bairros = lerAreasDoShapefile(zipDosBairros, cidades, "NM_BAIRRO");
const distritos = mesclar(
  fs
    .readdirSync(pastaDosDistritos)
    .filter((nome) => nome.toLowerCase().endsWith(".zip"))
    .map((nome) => lerAreasDoShapefile(path.join(pastaDosDistritos, nome), cidades, "NM_DIST")),
);

fs.mkdirSync(pastaDeSaida, { recursive: true });
const contagem = { bairro: 0, distrito: 0, contorno: 0 };
let total = 0;
for (const codigo of codigos) {
  const contorno = lerMalha(lerJson(path.join(pastaDosContornos, `${codigo}.json`)), projetarNaCidade).flatMap(({ aneis }) => aneis);
  const cidade = montarMapaDaCidade(codigo, contorno, { bairros: bairros.get(codigo) ?? [], distritos: distritos.get(codigo) ?? [] });
  const destino = path.join(pastaDeSaida, `${codigo}.json`);
  fs.writeFileSync(destino, JSON.stringify(cidade));
  total += fs.statSync(destino).size;
  contagem[cidade.divisoes?.tipo ?? "contorno"] += 1;
}
console.log(
  `${codigos.length} cidades: ${contagem.bairro} com bairros, ${contagem.distrito} com distritos e ${contagem.contorno} só com o contorno; ${Math.round(total / 1024)} KB.`,
);

/** As áreas (bairros ou distritos) das cidades pedidas, pelo código do município, com o nome do campo dado. */
function lerAreasDoShapefile<Campo extends string>(zip: string, doMapa: ReadonlySet<string>, campoDoNome: Campo): Map<string, AreaParaDesenhar[]> {
  const poligonos = lerPoligonosDoShp(lerArquivoDoZip(zip, ".shp"));
  const registros = lerRegistrosDoDbf<"CD_MUN" | Campo>(lerArquivoDoZip(zip, ".dbf"), ["CD_MUN", campoDoNome]);
  if (poligonos.length !== registros.length) throw new Error(`${zip}: o .shp tem ${poligonos.length} polígonos e o .dbf, ${registros.length} registros.`);
  const porCidade = new Map<string, AreaParaDesenhar[]>();
  registros.forEach((registro, i) => {
    const cidade = registro.CD_MUN;
    const poligono = poligonos[i];
    if (!doMapa.has(cidade) || !poligono) return;
    porCidade.set(cidade, [...(porCidade.get(cidade) ?? []), { nome: registro[campoDoNome], aneis: projetarAneis(poligono, projetarNaCidade) }]);
  });
  return porCidade;
}

function mesclar(mapas: readonly Map<string, AreaParaDesenhar[]>[]): Map<string, AreaParaDesenhar[]> {
  return new Map(mapas.flatMap((mapa) => [...mapa]));
}
