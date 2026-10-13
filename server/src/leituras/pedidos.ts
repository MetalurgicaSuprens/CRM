import type { DatabaseSync } from "node:sqlite";
import type { PainelDePedidos } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { COLUNAS_DO_RESUMO, escopo, lerLinhas, numero, resumoDoCliente, texto } from "./linhas.ts";

/*
 * Pedidos do login: em aberto no ERP e notas dos últimos 45 dias, só os atribuídos aos códigos
 * dele. O nome do cliente só aparece quando o cliente é da carteira do login.
 * Enviados e rascunhos ficam no app.db, que chega na F3.
 */

export function lerPedidos(db: DatabaseSync, sessao: Sessao): PainelDePedidos {
  const { marcas, codigos } = escopo(sessao);
  const comCliente = (tabela: string, colunas: string, ordem: string) =>
    lerLinhas(
      db,
      `SELECT ${COLUNAS_DO_RESUMO}, ${colunas}
         FROM ${tabela} x JOIN cliente c ON c.cliente = x.cliente AND c.representante IN (${marcas})
        WHERE x.representante IN (${marcas})
        ORDER BY ${ordem}`,
      [...codigos, ...codigos],
    );
  return {
    enviados: [],
    rascunhos: [],
    emAberto: comCliente("pedido_aberto", "x.pedido, x.emissao, x.entrega, x.itens, x.valor", "x.entrega").map((linha) => ({
      numero: texto(linha, "pedido"),
      emissao: texto(linha, "emissao"),
      entrega: texto(linha, "entrega"),
      itens: numero(linha, "itens"),
      valor: numero(linha, "valor"),
      cliente: resumoDoCliente(linha),
    })),
    faturados: comCliente("nota", "x.nota, x.serie, x.emissao, x.valor", "x.emissao DESC, x.nota DESC").map((linha) => ({
      id: `${texto(linha, "serie")}-${texto(linha, "nota")}`,
      numero: texto(linha, "nota"),
      emissao: texto(linha, "emissao"),
      cliente: resumoDoCliente(linha),
      valor: numero(linha, "valor"),
    })),
  };
}
