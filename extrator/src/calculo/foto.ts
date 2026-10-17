import { semestreDoRitmo } from "dominio/analises";
import { diaUtilDoMes, diasUteisDoMes } from "dominio/calendario";
import { VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import type { ClienteDaCarteira, DadosDoErp } from "../erp/tipos.ts";
import { idDoCliente, idDoGrupo } from "../idDoCliente.ts";
import { montarClientes } from "./clientes.ts";
import { montarPainel } from "./painel.ts";
import { montarPedidos, montarPedidosFaturados } from "./pedidos.ts";
import { juntarProdutos } from "./produtos.ts";
import type { Referencia } from "./referencia.ts";

/**
 * A foto inteira a partir do que foi lido do ERP. Pedidos e notas vão só dos representantes
 * autorizados; o cliente deles vai pelo id quando está na carteira de um autorizado, e nulo nos
 * outros casos.
 */
export function montarFoto(dados: DadosDoErp, referencia: Referencia, autorizados: string[], chaveDoId: Buffer): Foto {
  const idDe = (cliente: ClienteDaCarteira) => idDoCliente(chaveDoId, cliente.empresa, cliente.cliente);
  const idPorChave = new Map(dados.carteira.map((cliente) => [cliente.chave, idDe(cliente)]));
  const idNaCarteira = (chave: string) => idPorChave.get(chave) ?? null;
  const pedidos = dados.pedidos.filter((pedido) => autorizados.includes(pedido.representante));
  const clientes = montarClientes(dados, referencia, {
    doCliente: idDe,
    doGrupo: (representante, nome) => idDoGrupo(chaveDoId, representante, nome),
  });
  const semestre = semestreDoRitmo(referencia.mesAtual);
  return {
    foto: {
      versao_esquema: VERSAO_DO_ESQUEMA,
      gerada_em: referencia.geradaEm,
      data_ref: referencia.hoje,
      mes_atual: referencia.mesAtual,
      dia_util: diaUtilDoMes(referencia.hoje),
      dias_uteis: diasUteisDoMes(referencia.mesAtual),
      semestre_inicio: semestre.inicio,
      semestre_fim: semestre.fim,
    },
    representante: autorizados.map((codigo) => ({ codigo, nome: dados.representantes.get(codigo) ?? "" })),
    ...clientes,
    produto: juntarProdutos(clientes.produto, [...pedidos, ...dados.notas, ...dados.pedidosFaturados].flatMap((documento) => documento.itens)),
    painel_mes: montarPainel(dados.vendasDoDia, autorizados, referencia).map((mes) => ({
      representante: mes.representante,
      mes: mes.mes,
      faturado: mes.faturado,
      ano_anterior: mes.anoAnterior,
      ano_anterior_ate_dia_util: mes.anoAnteriorAteDiaUtil,
      ritmo_por_dia_util: mes.ritmoPorDiaUtil,
    })),
    ...montarPedidos({ pedidos, notas: dados.notas }, referencia, idNaCarteira),
    ...montarPedidosFaturados(dados.pedidosFaturados, dados.pedidos, idNaCarteira),
  };
}
