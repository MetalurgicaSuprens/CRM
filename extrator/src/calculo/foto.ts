import { somarMeses } from "dominio/datas";
import { VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import type { ClienteDaCarteira, DadosDoErp } from "../erp/tipos.ts";
import { idDoCliente } from "../idDoCliente.ts";
import { diaUtilDoMes, diasUteisDoMes } from "./calendario.ts";
import { montarClientes } from "./clientes.ts";
import { montarPainel } from "./painel.ts";
import type { Referencia } from "./referencia.ts";

/**
 * A foto inteira a partir do que foi lido do ERP. Pedidos e notas vão só dos representantes
 * autorizados; o cliente deles vai pelo id quando está na carteira de um autorizado, e nulo nos
 * outros casos.
 */
export function montarFoto(dados: DadosDoErp, referencia: Referencia, autorizados: string[], chaveDoId: Buffer): Foto {
  const idDe = (cliente: ClienteDaCarteira) => idDoCliente(chaveDoId, cliente.empresa, cliente.cliente);
  const idPorChave = new Map(dados.carteira.map((cliente) => [cliente.chave, idDe(cliente)]));
  const isAutorizado = (representante: string) => autorizados.includes(representante);
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
    ...montarClientes(dados, referencia, idDe),
    painel_mes: montarPainel(dados.vendasDoDia, autorizados, referencia, dados.diasUteis).map((mes) => ({
      representante: mes.representante,
      mes: mes.mes,
      faturado: mes.faturado,
      ano_anterior: mes.anoAnterior,
      ano_anterior_ate_dia_util: mes.anoAnteriorAteDiaUtil,
      ritmo_por_dia_util: mes.ritmoPorDiaUtil,
    })),
    pedido_aberto: dados.pedidos
      .filter((pedido) => isAutorizado(pedido.representante))
      .map((pedido) => ({
        pedido: pedido.pedido,
        representante: pedido.representante,
        cliente: idPorChave.get(pedido.chave) ?? null,
        emissao: pedido.emissao,
        entrega: pedido.entrega,
        itens: pedido.itens,
        valor: pedido.valor,
        valor_entrega_no_mes: pedido.valorEntregaNoMes,
      })),
    nota: dados.notas.map((nota) => ({
      nota: nota.nota,
      serie: nota.serie,
      representante: nota.representante,
      cliente: idPorChave.get(nota.chave) ?? null,
      emissao: nota.emissao,
      valor: nota.valor,
    })),
  };
}
