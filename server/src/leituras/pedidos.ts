import type { DatabaseSync } from "node:sqlite";
import type { ClienteResumo, ItemDaFicha, ItemDoErp, ItemEmAberto, PainelDePedidos, PedidoDaFicha, StatusDoPedido } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { COLUNAS_DO_RESUMO, escopo, lerLinhas, numero, resumoDoCliente, texto, textoOuNulo, type Linha } from "./linhas.ts";

/*
 * Pedidos do login: em aberto no ERP e notas dos últimos 45 dias, só os atribuídos aos códigos
 * dele, cada um com os itens que a linha mostra ao abrir. O nome do cliente só aparece quando o
 * cliente é da carteira do login.
 * Enviados e rascunhos ficam no app.db, que chega na F3.
 */

export function lerPedidos(db: DatabaseSync, sessao: Sessao): PainelDePedidos {
  const { marcas, codigos } = escopo(sessao);
  /** Linhas ligadas a `x` (pedido ou nota) atribuído ao login e de cliente da carteira dele. */
  const doLogin = (tabelas: string, colunas: string, ordem: string) =>
    lerLinhas(
      db,
      `SELECT ${colunas}
         FROM ${tabelas}
         JOIN cliente c ON c.cliente = x.cliente AND c.representante IN (${marcas})
        WHERE x.representante IN (${marcas})
        ORDER BY ${ordem}`,
      [...codigos, ...codigos],
    );
  const itensEmAberto = agruparPor(
    doLogin(
      "pedido_aberto_item i JOIN pedido_aberto x ON x.pedido = i.pedido LEFT JOIN produto p ON p.produto = i.produto",
      "i.pedido, i.ordem, i.produto, p.familia, i.pecas, i.entrega, i.valor",
      "i.pedido, i.ordem",
    ),
    (linha) => texto(linha, "pedido"),
    (linha): ItemEmAberto => ({ ...itemDoErp(linha), entrega: texto(linha, "entrega") }),
  );
  const itensDasNotas = agruparPor(
    doLogin(
      "nota_item i JOIN nota x ON x.nota = i.nota AND x.serie = i.serie LEFT JOIN produto p ON p.produto = i.produto",
      "i.nota, i.serie, i.ordem, i.produto, p.familia, i.pecas, i.valor",
      "i.nota, i.serie, i.ordem",
    ),
    idDaNota,
    itemDoErp,
  );
  return {
    enviados: [],
    rascunhos: [],
    emAberto: doLogin("pedido_aberto x", `${COLUNAS_DO_RESUMO}, x.pedido, x.emissao, x.entrega, x.itens, x.valor`, "x.entrega").map(
      (linha) => ({
        numero: texto(linha, "pedido"),
        emissao: texto(linha, "emissao"),
        entrega: texto(linha, "entrega"),
        itens: numero(linha, "itens"),
        valor: numero(linha, "valor"),
        cliente: resumoDoCliente(linha),
        itensEmAberto: itensEmAberto.get(texto(linha, "pedido")) ?? [],
      }),
    ),
    faturados: doLogin("nota x", `${COLUNAS_DO_RESUMO}, x.nota, x.serie, x.emissao, x.valor, x.pedidos`, "x.emissao DESC, x.nota DESC").map(
      (linha) => ({
        id: idDaNota(linha),
        numero: texto(linha, "nota"),
        emissao: texto(linha, "emissao"),
        cliente: resumoDoCliente(linha),
        valor: numero(linha, "valor"),
        pedidos: JSON.parse(texto(linha, "pedidos")) as string[],
        itens: itensDasNotas.get(idDaNota(linha)) ?? [],
      }),
    ),
  };
}

/**
 * O histórico da ficha: os pedidos em aberto e os faturados nos 12 meses, do cliente e atribuídos ao
 * login, do mais recente ao mais antigo, com os itens que a linha mostra ao abrir. Quem chama já
 * conferiu que o cliente é da carteira.
 */
export function lerPedidosDaFicha(db: DatabaseSync, sessao: Sessao, codigoDoCliente: string): PedidoDaFicha[] {
  const { marcas, codigos } = escopo(sessao);
  /** O mesmo filtro nas duas tabelas de pedido (x), cada uma com os parâmetros dela. */
  const doCliente = `x.cliente = ? AND x.representante IN (${marcas})`;
  const parametros = [codigoDoCliente, ...codigos, codigoDoCliente, ...codigos];
  const itens = agruparPor(
    lerLinhas(
      db,
      `SELECT i.pedido, i.ordem, i.produto, p.familia, i.pecas, i.valor, i.entrega
         FROM pedido_aberto_item i JOIN pedido_aberto x ON x.pedido = i.pedido LEFT JOIN produto p ON p.produto = i.produto
        WHERE ${doCliente}
       UNION ALL
       SELECT i.pedido, i.ordem, i.produto, p.familia, i.pecas, i.valor, NULL
         FROM pedido_faturado_item i JOIN pedido_faturado x ON x.pedido = i.pedido LEFT JOIN produto p ON p.produto = i.produto
        WHERE ${doCliente}
       ORDER BY 1, 2`,
      parametros,
    ),
    (linha) => texto(linha, "pedido"),
    (linha): ItemDaFicha => ({ ...itemDoErp(linha), entrega: textoOuNulo(linha, "entrega") }),
  );
  return lerLinhas(
    db,
    `SELECT 'em_aberto' AS status, x.pedido, x.emissao, x.entrega, x.valor FROM pedido_aberto x WHERE ${doCliente}
     UNION ALL
     SELECT 'faturado', x.pedido, x.emissao, x.faturado_em, x.valor FROM pedido_faturado x WHERE ${doCliente}
     ORDER BY 3 DESC, 2 DESC`,
    parametros,
  ).map((linha) => ({
    id: texto(linha, "pedido"),
    cnpj: null,
    numero: texto(linha, "pedido"),
    status: texto(linha, "status") as StatusDoPedido,
    emissao: texto(linha, "emissao"),
    entrega: texto(linha, "entrega"),
    itens: itens.get(texto(linha, "pedido")) ?? [],
    valor: numero(linha, "valor"),
  }));
}

/** O histórico da ficha do grupo: os pedidos de todos os CNPJs dele, cada um com o CNPJ, na mesma ordem. */
export function lerPedidosDoGrupo(db: DatabaseSync, sessao: Sessao, cnpjs: readonly ClienteResumo[]): PedidoDaFicha[] {
  return cnpjs
    .flatMap((cnpj) =>
      lerPedidosDaFicha(db, sessao, cnpj.codigo).map((pedido) => ({ ...pedido, cnpj: { codigo: cnpj.codigo, nome: cnpj.nome } })),
    )
    .sort((a, b) => b.emissao.localeCompare(a.emissao) || (b.numero ?? "").localeCompare(a.numero ?? ""));
}

/** Série e número: o número sozinho se repete entre séries. */
function idDaNota(linha: Linha): string {
  return `${texto(linha, "serie")}-${texto(linha, "nota")}`;
}

function itemDoErp(linha: Linha): ItemDoErp {
  return {
    ordem: numero(linha, "ordem"),
    codigo: texto(linha, "produto"),
    familia: texto(linha, "familia"),
    pecas: numero(linha, "pecas"),
    valor: numero(linha, "valor"),
  };
}

function agruparPor<T>(linhas: Linha[], chaveDe: (linha: Linha) => string, montar: (linha: Linha) => T): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const linha of linhas) {
    const chave = chaveDe(linha);
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(montar(linha));
    else grupos.set(chave, [montar(linha)]);
  }
  return grupos;
}
