import type { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";
import type { Mercado, PrecisaoDoPonto, Situacao, StatusDoCadastro } from "dominio/tipos";
import type { ClienteResumo, EnderecoDoCliente } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";

/*
 * Leitura da foto com o escopo da sessão: toda consulta que devolve dado de representante recebe
 * os códigos do login, e nenhum código vem do navegador (CLAUDE.md, regra 4).
 */

export type Linha = Record<string, SQLOutputValue>;

export function lerLinhas(db: DatabaseSync, sql: string, parametros: SQLInputValue[] = []): Linha[] {
  return db.prepare(sql).all(...parametros);
}

/** A linha única da tabela `foto`: data de referência, mês, dias úteis e semestre. */
export function lerDadosDaFoto(db: DatabaseSync): Linha {
  const [linha] = lerLinhas(db, "SELECT * FROM foto");
  if (!linha) throw new Error("A foto não tem a linha de referência.");
  return linha;
}

/** "?, ?" para o IN e os códigos da sessão, na mesma ordem. */
export function escopo(sessao: Sessao): { marcas: string; codigos: string[] } {
  return { marcas: sessao.codigos.map(() => "?").join(", "), codigos: sessao.codigos };
}

export function texto(linha: Linha, coluna: string): string {
  return String(linha[coluna] ?? "");
}

export function textoOuNulo(linha: Linha, coluna: string): string | null {
  const valor = linha[coluna];
  return valor === null || valor === undefined ? null : String(valor);
}

export function numero(linha: Linha, coluna: string): number {
  return Number(linha[coluna] ?? 0);
}

export function numeroOuNulo(linha: Linha, coluna: string): number | null {
  const valor = linha[coluna];
  return valor === null || valor === undefined ? null : Number(valor);
}

/** Colunas de `cliente` (alias c) que formam o ClienteResumo. */
export const COLUNAS_DO_RESUMO = `c.cliente, c.codigo_erp, c.nome, c.cidade, c.uf, c.municipio_ibge, c.mercado, c.situacao, c.status, c.ultima_compra,
  c.ciclo_dias, c.faturamento_12m, c.variacao_12m, c.evolucao_12m, c.queda_no_semestre, c.cnpjs,
  c.endereco, c.bairro, c.cep, c.latitude, c.longitude, c.precisao_do_ponto`;

/**
 * Cada linha (lida com COLUNAS_DO_RESUMO) com o resumo do cliente, na mesma ordem; o do grupo traz
 * os CNPJs dele. O CNPJ de um grupo é sempre do representante do grupo, e o filtro pelos códigos do
 * login fica por segurança.
 */
export function comResumos(db: DatabaseSync, sessao: Sessao, linhas: readonly Linha[]): { linha: Linha; cliente: ClienteResumo }[] {
  const grupos = linhas.filter((linha) => numeroOuNulo(linha, "cnpjs") !== null).map((linha) => texto(linha, "cliente"));
  const cnpjs = cnpjsDosGrupos(db, sessao, grupos);
  return linhas.map((linha) => {
    const resumo = resumoDoCliente(linha);
    return { linha, cliente: numeroOuNulo(linha, "cnpjs") === null ? resumo : { ...resumo, cnpjs: cnpjs.get(resumo.codigo) ?? [] } };
  });
}

function cnpjsDosGrupos(db: DatabaseSync, sessao: Sessao, grupos: readonly string[]): Map<string, ClienteResumo[]> {
  const porGrupo = new Map<string, ClienteResumo[]>();
  if (grupos.length === 0) return porGrupo;
  const { marcas, codigos } = escopo(sessao);
  const linhas = lerLinhas(
    db,
    `SELECT ${COLUNAS_DO_RESUMO}, c.grupo FROM cliente c
      WHERE c.grupo IN (${grupos.map(() => "?").join(", ")}) AND c.representante IN (${marcas})
      ORDER BY c.faturamento_12m DESC`,
    [...grupos, ...codigos],
  );
  for (const linha of linhas) {
    const doGrupo = porGrupo.get(texto(linha, "grupo")) ?? [];
    doGrupo.push(resumoDoCliente(linha));
    porGrupo.set(texto(linha, "grupo"), doGrupo);
  }
  return porGrupo;
}

/** O resumo de uma linha só, sem os CNPJs do grupo: quem precisa deles usa `comResumos`. */
export function resumoDoCliente(linha: Linha): ClienteResumo {
  return {
    codigo: texto(linha, "cliente"),
    codigoErp: textoOuNulo(linha, "codigo_erp"),
    nome: texto(linha, "nome"),
    cidade: texto(linha, "cidade"),
    uf: texto(linha, "uf"),
    municipio: textoOuNulo(linha, "municipio_ibge"),
    endereco: enderecoDoCliente(linha),
    mercado: texto(linha, "mercado") as Mercado,
    situacao: texto(linha, "situacao") as Situacao,
    status: texto(linha, "status") as StatusDoCadastro,
    ultimaCompra: textoOuNulo(linha, "ultima_compra"),
    cicloDias: numeroOuNulo(linha, "ciclo_dias"),
    faturamento12m: numero(linha, "faturamento_12m"),
    variacao12m: numeroOuNulo(linha, "variacao_12m"),
    evolucao12m: JSON.parse(texto(linha, "evolucao_12m")) as number[],
    quedaNoSemestre: numeroOuNulo(linha, "queda_no_semestre"),
    cnpjs: null,
  };
}

/** O extrator só grava endereço de empresa; o ponto vem junto quando o IBGE achou. */
function enderecoDoCliente(linha: Linha): EnderecoDoCliente | null {
  const enderecoNoCadastro = textoOuNulo(linha, "endereco");
  if (enderecoNoCadastro === null) return null;
  const latitude = numeroOuNulo(linha, "latitude");
  const longitude = numeroOuNulo(linha, "longitude");
  const precisao = textoOuNulo(linha, "precisao_do_ponto");
  return {
    texto: enderecoNoCadastro,
    bairro: textoOuNulo(linha, "bairro"),
    cep: textoOuNulo(linha, "cep"),
    ponto: latitude !== null && longitude !== null && precisao !== null ? { latitude, longitude, precisao: precisao as PrecisaoDoPonto } : null,
  };
}
