import type { ReactNode } from "react";
import { Link } from "react-router";
import { Activity, ChartLine, ChartNoAxesColumn, ChevronRight, ClipboardList, Gauge, ReceiptText } from "lucide-react";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { IconeNoCirculo } from "../componentes/IconeNoCirculo";
import { ANALISES, CartaoDaAnalise } from "../componentes/IdentidadeDaAnalise";
import { Indicador } from "../componentes/Indicador";
import { ListaClientes } from "../componentes/ListaClientes";
import { Valor } from "../componentes/Valor";
import { Variacao } from "../componentes/Variacao";
import { NomeDoCliente } from "../componentes/NomeDoCliente";
import { dataDoMomento, horaDoMomento } from "dominio/datas";
import { MESES_DO_RITMO, type BaseDaProjecao } from "dominio/projecao";
import { carregarPainel, carregarSituacaoDosDados } from "../dados/api";
import type { GrupoDestaque, PainelInicio } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarDiaPorExtenso, formatarLocalDoCliente, formatarMesAno, formatarNomeDoMes, formatarTempoDesde } from "../formato";
import { BarrasMensais } from "../graficos/BarrasMensais";
import { Carregando } from "./Carregando";
import estilos from "./Inicio.module.css";

export function Inicio() {
  const { dados: painel } = useCarga("painel", carregarPainel);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  if (!painel || !situacao) return <Carregando />;
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina
        titulo={`${saudacao(situacao.relogio)}, ${primeiroNome(situacao.representante.nome)}`}
        descricao={descricaoDoDia(painel, situacao.relogio)}
      />
      <Indicadores painel={painel} />
      <div className={estilos.gradePrincipal}>
        <Cartao titulo="Faturamento mensal" icone={ChartNoAxesColumn} subtitulo={`${anoDe(painel)}, comparado a ${anoDe(painel) - 1}`}>
          <BarrasMensais
            descricao={`Faturamento mensal de ${anoDe(painel)} comparado a ${anoDe(painel) - 1}`}
            rotulos={{ valor: String(anoDe(painel)), comparacao: String(anoDe(painel) - 1), aFaturar: "A faturar no mês" }}
            barras={painel.mensal.map((mes) => ({ mes: mes.mes, valor: mes.faturado, comparacao: mes.anoAnterior, aFaturar: mes.aFaturar }))}
          />
        </Cartao>
        <AtencaoNaCarteira destaques={painel.destaques} />
      </div>
      <div className={estilos.gradeListas}>
        <CartaoDaAnalise
          tipo="pararam"
          subtitulo="Ordenados pelo faturamento mensal que deixou de entrar"
          acoes={<VerTodos lista="pararam" quantidade={painel.destaques.pararam.quantidade} />}
        >
          <ListaClientes
            vazio="Nenhum cliente parado."
            itens={painel.destaques.pararam.itens.map(({ cliente, valor }) => ({
              codigo: cliente.codigo,
              nome: <NomeDoCliente cliente={cliente} />,
              detalhe: `${formatarLocalDoCliente(cliente)} · última compra ${cliente.ultimaCompra ? formatarTempoDesde(cliente.ultimaCompra, situacao.hoje) : "—"}`,
              direita: (
                <>
                  <Valor valor={valor} compacto comoPerda />
                  <span className={estilos.suave}>por mês</span>
                </>
              ),
            }))}
          />
        </CartaoDaAnalise>
        <CartaoDaAnalise
          tipo="menos"
          subtitulo="Últimos 6 meses contra os mesmos meses do ano passado"
          acoes={<VerTodos lista="menos" quantidade={painel.destaques.menos.quantidade} />}
        >
          <ListaClientes
            vazio="Nenhuma queda relevante no semestre."
            itens={painel.destaques.menos.itens.map(({ cliente, valor, variacao }) => ({
              codigo: cliente.codigo,
              nome: <NomeDoCliente cliente={cliente} />,
              detalhe: formatarLocalDoCliente(cliente),
              direita: (
                <>
                  <Variacao razao={variacao} />
                  <Valor valor={valor} compacto />
                </>
              ),
            }))}
          />
        </CartaoDaAnalise>
      </div>
    </div>
  );
}

function VerTodos({ lista, quantidade }: { lista: keyof PainelInicio["destaques"]; quantidade: number }) {
  return (
    <Link to={`/analises?lista=${lista}`} className={estilos.verTodos}>
      Ver todos ({quantidade})
      <ChevronRight size={15} aria-hidden="true" />
    </Link>
  );
}

function Indicadores({ painel }: { painel: PainelInicio }) {
  const { mesAtual, ano, pedidosEmAberto } = painel;
  const nomeDoMes = formatarNomeDoMes(mesAtual.mes);
  const mesDoAnoAnterior = formatarMesAno(`${anoDe(painel) - 1}${mesAtual.mes.slice(4)}`);
  const projecao = mesAtual.projecao.valor;
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo={`Faturado em ${nomeDoMes}`}
        icone={ReceiptText}
        valor={<Valor valor={mesAtual.faturado} compacto />}
        detalhe={
          <Variacao
            razao={razao(mesAtual.faturado, mesAtual.anoAnteriorMesmoDiaUtil)}
            referencia={
              <>
                vs <Valor valor={mesAtual.anoAnteriorMesmoDiaUtil} compacto /> até o {mesAtual.diaUtil}º dia útil de {mesDoAnoAnterior}
              </>
            }
          />
        }
      />
      <Indicador
        rotulo={`Projeção de ${nomeDoMes}`}
        icone={Gauge}
        valor={<Valor valor={projecao} compacto />}
        detalhe={
          <>
            {BASE_DA_PROJECAO[mesAtual.projecao.base]}
            <DistanciaDoAnoAnterior projecao={projecao} mesInteiro={mesInteiroDoAnoAnterior(painel)} mes={mesDoAnoAnterior} />
          </>
        }
      />
      <Indicador
        rotulo={`Acumulado de ${anoDe(painel)}`}
        icone={ChartLine}
        valor={<Valor valor={ano.acumulado} compacto />}
        detalhe={<Variacao razao={razao(ano.acumulado, ano.acumuladoAnoAnterior)} referencia={`vs ${anoDe(painel) - 1}`} />}
      />
      <Indicador
        rotulo="Pedidos em aberto"
        icone={ClipboardList}
        valor={<Valor valor={pedidosEmAberto.valor} compacto />}
        detalhe={`${pedidosEmAberto.quantidade} pedidos`}
      />
    </div>
  );
}

type LinhaAtencao = {
  chave: keyof PainelInicio["destaques"];
  descrever: (grupo: GrupoDestaque) => ReactNode;
};

const LINHAS_ATENCAO: LinhaAtencao[] = [
  { chave: "pararam", descrever: (g) => <><Valor valor={g.valorTotal} compacto comoPerda /> por mês</> },
  { chave: "menos", descrever: (g) => <><Valor valor={g.valorTotal} compacto /> no semestre</> },
  { chave: "mais", descrever: (g) => <><Valor valor={g.valorTotal} compacto comSinal /> no semestre</> },
  { chave: "novos", descrever: (g) => <><Valor valor={g.valorTotal} compacto /> desde que chegaram</> },
];

function AtencaoNaCarteira({ destaques }: { destaques: PainelInicio["destaques"] }) {
  return (
    <Cartao titulo="Atenção na carteira" icone={Activity} subtitulo="Pelas regras de análise do CRM">
      <ul className={estilos.atencao}>
        {LINHAS_ATENCAO.map(({ chave, descrever }) => (
          <li key={chave}>
            <Link to={`/analises?lista=${chave}`} className={estilos.linhaAtencao}>
              <IconeNoCirculo icone={ANALISES[chave].icone} tom={ANALISES[chave].tom} />
              <span className={estilos.textoAtencao}>
                <span className={estilos.rotuloAtencao}>{ANALISES[chave].rotulo}</span>
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

const BASE_DA_PROJECAO: Record<BaseDaProjecao, string> = {
  ritmo: `no ritmo dos últimos ${MESES_DO_RITMO} meses`,
  carteira: "pelos pedidos em carteira para o mês",
};

/** Quanto a projeção ainda precisa para igualar o mesmo mês, inteiro, do ano anterior. */
function DistanciaDoAnoAnterior({ projecao, mesInteiro, mes }: { projecao: number; mesInteiro: number; mes: string }) {
  if (mesInteiro <= 0) return null;
  const falta = mesInteiro - projecao;
  return (
    <span className={estilos.linhaDoDetalhe}>
      {falta > 0 ? (
        <>
          faltam <Valor valor={falta} compacto /> para igualar {mes}
        </>
      ) : (
        <>
          <Valor valor={-falta} compacto /> acima de {mes}
        </>
      )}
    </span>
  );
}

/** No gráfico, o ano anterior do mês corrente é o mês inteiro. */
function mesInteiroDoAnoAnterior(painel: PainelInicio): number {
  return painel.mensal.find((mes) => mes.mes === painel.mesAtual.mes)?.anoAnterior ?? 0;
}

function razao(atual: number, anterior: number): number | null {
  return anterior > 0 ? atual / anterior - 1 : null;
}

function anoDe(painel: PainelInicio): number {
  return Number(painel.mesAtual.mes.slice(0, 4));
}

/** O dia vem do relógio; o dia útil, da foto. */
function descricaoDoDia(painel: PainelInicio, relogio: string): string {
  return `${formatarDiaPorExtenso(dataDoMomento(relogio))} · ${painel.mesAtual.diaUtil}º de ${painel.mesAtual.diasUteis} dias úteis`;
}

/** Pela hora do relógio de Brasília. */
function saudacao(relogio: string): string {
  const hora = Number(horaDoMomento(relogio).slice(0, 2));
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string): string {
  return nome.split(" ")[0] ?? nome;
}
