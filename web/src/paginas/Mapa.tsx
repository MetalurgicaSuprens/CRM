import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { ChartPie, ChevronDown, ChevronUp, CirclePause, Map as IconeDoMapa, MapPinned, ReceiptText, Sprout, Target, Users, X } from "lucide-react";
import type { Caixa, MapaDaUf, MunicipioDoMapa } from "dominio/mapa";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { Indicador } from "../componentes/Indicador";
import { DataRelativa } from "../componentes/Quando";
import { Segmentos, type Segmento } from "../componentes/Segmentos";
import { SituacaoCliente } from "../componentes/SituacaoCliente";
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { carregarAnalises, carregarClientes, carregarSituacaoDosDados } from "../dados/api";
import { aRecuperarPorCliente, classeDaLacuna, montarTerritorio, type RegiaoNoTerritorio, type Territorio } from "../dados/mapa";
import { carregarMapaDaUf, carregarMapaDoBrasil } from "../dados/mapas";
import type { ClienteResumo } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { formatarCompacto, formatarContagem, formatarParticipacao } from "../formato";
import { MapaDoTerritorio, type CirculoDoMapa } from "../graficos/MapaDoTerritorio";
import { Carregando } from "./Carregando";
import estilos from "./Mapa.module.css";

/*
 * O mapa da carteira, por estado: de onde vem a receita (um círculo por município, do tamanho do
 * faturado em 12 meses) e onde dá para crescer (as regiões imediatas do IBGE pelo potencial que falta e
 * os clientes que pararam ou estão comprando menos). O potencial só se mede onde o representante tem
 * cliente e nas regiões vizinhas (dados/mapa.ts). Mais tarde, as rotas de visita saem daqui.
 */

type Lente = "receita" | "crescer";
type Escolha = { uf: string; tipo: "regiao" | "municipio"; codigo: string };

const LENTES: readonly Segmento<Lente>[] = [
  { valor: "receita", rotulo: "De onde vem a receita" },
  { valor: "crescer", rotulo: "Onde crescer" },
];
/** Quantos municípios, dos que mais pesam, têm o nome escrito no mapa. */
const MUNICIPIOS_COM_NOME = 5;
/** Quantas regiões a lista mostra antes do "Ver todas": cabem na altura do mapa ao lado. */
const REGIOES_NA_LISTA = 8;
const SEM_FATURADO = "sem faturado em 12 meses";
/** A folga em volta do estado ou da região, para o contorno não encostar na borda. */
const FOLGA_DA_VISAO = 0.06;

export function Mapa() {
  const { dados: clientes } = useCarga("clientes", carregarClientes);
  const { dados: analises } = useCarga("analises", carregarAnalises);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const { dados: brasil, erro: erroDoBrasil } = useCarga("mapa:brasil", carregarMapaDoBrasil);
  // O mapa põe cada CNPJ no seu município: o grupo, que não tem cidade, entra pelos CNPJs dele.
  const cnpjs = useMemo(() => (clientes ?? []).flatMap((cliente) => cliente.cnpjs ?? [cliente]), [clientes]);
  const ufs = useMemo(() => ufsDaCarteira(cnpjs), [cnpjs]);
  const { dados: mapas, erro: erroDosMapas } = useCarga(`mapa:${ufs.map(({ uf }) => uf).join(",")}`, () =>
    Promise.all(ufs.map(({ uf }) => carregarMapaDaUf(uf))),
  );
  const [parametros, setParametros] = useSearchParams();
  const [escolha, setEscolha] = useState<Escolha | null>(null);

  if (erroDoBrasil || erroDosMapas) return <Aviso texto="O mapa não carregou. Recarregue a página para tentar de novo." />;
  if (!clientes || !analises || !situacao || !brasil || !mapas) return <Carregando />;
  if (ufs.length === 0) return <Aviso texto="Nenhum cliente da carteira tem o município no cadastro da Suprens." />;

  const lente: Lente = parametros.get("visao") === "crescer" ? "crescer" : "receita";
  const uf = ufs.find((item) => item.uf === parametros.get("uf"))?.uf ?? ufs[0]?.uf ?? "";
  const mapa = mapas.find((item) => item.uf === uf);
  if (!mapa) return <Carregando />;
  const territorio = montarTerritorio(mapa, cnpjs, aRecuperarPorCliente(analises));
  const escolhaDoEstado = escolha?.uf === uf ? escolha : null;
  const alterar = (chave: string, valor: string, padrao: string) => {
    const proximos = new URLSearchParams(parametros);
    if (valor === padrao) proximos.delete(chave);
    else proximos.set(chave, valor);
    setParametros(proximos, { replace: true });
  };

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo="Mapa" descricao="De onde vem a sua receita e onde ainda dá para crescer" />
      <div className={estilos.controles}>
        <Segmentos rotulo="O que o mapa mostra" opcoes={LENTES} selecionado={lente} aoEscolher={(valor) => alterar("visao", valor, "receita")} />
        {ufs.length > 1 ? (
          <Segmentos
            rotulo="Estado"
            opcoes={ufs.map(({ uf: sigla, clientes: quantos }) => ({ valor: sigla, rotulo: sigla, contagem: quantos }))}
            selecionado={uf}
            aoEscolher={(valor) => alterar("uf", valor, ufs[0]?.uf ?? "")}
          />
        ) : null}
      </div>
      <Indicadores lente={lente} territorio={territorio} />
      <div className={estilos.principal}>
        <Cartao
          titulo={territorio.nome}
          icone={IconeDoMapa}
          subtitulo={
            lente === "receita"
              ? "Cada círculo é o faturado do município em 12 meses"
              : "Em verde, o potencial que falta onde você tem cliente e nas regiões vizinhas; em vermelho, o que dá para recuperar"
          }
          acoes={
            escolhaDoEstado?.tipo === "regiao" ? (
              <button type="button" className={botoes.secundario} onClick={() => setEscolha(null)}>
                Ver o estado todo
              </button>
            ) : null
          }
          className={estilos.cartaoDoMapa}
        >
          <MapaDoTerritorio
            descricao={`Mapa de ${territorio.nome}: ${lente === "receita" ? "faturado por município" : "potencial por região e o que dá para recuperar"}`}
            brasil={brasil}
            mapas={mapas}
            uf={uf}
            visao={visaoDa(mapa, escolhaDoEstado)}
            classeDaRegiao={lente === "crescer" ? classesDasRegioes(territorio) : undefined}
            comCliente={new Set(cnpjs.flatMap((cliente) => (cliente.municipio ? [cliente.municipio] : [])))}
            circulos={circulosDa(territorio, lente)}
            tom={lente === "receita" ? "receita" : "perda"}
            rotulos={rotulosDa(territorio, lente)}
            municipioEscolhido={escolhaDoEstado?.tipo === "municipio" ? escolhaDoEstado.codigo : null}
            regiaoEscolhida={escolhaDoEstado?.tipo === "regiao" ? escolhaDoEstado.codigo : null}
            dicaDe={(municipio) => <DicaDoMunicipio municipio={municipio} territorio={territorio} lente={lente} />}
            aoEscolher={(municipio) => setEscolha({ uf, tipo: "municipio", codigo: municipio.codigo })}
          />
          <Legenda lente={lente} territorio={territorio} />
        </Cartao>
        <Ranking
          key={`${lente}:${uf}`}
          lente={lente}
          territorio={territorio}
          regiaoEscolhida={escolhaDoEstado?.tipo === "regiao" ? escolhaDoEstado.codigo : null}
          aoEscolher={(codigo) => setEscolha({ uf, tipo: "regiao", codigo })}
        />
      </div>
      {escolhaDoEstado ? (
        <DetalheDaEscolha escolha={escolhaDoEstado} territorio={territorio} hoje={situacao.hoje} aoFechar={() => setEscolha(null)} />
      ) : null}
    </div>
  );
}

function Indicadores({ lente, territorio }: { lente: Lente; territorio: Territorio }) {
  if (lente === "crescer") {
    const comLacuna = territorio.regioes.filter((regiao) => regiao.lacuna > 0);
    const maior = [...comLacuna].sort((a, b) => b.lacuna - a.lacuna)[0];
    return (
      <div className={estilos.indicadores}>
        <Indicador
          destaque
          rotulo="A recuperar por mês"
          icone={CirclePause}
          valor={<Valor valor={territorio.aRecuperarPorMes} compacto comoPerda />}
          detalhe={`${formatarContagem(territorio.clientesARecuperar, "cliente parado ou comprando menos", "clientes parados ou comprando menos")}`}
        />
        <Indicador
          rotulo="Potencial por ano"
          icone={Sprout}
          valor={<Valor valor={comLacuna.reduce((soma, regiao) => soma + regiao.lacuna, 0)} compacto />}
          detalhe={`${formatarContagem(comLacuna.length, "região abaixo", "regiões abaixo")} da sua média por habitante`}
        />
        <Indicador
          rotulo="Maior oportunidade"
          icone={Target}
          valor={maior ? maior.regiao.nome : "—"}
          detalhe={maior ? <>potencial de <Valor valor={maior.lacuna} compacto comSinal /> por ano</> : semMaiorOportunidade(territorio)}
        />
      </div>
    );
  }
  const principal = [...territorio.regioes].sort((a, b) => b.receita - a.receita)[0];
  return (
    <div className={estilos.indicadores}>
      <Indicador
        destaque
        rotulo="Faturado em 12 meses"
        icone={ReceiptText}
        valor={<Valor valor={territorio.receita} compacto />}
        detalhe={`${formatarContagem(territorio.clientes, "cliente", "clientes")} em ${formatarContagem(territorio.municipios.size, "município", "municípios")}`}
      />
      <Indicador
        rotulo="Concentração"
        icone={ChartPie}
        valor={territorio.receita > 0 ? formatarContagem(territorio.municipiosPara80, "município", "municípios") : "—"}
        detalhe={territorio.receita > 0 ? "fazem 80% da receita no estado" : SEM_FATURADO}
      />
      <Indicador
        rotulo="Região que mais fatura"
        icone={MapPinned}
        valor={principal && principal.receita > 0 ? principal.regiao.nome : "—"}
        detalhe={principal && principal.receita > 0 ? `${formatarParticipacao(principal.participacao)} da receita no estado` : SEM_FATURADO}
      />
    </div>
  );
}

type PropsDoRanking = { lente: Lente; territorio: Territorio; regiaoEscolhida: string | null; aoEscolher: (codigo: string) => void };

/** A lista que acompanha o mapa: as regiões que mais faturam, ou as que mais têm para crescer. */
function Ranking({ lente, territorio, regiaoEscolhida, aoEscolher }: PropsDoRanking) {
  const [isCompleta, setIsCompleta] = useState(false);
  const regioes =
    lente === "receita"
      ? territorio.regioes.filter((regiao) => regiao.receita > 0).sort((a, b) => b.receita - a.receita)
      : territorio.regioes.filter((regiao) => regiao.lacuna > 0 || regiao.aRecuperarPorMes > 0).sort((a, b) => b.lacuna - a.lacuna);
  const maior = Math.max(1, ...regioes.map((regiao) => (lente === "receita" ? regiao.receita : regiao.lacuna)));
  return (
    <Cartao
      titulo={lente === "receita" ? "Regiões que mais faturam" : "Onde crescer"}
      icone={lente === "receita" ? ReceiptText : Sprout}
      subtitulo={
        lente === "receita"
          ? "Regiões imediatas do IBGE: a cidade-polo e o entorno"
          : "Onde você tem cliente e as regiões vizinhas, pelo que faturariam na sua média por habitante"
      }
      className={estilos.cartaoDoRanking}
    >
      {regioes.length === 0 ? (
        <p className={estilos.vazio}>{lente === "receita" ? "Nenhum faturado nos últimos 12 meses." : semRegiaoParaCrescer(territorio)}</p>
      ) : (
        <ol className={estilos.ranking}>
          {(isCompleta ? regioes : regioes.slice(0, REGIOES_NA_LISTA)).map((regiao) => (
            <li key={regiao.regiao.codigo}>
              <button
                type="button"
                className={estilos.itemDoRanking}
                aria-pressed={regiao.regiao.codigo === regiaoEscolhida}
                onClick={() => aoEscolher(regiao.regiao.codigo)}
                style={{ "--parte": (lente === "receita" ? regiao.receita : regiao.lacuna) / maior } as CSSProperties}
              >
                <span className={estilos.nomeDaRegiao}>{regiao.regiao.nome}</span>
                <span className={estilos.valorDaRegiao}>
                  {lente === "receita" ? <Valor valor={regiao.receita} compacto /> : regiao.lacuna > 0 ? <Valor valor={regiao.lacuna} compacto comSinal /> : "—"}
                </span>
                <span className={`${estilos.barra} ${lente === "receita" ? estilos.barraDeReceita : estilos.barraDePotencial}`} aria-hidden="true" />
                <span className={estilos.detalheDaRegiao}>{detalheDaRegiao(regiao, lente)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {regioes.length > REGIOES_NA_LISTA ? (
        <button type="button" className={estilos.verTodas} aria-expanded={isCompleta} onClick={() => setIsCompleta(!isCompleta)}>
          {isCompleta ? `Ver só as ${REGIOES_NA_LISTA} primeiras` : `Ver todas (${regioes.length})`}
          {isCompleta ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        </button>
      ) : null}
    </Cartao>
  );
}

/** Sem faturado no estado, não há média por habitante para medir o potencial. */
function semMaiorOportunidade(territorio: Territorio): string {
  return territorio.receita > 0 ? "todas as regiões na média" : `${SEM_FATURADO} para medir`;
}

function semRegiaoParaCrescer(territorio: Territorio): string {
  return territorio.receita > 0 ? "Todas as regiões estão na sua média ou acima." : "Sem faturado em 12 meses neste estado para medir o potencial.";
}

function detalheDaRegiao(regiao: RegiaoNoTerritorio, lente: Lente): ReactNode {
  if (lente === "receita") {
    return `${formatarParticipacao(regiao.participacao)} da receita · ${formatarContagem(regiao.clientes, "cliente", "clientes")}`;
  }
  const habitantes = `${formatarCompacto(regiao.populacao)} habitantes`;
  if (regiao.aRecuperarPorMes > 0) {
    return (
      <>
        {habitantes} · <Valor valor={regiao.aRecuperarPorMes} compacto comoPerda /> por mês a recuperar
      </>
    );
  }
  return regiao.clientes > 0 ? `${habitantes} · ${formatarContagem(regiao.clientes, "cliente", "clientes")}` : `${habitantes} · nenhum cliente ainda`;
}

function Legenda({ lente, territorio }: { lente: Lente; territorio: Territorio }) {
  if (lente === "crescer") {
    return (
      <div className={estilos.legenda}>
        <span className={estilos.itemDaLegenda}>
          <span className={estilos.amostraNeutra} aria-hidden="true" />
          longe dos seus clientes
        </span>
        <span className={estilos.itemDaLegenda}>
          <span className={estilos.amostraComCliente} aria-hidden="true" />
          na sua média ou acima
        </span>
        <span className={estilos.itemDaLegenda}>
          <span className={estilos.rampa} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          potencial por ano, do menor ao maior
        </span>
        <span className={estilos.itemDaLegenda}>
          <span className={`${estilos.bolinha} ${estilos.bolinhaDePerda}`} aria-hidden="true" />a recuperar por mês
        </span>
      </div>
    );
  }
  const maior = Math.max(0, ...[...territorio.municipios.values()].map((presenca) => presenca.receita));
  return (
    <div className={estilos.legenda}>
      <span className={estilos.itemDaLegenda}>
        <span className={`${estilos.bolinha} ${estilos.bolinhaDeReceita}`} aria-hidden="true" />
        faturado em 12 meses; o maior círculo, <Valor valor={maior} compacto />
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.amostraComCliente} aria-hidden="true" />
        município com cliente
      </span>
    </div>
  );
}

function DicaDoMunicipio({ municipio, territorio, lente }: { municipio: MunicipioDoMapa; territorio: Territorio; lente: Lente }) {
  const presenca = territorio.municipios.get(municipio.codigo);
  const regiao = territorio.regioes.find((item) => item.regiao.codigo === municipio.regiao);
  return (
    <>
      <p className={estilos.tituloDaDica}>{municipio.nome}</p>
      <p className={estilos.linhaDaDica}>
        {presenca ? (
          <>
            <Valor valor={presenca.receita} compacto /> em 12 meses · {formatarContagem(presenca.clientes.length, "cliente", "clientes")}
          </>
        ) : (
          "Sem cliente da carteira"
        )}
      </p>
      {lente === "crescer" && presenca && presenca.aRecuperarPorMes > 0 ? (
        <p className={estilos.linhaDaDica}>
          <Valor valor={presenca.aRecuperarPorMes} compacto comoPerda /> por mês a recuperar
        </p>
      ) : null}
      {regiao ? (
        <p className={estilos.regiaoDaDica}>
          Região de {regiao.regiao.nome}
          {lente === "crescer" && regiao.lacuna > 0 ? (
            <>
              {" "}
              · potencial <Valor valor={regiao.lacuna} compacto comSinal />/ano
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

type PropsDoDetalhe = { escolha: Escolha; territorio: Territorio; hoje: string; aoFechar: () => void };

/** A região ou o município escolhido: os números e os clientes, cada um com o caminho para a ficha. */
function DetalheDaEscolha({ escolha, territorio, hoje, aoFechar }: PropsDoDetalhe) {
  const regiao =
    escolha.tipo === "regiao"
      ? territorio.regioes.find((item) => item.regiao.codigo === escolha.codigo)
      : territorio.regioes.find((item) => item.municipios.some((presenca) => presenca.municipio.codigo === escolha.codigo));
  const presenca = escolha.tipo === "municipio" ? territorio.municipios.get(escolha.codigo) : undefined;
  const municipioSemCliente = escolha.tipo === "municipio" && !presenca;
  const clientes = (presenca ? presenca.clientes : (regiao?.municipios.flatMap((item) => item.clientes) ?? [])).slice().sort((a, b) => b.faturamento12m - a.faturamento12m);
  const titulo = escolha.tipo === "regiao" ? (regiao?.regiao.nome ?? "") : (presenca?.municipio.nome ?? "Município sem cliente");
  return (
    <Cartao
      titulo={titulo}
      icone={escolha.tipo === "regiao" ? MapPinned : Users}
      subtitulo={escolha.tipo === "regiao" ? "Região imediata do IBGE" : regiao ? `Região de ${regiao.regiao.nome}` : undefined}
      acoes={
        <button type="button" className={botoes.icone} onClick={aoFechar} aria-label={`Fechar ${titulo}`}>
          <X size={18} aria-hidden="true" />
        </button>
      }
    >
      {escolha.tipo === "regiao" && regiao ? <NumerosDaRegiao regiao={regiao} /> : null}
      {municipioSemCliente ? (
        <p className={estilos.vazio}>Nenhum cliente da carteira neste município ainda.</p>
      ) : (
        <TabelaResponsiva
          descricao={`Clientes de ${titulo}`}
          itens={clientes}
          chaveDe={(cliente) => cliente.codigo}
          linkDe={(cliente) => `/clientes/${cliente.codigo}`}
          vazio={regiao ? `Nenhum cliente da carteira nesta região: ${formatarCompacto(regiao.populacao)} habitantes para conquistar.` : "Nenhum cliente."}
          ordemInicial={{ coluna: "Faturado 12 meses", sentido: "decrescente" }}
          parametroDaOrdem="ordem-mapa"
          colunas={[
            { titulo: "Cliente", ordenarPor: (cliente) => cliente.nome, celula: (cliente) => <Identificacao titulo={cliente.nome} detalhe={`${cliente.cidade}/${cliente.uf}`} /> },
            { titulo: "Situação", ordenarPor: (cliente) => cliente.situacao, celula: (cliente) => <SituacaoCliente situacao={cliente.situacao} /> },
            { titulo: "Faturado 12 meses", numerica: true, largura: 8, ordenarPor: (cliente) => cliente.faturamento12m, celula: (cliente) => <Valor valor={cliente.faturamento12m} /> },
            { titulo: "Última compra", ordenarPor: (cliente) => cliente.ultimaCompra, celula: (cliente) => <DataRelativa data={cliente.ultimaCompra} hoje={hoje} /> },
          ]}
        />
      )}
    </Cartao>
  );
}

function NumerosDaRegiao({ regiao }: { regiao: RegiaoNoTerritorio }) {
  return (
    <dl className={estilos.numeros}>
      <div>
        <dt>Habitantes</dt>
        <dd>{formatarCompacto(regiao.populacao)}</dd>
      </div>
      <div>
        <dt>Faturado em 12 meses</dt>
        <dd>
          <Valor valor={regiao.receita} compacto />
        </dd>
      </div>
      <div>
        <dt>Na sua média por habitante</dt>
        <dd>
          <Valor valor={regiao.potencial} compacto />
        </dd>
      </div>
      <div>
        <dt>A recuperar por mês</dt>
        <dd>{regiao.aRecuperarPorMes > 0 ? <Valor valor={regiao.aRecuperarPorMes} compacto comoPerda /> : "—"}</dd>
      </div>
    </dl>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo="Mapa" />
      <p className={estilos.vazio}>{texto}</p>
    </div>
  );
}

/** Os estados da carteira, do que tem mais clientes ao que tem menos; só os clientes com município contam. */
function ufsDaCarteira(clientes: readonly ClienteResumo[]): { uf: string; clientes: number }[] {
  const porUf = new Map<string, number>();
  for (const cliente of clientes) if (cliente.municipio) porUf.set(cliente.uf, (porUf.get(cliente.uf) ?? 0) + 1);
  return [...porUf.entries()].map(([uf, quantos]) => ({ uf, clientes: quantos })).sort((a, b) => b.clientes - a.clientes);
}

function visaoDa(mapa: MapaDaUf, escolha: Escolha | null): Caixa {
  const regiao = escolha?.tipo === "regiao" ? mapa.regioes.find((item) => item.codigo === escolha.codigo) : undefined;
  const [x0, y0, x1, y1] = regiao?.caixa ?? mapa.caixa;
  const folga = Math.max(x1 - x0, y1 - y0) * FOLGA_DA_VISAO;
  return [x0 - folga, y0 - folga, x1 + folga, y1 + folga];
}

/** Só as regiões da área ganham classe: a de fora fica com a cor de fundo dos municípios. */
function classesDasRegioes(territorio: Territorio): Map<string, number> {
  const daArea = territorio.regioes.filter((regiao) => regiao.isDaArea);
  const lacunas = daArea.map((regiao) => regiao.lacuna);
  return new Map(daArea.map((regiao) => [regiao.regiao.codigo, classeDaLacuna(regiao.lacuna, lacunas)]));
}

function circulosDa(territorio: Territorio, lente: Lente): CirculoDoMapa[] {
  return [...territorio.municipios.values()].map((presenca) => ({
    municipio: presenca.municipio,
    valor: lente === "receita" ? presenca.receita : presenca.aRecuperarPorMes,
  }));
}

function rotulosDa(territorio: Territorio, lente: Lente): MunicipioDoMapa[] {
  return circulosDa(territorio, lente)
    .filter((circulo) => circulo.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, MUNICIPIOS_COM_NOME)
    .map((circulo) => circulo.municipio);
}
