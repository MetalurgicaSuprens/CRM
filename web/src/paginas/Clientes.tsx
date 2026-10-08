import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { SituacaoCliente } from "../componentes/SituacaoCliente";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { carregarClientes, carregarSituacaoDosDados } from "../dados/api";
import type { ClienteResumo, Situacao } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarData, formatarTempoDesde } from "../formato";
import { Sparkline } from "../graficos/Sparkline";
import { Carregando } from "./Carregando";
import estilos from "./Clientes.module.css";

type FiltroSituacao = "todas" | Situacao;

const FILTROS: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todos" },
  { valor: "ativo", rotulo: "Ativos" },
  { valor: "em_risco", rotulo: "Em risco" },
  { valor: "parado", rotulo: "Parados" },
  { valor: "novo", rotulo: "Novos" },
];

const ORDENACOES = {
  faturamento: {
    rotulo: "Maior faturamento",
    comparar: (a: ClienteResumo, b: ClienteResumo) => b.faturamento12m - a.faturamento12m,
  },
  queda: {
    rotulo: "Maior queda",
    comparar: (a: ClienteResumo, b: ClienteResumo) => (a.variacao12m ?? 0) - (b.variacao12m ?? 0),
  },
  semComprar: {
    rotulo: "Mais tempo sem comprar",
    comparar: (a: ClienteResumo, b: ClienteResumo) => (a.ultimaCompra ?? "").localeCompare(b.ultimaCompra ?? ""),
  },
  nome: {
    rotulo: "Nome (A–Z)",
    comparar: (a: ClienteResumo, b: ClienteResumo) => a.nome.localeCompare(b.nome, "pt-BR"),
  },
} as const;

type Ordem = keyof typeof ORDENACOES;

export function Clientes() {
  const { dados: clientes } = useCarga("clientes", carregarClientes);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get("busca") ?? "";
  const filtro = lerFiltro(parametros.get("situacao"));
  const ordem = lerOrdem(parametros.get("ordem"));

  const visiveis = useMemo(
    () => (clientes ?? []).filter((c) => (filtro === "todas" || c.situacao === filtro) && correspondeABusca(c, busca)).sort(ORDENACOES[ordem].comparar),
    [clientes, filtro, busca, ordem],
  );

  if (!clientes || !situacao) return <Carregando />;

  const alterar = (chave: string, valor: string, padrao: string) => {
    const proximos = new URLSearchParams(parametros);
    if (valor === padrao) proximos.delete(chave);
    else proximos.set(chave, valor);
    setParametros(proximos, { replace: true });
  };

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo="Clientes" descricao={`${clientes.length} clientes na carteira`} />

      <div className={estilos.ferramentas}>
        <label className={estilos.busca}>
          <Search size={16} aria-hidden="true" />
          <span className="visualmente-oculto">Buscar cliente</span>
          <input
            type="search"
            value={busca}
            placeholder="Nome, código ou cidade"
            onChange={(evento) => alterar("busca", evento.target.value, "")}
          />
        </label>
        <div className={estilos.filtros} role="group" aria-label="Situação">
          {FILTROS.map(({ valor, rotulo }) => (
            <button
              key={valor}
              type="button"
              className={estilos.filtro}
              aria-pressed={filtro === valor}
              onClick={() => alterar("situacao", valor, "todas")}
            >
              {rotulo}
              <span className={estilos.contagem}>{contar(clientes, valor)}</span>
            </button>
          ))}
        </div>
        <label className={estilos.ordem}>
          <span>Ordenar</span>
          <select value={ordem} onChange={(evento) => alterar("ordem", evento.target.value, "faturamento")}>
            {Object.entries(ORDENACOES).map(([valor, { rotulo }]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={estilos.tabela} aria-label="Carteira de clientes">
        <div className={estilos.cabecalhoTabela} aria-hidden="true">
          <span>Cliente</span>
          <span>Situação</span>
          <span>Última compra</span>
          <span className={estilos.direita}>Faturado 12 meses</span>
          <span className={estilos.direita}>Variação</span>
          <span className={estilos.direita}>Tendência</span>
        </div>
        {visiveis.length === 0 ? (
          <p className={estilos.vazio}>Nenhum cliente encontrado com esses filtros.</p>
        ) : (
          <ul>
            {visiveis.map((cliente) => (
              <li key={cliente.codigo}>
                <LinhaCliente cliente={cliente} hoje={situacao.hoje} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinhaCliente({ cliente, hoje }: { cliente: ClienteResumo; hoje: string }) {
  return (
    <Link to={`/clientes/${cliente.codigo}`} className={estilos.linha}>
      <span className={estilos.identificacao}>
        <span className={estilos.nome}>{cliente.nome}</span>
        <span className={estilos.local}>
          {cliente.cidade}/{cliente.uf} · {cliente.codigo}
        </span>
      </span>
      <span className={estilos.situacao}>
        <SituacaoCliente situacao={cliente.situacao} />
      </span>
      <span className={estilos.ultimaCompra} title={cliente.ultimaCompra ? formatarData(cliente.ultimaCompra) : undefined}>
        <span className={estilos.rotuloCelular}>Última compra </span>
        {cliente.ultimaCompra ? formatarTempoDesde(cliente.ultimaCompra, hoje) : "sem compras"}
      </span>
      <span className={`${estilos.faturamento} ${estilos.direita}`}>
        <Valor valor={cliente.faturamento12m} />
        <span className={estilos.rotuloCelular}> em 12 meses</span>
      </span>
      <span className={`${estilos.variacao} ${estilos.direita}`}>
        <Variacao razao={cliente.variacao12m} />
      </span>
      <span className={`${estilos.tendencia} ${estilos.direita}`}>
        <Sparkline valores={cliente.tendencia12m} />
      </span>
    </Link>
  );
}

function lerFiltro(valor: string | null): FiltroSituacao {
  return FILTROS.some((f) => f.valor === valor) ? (valor as FiltroSituacao) : "todas";
}

function lerOrdem(valor: string | null): Ordem {
  return valor !== null && valor in ORDENACOES ? (valor as Ordem) : "faturamento";
}

function contar(clientes: ClienteResumo[], filtro: FiltroSituacao): number {
  return filtro === "todas" ? clientes.length : clientes.filter((c) => c.situacao === filtro).length;
}

function correspondeABusca(cliente: ClienteResumo, busca: string): boolean {
  const termo = normalizar(busca.trim());
  if (!termo) return true;
  return [cliente.nome, cliente.codigo, cliente.cidade].some((campo) => normalizar(campo).includes(termo));
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
