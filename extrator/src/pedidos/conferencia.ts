import { dataDoMomento } from "dominio/datas";
import { primeiraEntregaPossivel, totalDoPedido } from "dominio/pedido";
import { escolherTabela } from "../calculo/catalogo.ts";
import { lerPrecosDoCliente, lerTabelasDoCliente } from "../erp/catalogo.ts";
import { statusDoCadastro } from "../erp/carteira.ts";
import { isCondicaoDaFaixa, lerClientesDosCodigos, lerTransportadoraDoPedido, type ClienteNoErp } from "../erp/pedidoRecebido.ts";
import type { PrecoDoCliente, TabelaDoCliente } from "../erp/tipos.ts";
import { idDoCliente } from "../idDoCliente.ts";
import type { Oracle } from "../oracle.ts";
import type { PedidoRecebido } from "./formato.ts";

/*
 * A conferência do pedido do CRM no Oracle, na hora, antes de ele seguir para o SGI (docs/plano.md, "Na
 * LAN, antes de gravar"). O servidor da internet já conferiu contra a foto, mas a LAN não confia nele:
 * - os códigos do login são de representantes autorizados nesta máquina;
 * - o cliente é de um desses códigos (VEND_1) e está ATIVO no SGI;
 * - cada produto está na tabela do cliente, sem preço abaixo dela (as procedures do SGI não conferem o preço);
 * - a entrega fica a pelo menos 5 dias úteis do envio;
 * - a condição de pagamento é das do SGI6R ou a do cadastro, e a transportadora existe e está ativa.
 * O pedido que não passa vai para a quarentena, com o motivo. O de transportadora nova espera vendas
 * cadastrá-la. O acima do valor-teto espera a revisão de alguém da Suprens.
 */

/** Acima disto, o pedido não segue sozinho (docs/plano.md). Valor provisório, a confirmar com o Lucas. */
export const VALOR_PARA_REVISAO = 50_000;

/** O que o SGI precisa e que só a LAN sabe: o cliente do ERP e o dono dele, e os códigos conferidos. */
export type PedidoNoErp = {
  empresa: number;
  cliente: number;
  vendedor: string;
  tabela: string;
  condicaoDePagamento: string;
  transportadora: string;
};

export type Decisao =
  | { destino: "conferidos"; erp: PedidoNoErp }
  | { destino: "revisao"; motivo: string; erp: PedidoNoErp }
  | { destino: "aguardando"; motivo: string }
  | { destino: "quarentena"; motivo: string };

/** O que a decisão precisa do ERP, lido por conferirNoErp. */
export type LidoDoErp = {
  cliente: ClienteNoErp | null;
  tabelas: readonly TabelaDoCliente[];
  precos: readonly PrecoDoCliente[];
  isCondicaoDaFaixa: boolean;
  /** O código da transportadora ativa no ERP; null se não existe (ou a nova ainda não foi cadastrada). */
  transportadora: string | null;
};

export type ChavesDaConferencia = { chaveDoIdDoCliente: Buffer; autorizados: readonly string[] };

export async function conferirNoErp(oracle: Oracle, pedido: PedidoRecebido, { chaveDoIdDoCliente, autorizados }: ChavesDaConferencia): Promise<Decisao> {
  const naoAutorizados = pedido.codigos.filter((codigo) => !autorizados.includes(codigo));
  if (naoAutorizados.length > 0) return { destino: "quarentena", motivo: `código de representante não autorizado nesta máquina: ${naoAutorizados.join(", ")}` };
  const cliente = (await lerClientesDosCodigos(oracle, pedido.codigos)).find((candidato) => idDoCliente(chaveDoIdDoCliente, candidato.empresa, candidato.cliente) === pedido.cliente) ?? null;
  const transportadora = pedido.escolhas.transportadora;
  const lido: LidoDoErp = {
    cliente,
    tabelas: cliente ? await lerTabelasDoCliente(oracle, cliente.cliente) : [],
    precos: cliente ? await lerPrecosDoCliente(oracle, cliente.cliente, pedido.itens.map(({ codigo }) => codigo)) : [],
    isCondicaoDaFaixa: await isCondicaoDaFaixa(oracle, pedido.escolhas.condicaoDePagamento),
    transportadora: transportadora ? await lerTransportadoraDoPedido(oracle, transportadora) : null,
  };
  return decidir(pedido, lido);
}

/** A decisão, sem o Oracle: a primeira regra que o pedido não cumpre manda para a quarentena. */
export function decidir(pedido: PedidoRecebido, { cliente, tabelas, precos, isCondicaoDaFaixa, transportadora }: LidoDoErp): Decisao {
  if (!cliente) return quarentena("o cliente não é de nenhum código do login");
  const problemaNoCliente = problemaNoStatus(cliente.statusNoSgi);
  if (problemaNoCliente) return quarentena(problemaNoCliente);
  const tabela = escolherTabela(tabelas, cliente.mercado);
  if (!tabela) return quarentena("o cliente não tem tabela de preço usável");
  const problema =
    problemaNosItens(pedido, precos.filter((preco) => preco.tabela === tabela.tabela)) ??
    problemaNaEntrega(pedido) ??
    problemaNaCondicao(pedido.escolhas.condicaoDePagamento, cliente, isCondicaoDaFaixa);
  if (problema) return quarentena(problema);
  const escolhida = pedido.escolhas.transportadora;
  if (!transportadora) {
    return escolhida && "nova" in escolhida
      ? { destino: "aguardando", motivo: `espera vendas cadastrar a transportadora de CNPJ ${escolhida.nova.cnpj}` }
      : quarentena("a transportadora não existe ou está inativa no ERP");
  }
  const erp = { empresa: cliente.empresa, cliente: cliente.cliente, vendedor: cliente.vendedor, tabela: tabela.tabela, condicaoDePagamento: pedido.escolhas.condicaoDePagamento, transportadora };
  const total = totalDoPedido(pedido.itens);
  if (total > VALOR_PARA_REVISAO) return { destino: "revisao", motivo: `total estimado de R$ ${total.toFixed(2)}, acima de R$ ${VALOR_PARA_REVISAO}`, erp };
  return { destino: "conferidos", erp };
}

function quarentena(motivo: string): Decisao {
  return { destino: "quarentena", motivo };
}

function problemaNoStatus(statusNoSgi: string | null): string | null {
  try {
    const status = statusDoCadastro(statusNoSgi);
    return status === "ativo" ? null : `o cliente está ${status} no cadastro do SGI`;
  } catch {
    return `status do cliente desconhecido no SGI: ${statusNoSgi ?? ""}`;
  }
}

/** Cada produto na tabela do cliente, sem preço abaixo dela, em centavos como no servidor (server/src/rascunhos.ts). */
function problemaNosItens(pedido: PedidoRecebido, precosDaTabela: readonly PrecoDoCliente[]): string | null {
  const minimos = new Map(precosDaTabela.map(({ produto, precoCento }) => [produto, precoCento]));
  for (const item of pedido.itens) {
    const minimo = minimos.get(item.codigo);
    if (minimo === undefined) return `o produto ${item.codigo} não está na tabela do cliente`;
    if (emCentavos(item.precoCento) < emCentavos(minimo)) return `o preço do cento de ${item.codigo} (${item.precoCento}) está abaixo da tabela (${minimo})`;
  }
  return null;
}

/** A conta é do dia do envio, e não de hoje: o pedido enviado às 23h59 não perde a data por chegar aqui depois da meia-noite. */
function problemaNaEntrega({ entrega, enviadoEm }: PedidoRecebido): string | null {
  if (entrega === null) return null;
  const primeira = primeiraEntregaPossivel(dataDoMomento(enviadoEm));
  return entrega < primeira ? `a entrega ${entrega} fica antes de ${primeira}, 5 dias úteis depois do envio` : null;
}

function problemaNaCondicao(condicao: string, cliente: ClienteNoErp, isDaFaixa: boolean): string | null {
  return isDaFaixa || condicao === cliente.condicaoDoCadastro ? null : `a condição de pagamento ${condicao} não é das que o representante escolhe nem a do cadastro`;
}

function emCentavos(valor: number): number {
  return Math.round(valor * 100);
}
