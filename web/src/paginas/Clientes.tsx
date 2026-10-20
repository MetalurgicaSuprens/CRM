import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Users } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { CampoDeBusca } from "../componentes/CampoDeBusca";
import { Filtros, type Filtro } from "../componentes/Filtros";
import { NomeDoCliente } from "../componentes/NomeDoCliente";
import { MotivoDoRisco, SITUACOES, SituacaoCliente } from "../componentes/SituacaoCliente";
import { StatusDoCliente } from "../componentes/StatusDoCliente";
import { TituloDaColuna } from "../componentes/TituloDaColuna";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import type { ColunaOrdenavel, Ordem } from "../componentes/ordenacao";
import { useOrdenacao } from "../componentes/useOrdenacao";
import travada from "../componentes/PaginaTravada.module.css";
import { carregarClientes, carregarSituacaoDosDados } from "../dados/api";
import { correspondeAoClienteOuCidade } from "../dados/busca";
import { ROTULOS_DE_STATUS } from "../dados/rotulos";
import type { ClienteResumo, Semestre, Situacao } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarData, formatarLocalECodigo, formatarTempoDesde } from "../formato";
import { AmostraReferencia, Sparkline } from "../graficos/Sparkline";
import { Carregando } from "./Carregando";
import estilos from "./Clientes.module.css";

type FiltroSituacao = "todas" | Situacao;

/** "Todos" e as situações da carteira, com o ícone e o tom do selo de cada uma. */
const FILTROS: readonly Omit<Filtro<FiltroSituacao>, "quantidade">[] = [
  { valor: "todas", rotulo: "Todos", icone: Users, tom: "neutro" },
  { ...SITUACOES.ativo, valor: "ativo", rotulo: "Ativos" },
  { ...SITUACOES.em_risco, valor: "em_risco", rotulo: "Em risco" },
  { ...SITUACOES.parado, valor: "parado", rotulo: "Parados" },
  { ...SITUACOES.novo, valor: "novo", rotulo: "Novos" },
];

/** As colunas que ordenam a carteira. A tendência fica de fora: ela desenha a mesma variação. */
const COLUNAS = {
  cliente: { titulo: "Cliente", ordenarPor: (cliente) => cliente.nome },
  status: { titulo: "Status", ordenarPor: (cliente) => ROTULOS_DE_STATUS[cliente.status] },
  situacao: { titulo: "Situação", ordenarPor: (cliente) => SITUACOES[cliente.situacao].rotulo },
  ultimaCompra: { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra },
  faturamento: { titulo: "Faturado 12 meses", numerica: true, ordenarPor: (cliente) => cliente.faturamento12m },
  variacao: { titulo: "Variação", numerica: true, ordenarPor: (cliente) => cliente.variacao12m },
} satisfies Record<string, ColunaOrdenavel<ClienteResumo>>;

const MAIOR_FATURAMENTO: Ordem = { coluna: COLUNAS.faturamento.titulo, sentido: "decrescente" };

export function Clientes() {
  const { dados: clientes } = useCarga("clientes", carregarClientes);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get("busca") ?? "";
  const filtro = lerFiltro(parametros.get("situacao"));

  const filtrados = useMemo(
    () => (clientes ?? []).filter((c) => (filtro === "todas" || c.situacao === filtro) && correspondeAoClienteOuCidade(c, busca)),
    [clientes, filtro, busca],
  );
  const ordenacao = useOrdenacao(filtrados, Object.values(COLUNAS), { inicial: MAIOR_FATURAMENTO });

  if (!clientes || !situacao) return <Carregando />;

  const alterar = (chave: string, valor: string, padrao: string) => {
    const proximos = new URLSearchParams(parametros);
    if (valor === padrao) proximos.delete(chave);
    else proximos.set(chave, valor);
    setParametros(proximos, { replace: true });
  };

  return (
    <div className={`${estilos.pagina} ${travada.pagina}`}>
      <CabecalhoPagina
        titulo="Clientes"
        descricao={`${clientes.length} clientes na carteira`}
        aoLado={
          <CampoDeBusca
            rotulo="Buscar cliente"
            valor={busca}
            dica="Nome, código ou cidade"
            aoMudar={(valor) => alterar("busca", valor, "")}
            className={estilos.busca}
          />
        }
      />

      <Filtros
        rotulo="Situação"
        opcoes={FILTROS.map((opcao) => ({ ...opcao, quantidade: contar(clientes, opcao.valor) }))}
        selecionado={filtro}
        aoEscolher={(valor) => alterar("situacao", valor, "todas")}
      />

      <section className={`${estilos.tabela} ${travada.rola}`} aria-label="Carteira de clientes">
        <div className={estilos.cabecalhoTabela}>
          <span>
            <TituloDaColuna coluna={COLUNAS.cliente} ordenacao={ordenacao} />
          </span>
          <span>
            <TituloDaColuna coluna={COLUNAS.status} ordenacao={ordenacao} />
          </span>
          <span>
            <TituloDaColuna coluna={COLUNAS.situacao} ordenacao={ordenacao} />
          </span>
          <span>
            <TituloDaColuna coluna={COLUNAS.ultimaCompra} ordenacao={ordenacao} />
          </span>
          <span className={estilos.direita}>
            <TituloDaColuna coluna={COLUNAS.faturamento} ordenacao={ordenacao} />
          </span>
          <span className={estilos.direita}>
            <TituloDaColuna coluna={COLUNAS.variacao} ordenacao={ordenacao} />
          </span>
          <span className={`${estilos.direita} ${estilos.tituloTendencia}`} aria-hidden="true">
            Tendência
            <span className={estilos.legendaTendencia}>
              <AmostraReferencia />
              há 1 ano
            </span>
          </span>
        </div>
        {ordenacao.ordenados.length === 0 ? (
          <p className={estilos.vazio}>Nenhum cliente encontrado com esses filtros.</p>
        ) : (
          <ul>
            {ordenacao.ordenados.map((cliente) => (
              <li key={cliente.codigo}>
                <LinhaCliente cliente={cliente} hoje={situacao.hoje} semestre={situacao.semestre} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinhaCliente({ cliente, hoje, semestre }: { cliente: ClienteResumo; hoje: string; semestre: Semestre }) {
  return (
    <Link to={`/clientes/${cliente.codigo}`} className={cliente.status === "ativo" ? estilos.linha : `${estilos.linha} ${estilos.foraDeAtivo}`}>
      <span className={estilos.identificacao}>
        <span className={estilos.nome}>
          <NomeDoCliente cliente={cliente} />
        </span>
        <span className={estilos.local}>{formatarLocalECodigo(cliente)}</span>
      </span>
      <span className={estilos.status}>
        <StatusDoCliente status={cliente.status} />
      </span>
      <span className={estilos.situacao}>
        <SituacaoCliente situacao={cliente.situacao} />
        <MotivoDoRisco queda={cliente.quedaNoSemestre} semestre={semestre} />
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
        <Sparkline valores={cliente.evolucao12m} />
      </span>
    </Link>
  );
}

function lerFiltro(valor: string | null): FiltroSituacao {
  return FILTROS.some((f) => f.valor === valor) ? (valor as FiltroSituacao) : "todas";
}

function contar(clientes: ClienteResumo[], filtro: FiltroSituacao): number {
  return filtro === "todas" ? clientes.length : clientes.filter((c) => c.situacao === filtro).length;
}

