import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, CirclePause, CirclePlus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { Indicador } from "../componentes/Indicador";
import { ListaClientes } from "../componentes/ListaClientes";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { carregarPainel, carregarSituacaoDosDados } from "../dados/api";
import type { GrupoDestaque, PainelInicio } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarMesAno, formatarNomeDoMes, formatarTempoDesde } from "../formato";
import { BarrasMensais } from "../graficos/BarrasMensais";
import { Carregando } from "./Carregando";
import estilos from "./Inicio.module.css";

export function Inicio() {
  const { dados: painel } = useCarga("painel", carregarPainel);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (!painel || !situacao) return <Carregando />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo={`${saudacao()}, ${primeiroNome(situacao.representante.nome)}`} descricao={descricaoDoDia(painel)} />
      <Indicadores painel={painel} />
      <div className={estilos.gradePrincipal}>
        <Cartao titulo="Faturamento mensal" subtitulo={`${anoDe(painel)}, comparado a ${anoDe(painel) - 1}`}>
          <BarrasMensais
            descricao={`Faturamento mensal de ${anoDe(painel)} comparado a ${anoDe(painel) - 1}`}
            rotulos={{ valor: String(anoDe(painel)), comparacao: String(anoDe(painel) - 1), aFaturar: "A faturar no mês" }}
            barras={painel.mensal.map((mes) => ({ mes: mes.mes, valor: mes.faturado, comparacao: mes.anoAnterior, aFaturar: mes.aFaturar }))}
          />
        </Cartao>
        <AtencaoNaCarteira destaques={painel.destaques} />
      </div>
      <div className={estilos.gradeListas}>
        <Cartao titulo="Pararam de comprar" subtitulo="Ordenados pelo faturamento mensal que deixou de entrar">
          <ListaClientes
            vazio="Nenhum cliente parado."
            itens={painel.destaques.pararam.itens.map(({ cliente, valor }) => ({
              codigo: cliente.codigo,
              nome: cliente.nome,
              detalhe: `${cliente.cidade}/${cliente.uf} · última compra ${cliente.ultimaCompra ? formatarTempoDesde(cliente.ultimaCompra, situacao.hoje) : "—"}`,
              direita: (
                <>
                  <Valor valor={valor} compacto />
                  <span className={estilos.suave}>por mês</span>
                </>
              ),
            }))}
          />
        </Cartao>
        <Cartao titulo="Comprando menos" subtitulo="Últimos 6 meses contra os mesmos meses do ano passado">
          <ListaClientes
            vazio="Nenhuma queda relevante no semestre."
            itens={painel.destaques.menos.itens.map(({ cliente, valor, variacao }) => ({
              codigo: cliente.codigo,
              nome: cliente.nome,
              detalhe: `${cliente.cidade}/${cliente.uf}`,
              direita: (
                <>
                  <Variacao razao={variacao} />
                  <Valor valor={valor} compacto />
                </>
              ),
            }))}
          />
        </Cartao>
      </div>
    </div>
  );
}

function Indicadores({ painel }: { painel: PainelInicio }) {
  const { mesAtual, ano, pedidosEmAberto } = painel;
  const nomeDoMes = formatarNomeDoMes(mesAtual.mes);
  return (
    <div className={estilos.indicadores}>
      <Indicador
        rotulo={`Faturado em ${nomeDoMes}`}
        valor={<Valor valor={mesAtual.faturado} compacto />}
        detalhe={<Variacao razao={razao(mesAtual.faturado, mesAtual.anoAnteriorMesmoDiaUtil)} referencia={`vs ${formatarMesAno(`${anoDe(painel) - 1}${mesAtual.mes.slice(4)}`)}, mesmo dia útil`} />}
      />
      <Indicador
        rotulo={`Projeção de ${nomeDoMes}`}
        valor={<Valor valor={mesAtual.faturado + mesAtual.aFaturarNoMes} compacto />}
        detalhe={
          <>
            com <Valor valor={mesAtual.aFaturarNoMes} compacto /> a faturar
          </>
        }
      />
      <Indicador
        rotulo={`Acumulado de ${anoDe(painel)}`}
        valor={<Valor valor={ano.acumulado} compacto />}
        detalhe={<Variacao razao={razao(ano.acumulado, ano.acumuladoAnoAnterior)} referencia={`vs ${anoDe(painel) - 1}`} />}
      />
      <Indicador
        rotulo="Pedidos em aberto"
        valor={<Valor valor={pedidosEmAberto.valor} compacto />}
        detalhe={`${pedidosEmAberto.quantidade} pedidos`}
      />
    </div>
  );
}

type LinhaAtencao = {
  chave: keyof PainelInicio["destaques"];
  rotulo: string;
  Icone: LucideIcon;
  tom: string | undefined;
  descrever: (grupo: GrupoDestaque) => ReactNode;
};

const LINHAS_ATENCAO: LinhaAtencao[] = [
  { chave: "pararam", rotulo: "Pararam de comprar", Icone: CirclePause, tom: estilos.critico, descrever: (g) => <><Valor valor={g.valorTotal} compacto /> por mês</> },
  { chave: "menos", rotulo: "Comprando menos", Icone: TrendingDown, tom: estilos.alerta, descrever: (g) => <><Valor valor={g.valorTotal} compacto /> no semestre</> },
  { chave: "mais", rotulo: "Comprando mais", Icone: TrendingUp, tom: estilos.ok, descrever: (g) => <>+<Valor valor={g.valorTotal} compacto /> no semestre</> },
  { chave: "novos", rotulo: "Clientes novos", Icone: CirclePlus, tom: estilos.neutro, descrever: (g) => <><Valor valor={g.valorTotal} compacto /> desde a 1ª compra</> },
];

function AtencaoNaCarteira({ destaques }: { destaques: PainelInicio["destaques"] }) {
  return (
    <Cartao titulo="Atenção na carteira" subtitulo="Pelas regras de análise do CRM">
      <ul className={estilos.atencao}>
        {LINHAS_ATENCAO.map(({ chave, rotulo, Icone, tom, descrever }) => (
          <li key={chave}>
            <Link to={`/analises?lista=${chave}`} className={estilos.linhaAtencao}>
              <span className={`${estilos.iconeAtencao} ${tom ?? ""}`}>
                <Icone size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className={estilos.textoAtencao}>
                <span className={estilos.rotuloAtencao}>{rotulo}</span>
                <span className={estilos.descricaoAtencao}>{descrever(destaques[chave])}</span>
              </span>
              <span className={estilos.quantidade}>{destaques[chave].quantidade}</span>
              <ChevronRight size={16} className={estilos.seta} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

function razao(atual: number, anterior: number): number | null {
  return anterior > 0 ? atual / anterior - 1 : null;
}

function anoDe(painel: PainelInicio): number {
  return Number(painel.mesAtual.mes.slice(0, 4));
}

function descricaoDoDia(painel: PainelInicio): string {
  const data = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return `${data.charAt(0).toUpperCase()}${data.slice(1)} · ${painel.mesAtual.diaUtil}º de ${painel.mesAtual.diasUteis} dias úteis`;
}

function saudacao(agora = new Date()): string {
  const hora = agora.getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string): string {
  return nome.split(" ")[0] ?? nome;
}
