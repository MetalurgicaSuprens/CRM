import { dataDoMomento } from "dominio/datas";
import { arredondarAoCentavo, primeiraEntregaPossivel, valorDaLinha, type ItemComPreco } from "dominio/pedido";
import { formatarCep, formatarData } from "../formato";
import { itemNovo, type ItemEscolhido, type ProdutoQueEntra } from "./pedido";
import type {
  Classificacao,
  CondicoesDoPedidoNoErp,
  DadosDoPedido,
  EscolhaDaTransportadora,
  EscolhasDoPedido,
  PagamentoDoFrete,
  PedidoEnviado,
  Transportadora,
  Uso,
} from "./tipos";

/*
 * Os dados do pedido já preenchidos com o que o representante costuma escolher para o cliente, cada
 * um com o motivo da escolha (proposta aceita pelo Lucas em 2026-11-17, baseada no app antigo dos
 * representantes, o SGI6R). Ele só mexe se quiser.
 */

/** A partir de que fatia dos pedidos do cliente a transportadora mais usada já vem escolhida. */
export const PARTE_PARA_SUGERIR_A_TRANSPORTADORA = 0.8;

export const ROTULOS_DA_CLASSIFICACAO: Record<Classificacao, string> = {
  comercializacao: "Comercialização",
  industrializacao: "Industrialização",
  uso_consumo: "Uso e consumo",
};

/** A classificação que o SGI6R deixa marcada quando não há outra escolha. */
const CLASSIFICACAO_PADRAO: Classificacao = "comercializacao";

export type Frequencia<T extends string = string> = Uso<T> & { parte: number };

/** Cada escolha com a fatia dos pedidos em que ela foi usada, da mais usada à menos usada. */
export function frequencias<T extends string>(usos: readonly Uso<T>[]): Frequencia<T>[] {
  const total = usos.reduce((soma, uso) => soma + uso.pedidos, 0);
  return usos
    .filter((uso) => uso.pedidos > 0)
    .map((uso) => ({ ...uso, parte: uso.pedidos / total }))
    .sort((a, b) => b.pedidos - a.pedidos || a.valor.localeCompare(b.valor));
}

/** A transportadora que já vem escolhida: a que o cliente usa em pelo menos 80% dos pedidos. */
export function transportadoraSugerida(dados: Pick<DadosDoPedido, "transportadorasDoCliente">): string | null {
  const [maisUsada] = frequencias(dados.transportadorasDoCliente);
  return maisUsada && maisUsada.parte >= PARTE_PARA_SUGERIR_A_TRANSPORTADORA ? maisUsada.valor : null;
}

/**
 * A condição com que o pedido começa: a que o cliente mais usou, entre as que se podem escolher. A do
 * cadastro bate com a usada em só 37% dos pedidos, e por isso o Lucas preferiu a mais usada em
 * 2026-11-19; a tela continua avisando quando ela não é a do cadastro. Sem histórico, a do cadastro.
 */
export function condicaoInicial(dados: Pick<DadosDoPedido, "condicaoDoCadastro" | "condicoes" | "condicoesUsadas">): string {
  const isEscolhivel = (codigo: string) => dados.condicoes.some((condicao) => condicao.codigo === codigo);
  return frequencias(dados.condicoesUsadas).find((uso) => isEscolhivel(uso.valor))?.valor ?? dados.condicaoDoCadastro;
}

/**
 * As escolhas com que o pedido começa:
 * - a condição de pagamento inicial;
 * - a classificação e o frete parcial que o cliente mais usou;
 * - a transportadora sugerida.
 * Sem histórico, a classificação é Comercialização e o frete parcial não é aceito, como no SGI6R.
 */
export function escolhasIniciais(dados: DadosDoPedido): EscolhasDoPedido {
  const sugerida = transportadoraSugerida(dados);
  return {
    condicaoDePagamento: condicaoInicial(dados),
    classificacao: frequencias(dados.classificacoesUsadas)[0]?.valor ?? CLASSIFICACAO_PADRAO,
    pedidoDoCliente: "",
    aceitaParcial: dados.parcialUsado.aceita > dados.parcialUsado.naoAceita,
    clienteXped: isClienteXped(dados),
    transportadora: sugerida ? { codigo: sugerida } : null,
  };
}

/** "em 49 de 50 pedidos": quantas vezes o cliente fez a mesma escolha. Null se ele nunca fez. */
export function vezesQueOClienteEscolheu(usos: readonly Uso[], valor: string): string | null {
  const total = usos.reduce((soma, uso) => soma + uso.pedidos, 0);
  const vezes = usos.find((uso) => uso.valor === valor)?.pedidos ?? 0;
  if (vezes === 0) return null;
  return vezes === total ? `em todos os ${total} pedidos` : `em ${vezes} de ${total} pedidos`;
}

/** "98%": a fatia arredondada, nunca 0% nem 100% quando a conta não é exata. */
export function formatarParte(parte: number): string {
  const inteiro = Math.round(parte * 100);
  if (inteiro === 0 && parte > 0) return "<1%";
  if (inteiro === 100 && parte < 1) return ">99%";
  return `${inteiro}%`;
}

export function transportadoraDe(dados: Pick<DadosDoPedido, "transportadoras">, codigo: string): Transportadora | null {
  return dados.transportadoras.find((transportadora) => transportadora.codigo === codigo) ?? null;
}

/** O nome para mostrar: o do ERP ou o que o representante informou. */
export function nomeDaTransportadora(dados: Pick<DadosDoPedido, "transportadoras">, escolha: EscolhaDaTransportadora): string {
  return "nova" in escolha ? escolha.nova.nome : (transportadoraDe(dados, escolha.codigo)?.nome ?? escolha.codigo);
}

/** O que impede o envio nos dados do pedido, em frases para o representante. */
export function problemasDasEscolhas(escolhas: EscolhasDoPedido): string[] {
  return escolhas.transportadora === null ? ["Escolha a transportadora."] : [];
}

/** Só os dígitos do CNPJ. */
export function digitosDoCnpj(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** O CNPJ com 14 dígitos e os dois dígitos verificadores certos. */
export function isCnpjValido(texto: string): boolean {
  const digitos = digitosDoCnpj(texto);
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const numeros = [...digitos].map(Number);
  const verificador = (quantos: number) => {
    const pesos = quantos === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((total, peso, i) => total + peso * (numeros[i] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return verificador(12) === numeros[12] && verificador(13) === numeros[13];
}

/** "12.345.678/0001-90" */
export function formatarCnpj(texto: string): string {
  const d = digitosDoCnpj(texto);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : texto;
}

/** A transportadora do ERP com o CNPJ informado: quem cadastra "nova" uma que já existe passa a usar a do ERP. */
export function transportadoraDoCnpj(dados: Pick<DadosDoPedido, "transportadoras">, cnpj: string): Transportadora | null {
  const digitos = digitosDoCnpj(cnpj);
  return dados.transportadoras.find((transportadora) => digitosDoCnpj(transportadora.cnpj) === digitos) ?? null;
}

/** A transportadora como o pedido e o PDF a mostram: o nome, o CNPJ inteiro e de onde ela é. */
export type TransportadoraParaMostrar = { nome: string; cnpj: string; local: string };

/**
 * A transportadora escolhida, do cadastro do ERP ou como o representante a informou, quando é nova.
 * Null sem escolha ou com a do ERP que saiu do cadastro.
 */
export function transportadoraParaMostrar(dados: Pick<DadosDoPedido, "transportadoras">, escolha: EscolhaDaTransportadora | null): TransportadoraParaMostrar | null {
  if (!escolha) return null;
  if ("nova" in escolha) {
    const { nova } = escolha;
    return { nome: nova.nome, cnpj: formatarCnpj(nova.cnpj), local: `${nova.cidade}/${nova.uf}` };
  }
  const transportadora = transportadoraDe(dados, escolha.codigo);
  return transportadora ? transportadoraDoCadastro(transportadora) : null;
}

/** A transportadora do cadastro do ERP: a razão social, o CNPJ inteiro e o endereço. */
function transportadoraDoCadastro({ razaoSocial, cnpj, endereco, bairro, cidade, uf, cep }: Transportadora): TransportadoraParaMostrar {
  return { nome: razaoSocial, cnpj: formatarCnpj(cnpj), local: [endereco, bairro, `${cidade}/${uf}`, cep ? formatarCep(cep) : null].filter(Boolean).join(" · ") };
}

/** O campo "Frete" do app antigo dos representantes, com as palavras dele (untPedidos_Mov.dfm, cbFrete). */
export const ROTULOS_DO_PAGAMENTO_DO_FRETE: Record<PagamentoDoFrete, string> = {
  T: "A pagar pelo cliente à transportadora",
  C: "A pagar pelo cliente",
  F: "A pagar pelo cliente (inside ICMS)",
  P: "Pago pela empresa",
  I: "Pago pela empresa (inside ICMS)",
  N: "Pago pela empresa, mas não impresso",
  S: "Sem frete",
};

/** As condições do pedido como as telas as mostram, venha ele do CRM ou do ERP: textos prontos, null é sem. */
export type CondicoesParaMostrar = {
  transportadora: TransportadoraParaMostrar | null;
  condicaoDePagamento: string | null;
  entrega: string;
  ordemDeCompra: string | null;
  classificacao: string | null;
  /** No CRM, se o cliente exige; no ERP, que não guarda isso, se algum item levou o item da ordem. */
  xped: { rotulo: string; texto: string };
  freteParcial: string | null;
  /** Só o pedido do ERP tem; o CRM ainda não pergunta. */
  pagamentoDoFrete: string | null;
  observacao: string | null;
};

/** O pedido enviado pelo CRM: as escolhas do envio, com o cadastro do ERP de agora. */
export function condicoesDoEnvio(
  pedido: Pick<PedidoEnviado, "escolhas" | "entrega" | "enviadoEm" | "observacao">,
  dados: Pick<DadosDoPedido, "transportadoras" | "condicoes"> | null,
): CondicoesParaMostrar {
  const { escolhas } = pedido;
  return {
    transportadora: dados ? transportadoraParaMostrar(dados, escolhas.transportadora) : null,
    condicaoDePagamento: dados ? descricaoDaCondicao(dados, escolhas.condicaoDePagamento) : escolhas.condicaoDePagamento,
    entrega: textoDaEntrega(pedido.entrega, dataDoMomento(pedido.enviadoEm)),
    ordemDeCompra: escolhas.pedidoDoCliente.trim() || null,
    classificacao: ROTULOS_DA_CLASSIFICACAO[escolhas.classificacao],
    xped: { rotulo: "Cliente exige xPed", texto: escolhas.clienteXped ? "Sim" : "Não" },
    freteParcial: escolhas.aceitaParcial ? "Aceita" : "Não aceita",
    pagamentoDoFrete: null,
    observacao: pedido.observacao.trim() || null,
  };
}

/** O pedido do ERP feito fora do CRM, como o SGI guardou (pedido do Lucas em 2026-11-24). */
export function condicoesDoErp(condicoes: CondicoesDoPedidoNoErp): CondicoesParaMostrar {
  return {
    transportadora: condicoes.transportadora ? transportadoraDoCadastro(condicoes.transportadora) : null,
    condicaoDePagamento: condicoes.condicaoDePagamento,
    entrega: textoDaEntregaNoErp(condicoes),
    ordemDeCompra: condicoes.ordemDeCompra,
    classificacao: condicoes.classificacao ? ROTULOS_DA_CLASSIFICACAO[condicoes.classificacao] : null,
    xped: { rotulo: "Item da ordem de compra (xPed)", texto: condicoes.temItemDaOrdemDeCompra ? "Sim, nos itens" : "Não" },
    freteParcial: condicoes.aceitaParcial === null ? null : condicoes.aceitaParcial ? "Aceita" : "Não aceita",
    pagamentoDoFrete: condicoes.pagamentoDoFrete ? ROTULOS_DO_PAGAMENTO_DO_FRETE[condicoes.pagamentoDoFrete] : null,
    observacao: condicoes.observacao,
  };
}

function textoDaEntregaNoErp({ tipoDeEntrega, entrega }: CondicoesDoPedidoNoErp): string {
  if (tipoDeEntrega === "programada" && entrega) return `Programada para ${formatarData(entrega)}`;
  if (tipoDeEntrega === "imediata") return "Assim que possível";
  return entrega ? formatarData(entrega) : "—";
}

/** A descrição da condição de pagamento ("28/56/84 DDL"); o código, se ela saiu do cadastro. */
export function descricaoDaCondicao(dados: Pick<DadosDoPedido, "condicoes">, codigo: string): string {
  return dados.condicoes.find((condicao) => condicao.codigo === codigo)?.descricao ?? codigo;
}

/** A entrega como o pedido a pede: a data programada ou a primeira possível a partir de `dia`. */
export function textoDaEntrega(entrega: string | null, dia: string): string {
  return entrega ? `Programada para ${formatarData(entrega)}` : `Assim que possível, a partir de ${formatarData(primeiraEntregaPossivel(dia))}`;
}

type ItemComCodigo = ItemComPreco & { codigo: string };

/** O IPI do item em reais, no centavo: a alíquota do produto sobre o valor dele. */
export function valorDoIpi(item: ItemComCodigo, ipi: Readonly<Record<string, number>>): number {
  return arredondarAoCentavo((valorDaLinha(item) * (ipi[item.codigo] ?? 0)) / 100);
}

/**
 * O peso dos itens, em kg: o de uma peça vezes as peças, como o relatório do pedido do app antigo
 * (ESTQ.PESO_POR_UNID × centos × 100). O item sem peso no cadastro fica de fora do total, e o total diz
 * quantos ficaram.
 */
export function pesoDosItens(itens: readonly { codigo: string; quantidade: number }[], pesoPorPeca: ReadonlyMap<string, number | null>): { porItem: (number | null)[]; total: number; semPeso: number } {
  const porItem = itens.map(({ codigo, quantidade }) => {
    const peso = pesoPorPeca.get(codigo) ?? null;
    return peso === null ? null : peso * quantidade;
  });
  return { porItem, total: porItem.reduce<number>((soma, peso) => soma + (peso ?? 0), 0), semPeso: porItem.filter((peso) => peso === null).length };
}

/**
 * A alíquota do IPI no pedido inteiro, em %: o IPI sobre o valor sem IPI. Com produtos de alíquotas
 * diferentes, é a média ponderada pelo valor; com uma só, é ela. Null sem valor ou sem IPI.
 */
export function aliquotaDoIpi(totais: Pick<TotaisDoPedido, "semIpi" | "ipi">): number | null {
  return totais.ipi === null || totais.semIpi <= 0 ? null : (totais.ipi / totais.semIpi) * 100;
}

/** O rodapé do pedido, como a faixa de totais do SGI6R. Sem as alíquotas (foto antes da F5), o IPI fica null. */
export type TotaisDoPedido = { itens: number; pecas: number; semIpi: number; ipi: number | null; comIpi: number | null };

/** O valor com IPI é a soma do que a tela mostra em cada item: valor sem IPI mais o IPI, cada um no centavo. */
export function totaisDoPedido(itens: readonly ItemComCodigo[], ipi: Readonly<Record<string, number>> | null): TotaisDoPedido {
  const semIpi = arredondarAoCentavo(itens.reduce((total, item) => total + valorDaLinha(item), 0));
  const totalDoIpi = ipi ? arredondarAoCentavo(itens.reduce((total, item) => total + valorDoIpi(item, ipi), 0)) : null;
  return {
    itens: itens.length,
    pecas: itens.reduce((total, item) => total + item.quantidade, 0),
    semIpi,
    ipi: totalDoIpi,
    comIpi: totalDoIpi === null ? null : arredondarAoCentavo(semIpi + totalDoIpi),
  };
}

/**
 * Os itens do último pedido do cliente, na ordem dele, só dos produtos que ainda estão no catálogo, cada
 * um com o part number sugerido para o cliente.
 */
export function itensDoUltimoPedido(ultimo: NonNullable<DadosDoPedido["ultimoPedido"]>, produtos: readonly ProdutoQueEntra[]): ItemEscolhido[] {
  const noCatalogo = new Map(produtos.map((produto) => [produto.codigo, produto]));
  return ultimo.itens.flatMap(({ codigo, quantidade }) => {
    const produto = noCatalogo.get(codigo);
    return produto && quantidade > 0 ? [itemNovo(produto, quantidade)] : [];
  });
}

/**
 * O pedido que este login já enviou hoje para o mesmo cliente, o mais recente: o SGI recusa o segundo
 * em menos de 4 minutos, e dois no mesmo dia costumam ser engano.
 */
export function pedidoJaEnviadoHoje(enviados: readonly Pick<PedidoEnviado, "cliente" | "enviadoEm">[], codigoCliente: string, hoje: string): string | null {
  const deHoje = enviados
    .filter((pedido) => pedido.cliente.codigo === codigoCliente && pedido.enviadoEm.startsWith(hoje))
    .map((pedido) => pedido.enviadoEm)
    .sort();
  return deHoje.at(-1) ?? null;
}

/** As escolhas da cotação que ainda valem diante dos dados de hoje; a condição e a transportadora que sumiram voltam ao começo. */
/** O cliente que mandou o item da ordem de compra em pelo menos metade dos pedidos: quem exige o xPed costuma exigir sempre. */
export function isClienteXped(dados: Pick<DadosDoPedido, "xpedUsado">): boolean {
  const { com, sem } = dados.xpedUsado;
  return com > 0 && com >= sem;
}

export function escolhasNoCatalogo(salvas: EscolhasDoPedido | null, dados: DadosDoPedido): EscolhasDoPedido {
  const iniciais = escolhasIniciais(dados);
  if (!salvas) return iniciais;
  const condicaoExiste = dados.condicoes.some((condicao) => condicao.codigo === salvas.condicaoDePagamento);
  const transportadora = salvas.transportadora;
  const transportadoraExiste = transportadora === null || "nova" in transportadora || transportadoraDe(dados, transportadora.codigo) !== null;
  return {
    ...salvas,
    // A cotação salva antes da marca xPed (2026-11-23) não a tem: vale a do histórico do cliente.
    clienteXped: (salvas.clienteXped as boolean | undefined) ?? iniciais.clienteXped,
    condicaoDePagamento: condicaoExiste ? salvas.condicaoDePagamento : iniciais.condicaoDePagamento,
    transportadora: transportadoraExiste ? transportadora : iniciais.transportadora,
  };
}
