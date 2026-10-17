import type { DatabaseSync } from "node:sqlite";
import type { Porte } from "dominio/tipos";
import type { ClienteResumo, FichaCliente } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { COLUNAS_DO_RESUMO, comResumos, escopo, lerLinhas, numero, numeroOuNulo, texto, textoOuNulo } from "./linhas.ts";
import { lerPedidosDaFicha, lerPedidosDoGrupo } from "./pedidos.ts";

/** A carteira do login: os clientes de todos os códigos dele, com o grupo no lugar dos CNPJs dele. */
export function lerCarteira(db: DatabaseSync, sessao: Sessao): ClienteResumo[] {
  const { marcas, codigos } = escopo(sessao);
  const linhas = lerLinhas(
    db,
    `SELECT ${COLUNAS_DO_RESUMO} FROM cliente c WHERE c.grupo IS NULL AND c.representante IN (${marcas}) ORDER BY c.faturamento_12m DESC`,
    codigos,
  );
  return comResumos(db, sessao, linhas).map(({ cliente }) => cliente);
}

/**
 * A ficha só sai para cliente da carteira do login; fora dela, null (a rota responde 404). A do
 * grupo tem os números somados, os CNPJs e os pedidos de todos eles; a do CNPJ, o caminho de volta
 * ao grupo.
 */
export function lerFicha(db: DatabaseSync, sessao: Sessao, codigoDoCliente: string): FichaCliente | null {
  const { marcas, codigos } = escopo(sessao);
  const [linha] = lerLinhas(
    db,
    `SELECT ${COLUNAS_DO_RESUMO}, c.razao_social, c.cliente_desde, c.ciclo_dias, c.grupo_mix, c.grupo
       FROM cliente c WHERE c.cliente = ? AND c.representante IN (${marcas})`,
    [codigoDoCliente, ...codigos],
  );
  const resumo = linha ? comResumos(db, sessao, [linha])[0]?.cliente : undefined;
  if (!linha || !resumo) return null;
  const porCliente = (sql: string) => lerLinhas(db, sql, [codigoDoCliente]);
  return {
    ...resumo,
    razaoSocial: texto(linha, "razao_social"),
    clienteDesde: numeroOuNulo(linha, "cliente_desde"),
    cicloDias: numeroOuNulo(linha, "ciclo_dias"),
    mensal: porCliente("SELECT mes, valor FROM cliente_mes WHERE cliente = ? ORDER BY mes").map((mes) => ({
      mes: texto(mes, "mes"),
      valor: numero(mes, "valor"),
    })),
    familias: porCliente("SELECT familia, valor, participacao FROM cliente_familia WHERE cliente = ? ORDER BY valor DESC").map(
      (familia) => ({ familia: texto(familia, "familia"), valor: numero(familia, "valor"), participacao: numero(familia, "participacao") }),
    ),
    produtos: porCliente(
      `SELECT f.produto, p.familia, f.pecas_12m, f.valor_12m, f.ultima_compra
         FROM ficha_produto f JOIN produto p ON p.produto = f.produto
        WHERE f.cliente = ? ORDER BY f.valor_12m DESC`,
    ).map((produto) => ({
      codigo: texto(produto, "produto"),
      familia: texto(produto, "familia"),
      pecas: numero(produto, "pecas_12m"),
      valor: numero(produto, "valor_12m"),
      ultimaCompra: texto(produto, "ultima_compra"),
    })),
    oportunidades: lerOportunidades(db, codigoDoCliente),
    grupoDoMix: grupoDoMix(textoOuNulo(linha, "grupo_mix")),
    pedidos: resumo.cnpjs ? lerPedidosDoGrupo(db, sessao, resumo.cnpjs) : lerPedidosDaFicha(db, sessao, codigoDoCliente),
    grupo: lerGrupo(db, sessao, textoOuNulo(linha, "grupo")),
  };
}

export function lerOportunidades(db: DatabaseSync, codigoDoCliente: string): FichaCliente["oportunidades"] {
  return lerLinhas(db, "SELECT familia, penetracao FROM cliente_mix WHERE cliente = ? ORDER BY ordem", [codigoDoCliente]).map(
    (linha) => ({ familia: texto(linha, "familia"), penetracao: numero(linha, "penetracao") }),
  );
}

/** "mercado": a comparação usou o mercado inteiro; null: nem o mercado tinha 20 parecidos. */
export function grupoDoMix(grupo: string | null): FichaCliente["grupoDoMix"] {
  if (grupo === null) return null;
  return { porte: grupo === "mercado" ? null : (grupo as Porte) };
}

function lerGrupo(db: DatabaseSync, sessao: Sessao, codigoDoGrupo: string | null): FichaCliente["grupo"] {
  if (codigoDoGrupo === null) return null;
  const { marcas, codigos } = escopo(sessao);
  const [linha] = lerLinhas(db, `SELECT c.cliente, c.nome FROM cliente c WHERE c.cliente = ? AND c.representante IN (${marcas})`, [
    codigoDoGrupo,
    ...codigos,
  ]);
  return linha ? { codigo: texto(linha, "cliente"), nome: texto(linha, "nome") } : null;
}
