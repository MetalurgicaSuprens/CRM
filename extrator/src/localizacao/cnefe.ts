import type { PrecisaoDoPonto } from "dominio/tipos";
import { chaveDaRua, isCepDaCidadeToda } from "./endereco.ts";

/*
 * O ponto de cada endereço pelo Cadastro Nacional de Endereços para Fins Estatísticos do Censo 2022
 * (CNEFE, do IBGE): todo endereço do Brasil com a coordenada que o recenseador marcou. A busca roda
 * aqui, na LAN, sem mandar o endereço do cliente a ninguém. A ordem, do mais preciso ao menos:
 *   1. o mesmo número na mesma rua;
 *   2. o mesmo número no mesmo CEP, quando a rua está escrita diferente;
 *   3. o número mais perto na mesma rua;
 *   4. o meio da rua, sem número;
 *   5. o meio do CEP, se ele não for o CEP da cidade toda.
 */

export type EnderecoParaLocalizar = {
  /** Identifica o endereço no resultado. */
  chave: string;
  cep: string | null;
  /** A rua já reduzida ao nome (chaveDaRua). */
  rua: string;
  numero: number | null;
};

export type PontoLocalizado = { latitude: number; longitude: number; precisao: PrecisaoDoPonto };

type EnderecoDoCnefe = { rua: string; cep: string; numero: number | null; latitude: number; longitude: number; isNoNumero: boolean };

/** Até quantos números de distância o vizinho na mesma rua ainda serve. */
const DISTANCIA_MAXIMA_DE_NUMERO = 300;
/**
 * NV_GEO_COORD do CNEFE: 1 a 3, a coordenada é do próprio endereço; 4, da face da quadra; 5 e 6, da
 * localidade ou do setor, longe demais para dizer onde fica o número.
 */
const NIVEL_DO_NUMERO = 4;
const COLUNAS = ["CEP", "NOM_TIPO_SEGLOGR", "NOM_TITULO_SEGLOGR", "NOM_SEGLOGR", "NUM_ENDERECO", "LATITUDE", "LONGITUDE", "NV_GEO_COORD"] as const;

/**
 * Lê o CSV de um município do CNEFE e devolve o ponto de cada endereço pedido; null quando nenhum
 * passo da busca acha. Guarda só as linhas dos CEPs e das ruas pedidos.
 */
export async function localizarNoMunicipio(linhas: AsyncIterable<string>, enderecos: readonly EnderecoParaLocalizar[]): Promise<Map<string, PontoLocalizado | null>> {
  const { porCep, porRua } = await lerCandidatos(linhas, enderecos);
  return new Map(enderecos.map((endereco) => [endereco.chave, escolherPonto(endereco, porCep.get(endereco.cep ?? "") ?? [], porRua.get(endereco.rua) ?? [])]));
}

async function lerCandidatos(linhas: AsyncIterable<string>, enderecos: readonly EnderecoParaLocalizar[]) {
  const cepsPedidos = new Set(enderecos.flatMap(({ cep }) => (cep && !isCepDaCidadeToda(cep) ? [cep] : [])));
  const ruasPedidas = new Set(enderecos.map(({ rua }) => rua));
  const porCep = new Map<string, EnderecoDoCnefe[]>();
  const porRua = new Map<string, EnderecoDoCnefe[]>();
  // O CSV vem ordenado por rua: a chave de cada nome de rua sai uma vez só.
  const chaveDoNome = new Map<string, string>();
  let coluna: Record<(typeof COLUNAS)[number], number> | null = null;
  for await (const linha of linhas) {
    const campos = linha.split(";");
    if (!coluna) {
      coluna = indicesDasColunas(campos);
      continue;
    }
    const nome = `${campos[coluna.NOM_TIPO_SEGLOGR]} ${campos[coluna.NOM_TITULO_SEGLOGR]} ${campos[coluna.NOM_SEGLOGR]}`;
    let rua = chaveDoNome.get(nome);
    if (rua === undefined) {
      rua = chaveDaRua(nome);
      chaveDoNome.set(nome, rua);
    }
    const cep = campos[coluna.CEP] ?? "";
    const isDoCep = cepsPedidos.has(cep);
    const isDaRua = ruasPedidas.has(rua);
    if (!isDoCep && !isDaRua) continue;
    const endereco = enderecoDaLinha(campos, coluna, rua, cep);
    if (!endereco) continue;
    if (isDoCep) adicionar(porCep, cep, endereco);
    if (isDaRua) adicionar(porRua, rua, endereco);
  }
  return { porCep, porRua };
}

function indicesDasColunas(cabecalho: string[]): Record<(typeof COLUNAS)[number], number> {
  const indices = Object.fromEntries(COLUNAS.map((nome) => [nome, cabecalho.indexOf(nome)]));
  const faltando = COLUNAS.filter((nome) => indices[nome] === -1);
  if (faltando.length > 0) throw new Error(`O arquivo do CNEFE não tem as colunas ${faltando.join(", ")}.`);
  return indices as Record<(typeof COLUNAS)[number], number>;
}

function enderecoDaLinha(campos: string[], coluna: Record<(typeof COLUNAS)[number], number>, rua: string, cep: string): EnderecoDoCnefe | null {
  const latitude = Number(campos[coluna.LATITUDE]);
  const longitude = Number(campos[coluna.LONGITUDE]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) return null;
  // No CNEFE, o 0 é o "sem número" (S/N).
  const numero = Number(campos[coluna.NUM_ENDERECO]);
  return {
    rua,
    cep,
    numero: Number.isInteger(numero) && numero > 0 ? numero : null,
    latitude,
    longitude,
    isNoNumero: Number(campos[coluna.NV_GEO_COORD]) <= NIVEL_DO_NUMERO,
  };
}

function adicionar(mapa: Map<string, EnderecoDoCnefe[]>, chave: string, endereco: EnderecoDoCnefe) {
  const lista = mapa.get(chave);
  if (lista) lista.push(endereco);
  else mapa.set(chave, [endereco]);
}

/** Os passos da busca, na ordem do cabeçalho; `doCep` e `daRua` são os candidatos já separados. */
function escolherPonto(endereco: EnderecoParaLocalizar, doCep: readonly EnderecoDoCnefe[], daRua: readonly EnderecoDoCnefe[]): PontoLocalizado | null {
  // A rua do mesmo nome em outro bairro fica de fora quando há a rua dentro do CEP do cliente.
  const naRuaDoCep = daRua.filter(({ cep }) => cep === endereco.cep);
  const naRua = naRuaDoCep.length > 0 ? naRuaDoCep : daRua;
  const { numero } = endereco;
  if (numero !== null) {
    const comNumero = (lista: readonly EnderecoDoCnefe[]) => lista.filter((candidato) => candidato.isNoNumero && candidato.numero !== null);
    const mesmoNumero = (lista: readonly EnderecoDoCnefe[]) => comNumero(lista).filter((candidato) => candidato.numero === numero);
    const exato = mesmoNumero(naRua).length > 0 ? mesmoNumero(naRua) : mesmoNumero(doCep);
    if (exato.length > 0) return meio(exato, "numero");
    const vizinho = numeroMaisPerto(comNumero(naRua), numero);
    if (vizinho.length > 0) return meio(vizinho, "rua");
  }
  if (naRua.length > 0) return meio(naRua, "rua");
  if (doCep.length > 0) return meio(doCep, "cep");
  return null;
}

function numeroMaisPerto(candidatos: readonly EnderecoDoCnefe[], numero: number): EnderecoDoCnefe[] {
  const distancia = (candidato: EnderecoDoCnefe) => Math.abs((candidato.numero ?? 0) - numero);
  const menor = Math.min(...candidatos.map(distancia));
  return menor <= DISTANCIA_MAXIMA_DE_NUMERO ? candidatos.filter((candidato) => distancia(candidato) === menor) : [];
}

/** A mediana das coordenadas: um endereço com muitos apartamentos ou uma coordenada errada não puxa o ponto. */
function meio(candidatos: readonly EnderecoDoCnefe[], precisao: PrecisaoDoPonto): PontoLocalizado {
  return { latitude: mediana(candidatos.map(({ latitude }) => latitude)), longitude: mediana(candidatos.map(({ longitude }) => longitude)), precisao };
}

function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const metade = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? (ordenados[metade] ?? 0) : ((ordenados[metade - 1] ?? 0) + (ordenados[metade] ?? 0)) / 2;
}
