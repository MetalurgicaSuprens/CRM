import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ClienteDaCarteira } from "../erp/tipos.ts";
import { localizarNoMunicipio, type EnderecoParaLocalizar, type PontoLocalizado } from "./cnefe.ts";
import { chaveDaRua, separarNumero } from "./endereco.ts";
import { lerLinhasDoZip } from "../zip.ts";

/*
 * Põe o ponto do endereço em cada empresa da carteira, pelo CNEFE do IBGE (cnefe.ts). Os arquivos do
 * CNEFE ficam na pasta de dados, um zip por município, com o código IBGE no começo do nome
 * (ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/
 * Arquivos_CNEFE/CSV/Municipio). Ler a capital de São Paulo leva dezenas de segundos; por isso cada
 * endereço já buscado, achado ou não, fica guardado, e só endereço novo ou mudado volta ao CNEFE.
 */

export type FontesDaLocalizacao = { pastaDoCnefe: string; arquivoDosPontos: string };

export type ResumoDaLocalizacao = {
  comPonto: number;
  semPonto: number;
  buscados: number;
  /** Os municípios com endereço para buscar e sem o arquivo do CNEFE na pasta. */
  municipiosSemArquivo: string[];
};

/** Muda quando a busca muda: os endereços guardados com a versão antiga são buscados de novo. */
const VERSAO_DA_BUSCA = 1;

type Pedido = EnderecoParaLocalizar & { municipio: string };

export async function localizarClientes(
  carteira: readonly ClienteDaCarteira[],
  fontes: FontesDaLocalizacao,
): Promise<{ carteira: ClienteDaCarteira[]; resumo: ResumoDaLocalizacao }> {
  const pedidoDoClienteDaCarteira = new Map(carteira.flatMap((cliente) => pedidoDoCliente(cliente).map((pedido) => [cliente.chave, pedido] as const)));
  const pedidos = new Map([...pedidoDoClienteDaCarteira.values()].map((pedido) => [pedido.chave, pedido]));
  const guardados = abrirGuardados(fontes.arquivoDosPontos);
  try {
    const pontos = guardados.ler([...pedidos.keys()]);
    const pendentes = [...pedidos.values()].filter(({ chave }) => !pontos.has(chave));
    const municipiosSemArquivo: string[] = [];
    const arquivos = arquivosDoCnefe(fontes.pastaDoCnefe);
    for (const [municipio, doMunicipio] of agruparPorMunicipio(pendentes)) {
      const arquivo = arquivos.get(municipio);
      if (!arquivo) {
        municipiosSemArquivo.push(municipio);
        continue;
      }
      const achados = await localizarNoMunicipio(lerLinhasDoZip(arquivo), doMunicipio);
      guardados.gravar(achados);
      for (const [chave, ponto] of achados) pontos.set(chave, ponto);
    }
    const localizada = carteira.map((cliente) => ({ ...cliente, ponto: pontos.get(pedidoDoClienteDaCarteira.get(cliente.chave)?.chave ?? "") ?? null }));
    const comPonto = localizada.filter(({ ponto }) => ponto !== null).length;
    return { carteira: localizada, resumo: { comPonto, semPonto: localizada.length - comPonto, buscados: pendentes.length, municipiosSemArquivo } };
  } finally {
    guardados.fechar();
  }
}

/** O endereço do cliente como a busca precisa; a chave junta tudo o que muda o resultado. */
function pedidoDoCliente({ endereco, municipio }: ClienteDaCarteira): Pedido[] {
  if (!endereco || !municipio) return [];
  const { rua, numero } = separarNumero(endereco.texto);
  const chaveDaRuaDoCliente = chaveDaRua(rua);
  const chave = [VERSAO_DA_BUSCA, municipio, endereco.cep ?? "", chaveDaRuaDoCliente, numero ?? ""].join("|");
  return [{ chave, municipio, cep: endereco.cep, rua: chaveDaRuaDoCliente, numero }];
}

function agruparPorMunicipio(pedidos: readonly Pedido[]): Map<string, Pedido[]> {
  const porMunicipio = new Map<string, Pedido[]>();
  for (const pedido of pedidos) porMunicipio.set(pedido.municipio, [...(porMunicipio.get(pedido.municipio) ?? []), pedido]);
  return porMunicipio;
}

/** Os zips da pasta pelo código IBGE do começo do nome ("3550308_SAO_PAULO.zip"). */
function arquivosDoCnefe(pasta: string): Map<string, string> {
  if (!fs.existsSync(pasta)) return new Map();
  return new Map(
    fs
      .readdirSync(pasta)
      .filter((nome) => /^\d{7}.*\.zip$/i.test(nome))
      .map((nome) => [nome.slice(0, 7), path.join(pasta, nome)]),
  );
}

/** Os pontos já buscados, num SQLite da pasta de dados (fora do git). O null guarda o "não achou". */
function abrirGuardados(arquivo: string) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const banco = new DatabaseSync(arquivo);
  banco.exec(`CREATE TABLE IF NOT EXISTS ponto (
    chave TEXT PRIMARY KEY,
    latitude REAL,
    longitude REAL,
    precisao TEXT
  ) STRICT`);
  const consulta = banco.prepare("SELECT latitude, longitude, precisao FROM ponto WHERE chave = ?");
  const insercao = banco.prepare("INSERT OR REPLACE INTO ponto (chave, latitude, longitude, precisao) VALUES (?, ?, ?, ?)");
  return {
    ler(chaves: readonly string[]): Map<string, PontoLocalizado | null> {
      const lidos = new Map<string, PontoLocalizado | null>();
      for (const chave of chaves) {
        const linha = consulta.get(chave) as { latitude: number | null; longitude: number | null; precisao: string | null } | undefined;
        if (!linha) continue;
        lidos.set(chave, linha.latitude !== null && linha.longitude !== null && linha.precisao !== null ? { latitude: linha.latitude, longitude: linha.longitude, precisao: linha.precisao as PontoLocalizado["precisao"] } : null);
      }
      return lidos;
    },
    gravar(pontos: ReadonlyMap<string, PontoLocalizado | null>) {
      banco.exec("BEGIN");
      for (const [chave, ponto] of pontos) insercao.run(chave, ponto?.latitude ?? null, ponto?.longitude ?? null, ponto?.precisao ?? null);
      banco.exec("COMMIT");
    },
    fechar: () => banco.close(),
  };
}
