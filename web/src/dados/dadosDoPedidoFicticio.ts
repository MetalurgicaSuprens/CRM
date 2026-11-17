import { criarAleatorio, type Aleatorio } from "./aleatorio";
import type { Classificacao, CondicaoDePagamento, DadosDoPedido, ProdutoDoCatalogo, Transportadora, Uso } from "./tipos";

/*
 * Os dados do pedido no protótipo: transportadoras e condições de pagamento inventadas, e um histórico
 * de escolhas diferente para cada cliente, tirado do código dele (o mesmo cliente, o mesmo histórico).
 * Há cliente fiel a uma transportadora, cliente que divide entre várias e cliente sem histórico.
 */

const NOMES_DAS_TRANSPORTADORAS: readonly [string, string, string][] = [
  ["Frota própria (a empresa entrega)", "Curitiba", "PR"],
  ["Transportes Ipê Amarelo", "Curitiba", "PR"],
  ["Rota Azul Cargas", "São José dos Pinhais", "PR"],
  ["Expresso Serra Verde", "Joinville", "SC"],
  ["Trans Cerrado Logística", "Goiânia", "GO"],
  ["Carga Leve Transportes", "Campinas", "SP"],
  ["Via Litoral Expresso", "Itajaí", "SC"],
  ["Gaúcha Sul Cargas", "Caxias do Sul", "RS"],
  ["Norte Minas Transportes", "Montes Claros", "MG"],
  ["Pantanal Express", "Campo Grande", "MS"],
];

const CONDICOES: CondicaoDePagamento[] = [
  { codigo: "1001", descricao: "À VISTA" },
  { codigo: "1028", descricao: "28 DDL" },
  { codigo: "1030", descricao: "30 DDL" },
  { codigo: "1045", descricao: "30/45 DDL" },
  { codigo: "1060", descricao: "30/60 DDL" },
  { codigo: "1090", descricao: "30/60/90 DDL" },
  { codigo: "1120", descricao: "28/56/84 DDL" },
];

const ALIQUOTAS_DE_IPI = [0, 3.25, 5, 9.75];

let transportadorasEmCache: Transportadora[] | null = null;

export function dadosDoPedidoFicticio(codigoCliente: string, produtos: readonly ProdutoDoCatalogo[]): DadosDoPedido {
  const aleatorio = criarAleatorio(Number.parseInt(codigoCliente.slice(0, 8), 16) + 17);
  const transportadoras = transportadorasFicticias();
  const comHistorico = !aleatorio.chance(0.12);
  const condicaoDoCadastro = aleatorio.escolher(CONDICOES).codigo;
  return {
    condicaoDoCadastro,
    condicoes: CONDICOES,
    condicoesUsadas: comHistorico ? usosDe(aleatorio, [condicaoDoCadastro, aleatorio.escolher(CONDICOES).codigo]) : [],
    classificacoesUsadas: comHistorico ? classificacoesFicticias(aleatorio) : [],
    parcialUsado: comHistorico ? parcialFicticio(aleatorio) : { aceita: 0, naoAceita: 0 },
    transportadoras,
    transportadorasDoCliente: comHistorico ? usosDe(aleatorio, sortearCodigos(aleatorio, transportadoras, aleatorio.inteiro(1, 3))) : [],
    transportadorasDoRepresentante: [
      { valor: "2", pedidos: 412 },
      { valor: "4", pedidos: 188 },
      { valor: "3", pedidos: 95 },
      { valor: "1", pedidos: 40 },
    ],
    ipi: Object.fromEntries(produtos.map((produto) => [produto.codigo, aliquotaDaFamilia(produto.familia)])),
    ultimoPedido: comHistorico ? ultimoPedidoFicticio(aleatorio, produtos) : null,
  };
}

function transportadorasFicticias(): Transportadora[] {
  transportadorasEmCache ??= NOMES_DAS_TRANSPORTADORAS.map(([nome, cidade, uf], i) => ({
    codigo: String(i + 1),
    nome,
    cnpj: cnpjFicticio(10_203_040 + i * 1_111_111),
    cidade,
    uf,
  }));
  return transportadorasEmCache;
}

/** A primeira escolha é a de quase sempre; as outras aparecem de vez em quando. */
function usosDe(aleatorio: Aleatorio, valores: readonly string[]): Uso[] {
  const unicos = [...new Set(valores)];
  const fiel = aleatorio.chance(0.65);
  return unicos.map((valor, i) => ({ valor, pedidos: i === 0 ? aleatorio.inteiro(fiel ? 30 : 8, fiel ? 60 : 14) : aleatorio.inteiro(1, fiel ? 3 : 9) }));
}

function sortearCodigos(aleatorio: Aleatorio, transportadoras: readonly Transportadora[], quantas: number): string[] {
  return Array.from({ length: quantas }, () => aleatorio.escolher(transportadoras).codigo);
}

function classificacoesFicticias(aleatorio: Aleatorio): Uso<Classificacao>[] {
  const principal = aleatorio.escolher<Classificacao>(["comercializacao", "comercializacao", "industrializacao", "uso_consumo"]);
  return [{ valor: principal, pedidos: aleatorio.inteiro(10, 40) }];
}

function parcialFicticio(aleatorio: Aleatorio): DadosDoPedido["parcialUsado"] {
  const total = aleatorio.inteiro(10, 40);
  const aceita = aleatorio.chance(0.5) ? aleatorio.inteiro(Math.ceil(total * 0.7), total) : aleatorio.inteiro(0, Math.floor(total * 0.2));
  return { aceita, naoAceita: total - aceita };
}

function ultimoPedidoFicticio(aleatorio: Aleatorio, produtos: readonly ProdutoDoCatalogo[]): DadosDoPedido["ultimoPedido"] {
  const comprados = produtos.filter((produto) => produto.ultimaCompra);
  if (comprados.length === 0) return null;
  const itens = comprados.slice(0, aleatorio.inteiro(2, 6)).map((produto) => ({ codigo: produto.codigo, quantidade: produto.embalagem * aleatorio.inteiro(1, 8) }));
  const data = comprados.map((produto) => produto.ultimaCompra?.data ?? "").sort().at(-1) ?? "";
  return { data, itens };
}

function aliquotaDaFamilia(familia: string): number {
  const semente = [...familia].reduce((soma, letra) => soma + letra.charCodeAt(0), 0);
  return ALIQUOTAS_DE_IPI[semente % ALIQUOTAS_DE_IPI.length] ?? 0;
}

/** Um CNPJ de matriz com os dígitos verificadores certos, a partir de uma raiz de 8 dígitos. */
function cnpjFicticio(raiz: number): string {
  const base = [...`${String(raiz).padStart(8, "0")}0001`].map(Number);
  const digito = (numeros: number[]) => {
    const pesos = numeros.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = pesos.reduce((soma, peso, i) => soma + peso * (numeros[i] ?? 0), 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = digito(base);
  const todos = [...base, primeiro, digito([...base, primeiro])].join("");
  return `${todos.slice(0, 2)}.${todos.slice(2, 5)}.${todos.slice(5, 8)}/${todos.slice(8, 12)}-${todos.slice(12)}`;
}
