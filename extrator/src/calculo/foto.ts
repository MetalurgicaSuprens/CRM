import { somarMeses } from "dominio/datas";
import { VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import type { ClienteDaCarteira, DadosDoErp } from "../erp/tipos.ts";
import { idDoCliente } from "../idDoCliente.ts";
import { diaUtilDoMes, diasUteisDoMes } from "./calendario.ts";
import { SEM_FAMILIA, montarClientes } from "./clientes.ts";
import { montarPainel } from "./painel.ts";
import { montarPedidos } from "./pedidos.ts";
import type { Referencia } from "./referencia.ts";

/**
 * A foto inteira a partir do que foi lido do ERP. Pedidos e notas vão só dos representantes
 * autorizados; o cliente deles vai pelo id quando está na carteira de um autorizado, e nulo nos
 * outros casos.
 */
export function montarFoto(dados: DadosDoErp, referencia: Referencia, autorizados: string[], chaveDoId: Buffer): Foto {
  const idDe = (cliente: ClienteDaCarteira) => idDoCliente(chaveDoId, cliente.empresa, cliente.cliente);
  const idPorChave = new Map(dados.carteira.map((cliente) => [cliente.chave, idDe(cliente)]));
  const pedidos = dados.pedidos.filter((pedido) => autorizados.includes(pedido.representante));
  const clientes = montarClientes(dados, referencia, idDe);
  return {
    foto: {
      versao_esquema: VERSAO_DO_ESQUEMA,
      gerada_em: referencia.geradaEm,
      data_ref: referencia.hoje,
      mes_atual: referencia.mesAtual,
      dia_util: diaUtilDoMes(referencia.hoje, dados.diasUteis),
      dias_uteis: diasUteisDoMes(referencia.mesAtual, dados.diasUteis),
      semestre_inicio: somarMeses(referencia.mesAtual, -6),
      semestre_fim: somarMeses(referencia.mesAtual, -1),
    },
    representante: autorizados.map((codigo) => ({ codigo, nome: dados.representantes.get(codigo) ?? "" })),
    ...clientes,
    produto: juntarProdutos(clientes.produto, [...pedidos, ...dados.notas].flatMap((documento) => documento.itens)),
    painel_mes: montarPainel(dados.vendasDoDia, autorizados, referencia, dados.diasUteis).map((mes) => ({
      representante: mes.representante,
      mes: mes.mes,
      faturado: mes.faturado,
      ano_anterior: mes.anoAnterior,
      ano_anterior_ate_dia_util: mes.anoAnteriorAteDiaUtil,
      ritmo_por_dia_util: mes.ritmoPorDiaUtil,
    })),
    ...montarPedidos({ pedidos, notas: dados.notas }, referencia, (chave) => idPorChave.get(chave) ?? null),
  };
}

/** A família de cada produto que aparece na ficha, num pedido em aberto ou numa nota, uma vez só. */
function juntarProdutos(daFicha: Foto["produto"], dosItens: readonly { produto: string; familia: string | null }[]): Foto["produto"] {
  const familias = new Map(daFicha.map(({ produto, familia }) => [produto, familia]));
  for (const { produto, familia } of dosItens) {
    if (!familias.has(produto)) familias.set(produto, familia ?? SEM_FAMILIA);
  }
  return [...familias].map(([produto, familia]) => ({ produto, familia }));
}
