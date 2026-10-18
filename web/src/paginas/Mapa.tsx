import { useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router";
import { Check, ChevronDown, ChevronUp, Info, LocateFixed, Map as IconeDoMapa, MapPinned, Plus, Users, X } from "lucide-react";
import { unidadesDoMapa, type Caixa, type MapaDaUf, type MunicipioDoMapa, type Ponto } from "dominio/mapa";
import botoes from "../componentes/Botao.module.css";
import { CabecalhoPagina } from "../componentes/CabecalhoPagina";
import { Cartao } from "../componentes/Cartao";
import { DataRelativa } from "../componentes/Quando";
import { Segmentos } from "../componentes/Segmentos";
import { Identificacao, TabelaResponsiva } from "../componentes/TabelaResponsiva";
import { Valor } from "../componentes/Valor";
import { carregarAnalises, carregarClientes, carregarSituacaoDosDados, carregarVisitas } from "../dados/api";
import { acoesDaCarteira, montarTerritorio, type Territorio } from "../dados/mapa";
import { carregarMapaDaUf, carregarMapaDoBrasil } from "../dados/mapas";
import type { ClienteResumo } from "../dados/tipos";
import { useCarga } from "../dados/useCarga";
import { municipioMaisPerto, ordenarParadas, pertoDe } from "../dados/viagem";
import { formatarCompacto, formatarContagem } from "../formato";
import { MapaDoTerritorio, type CirculoDoMapa } from "../graficos/MapaDoTerritorio";
import { Carregando } from "./Carregando";
import { ESQUECIDAS } from "./mapa/Esquecidas";
import type { ContextoDaLente, ItemDaLista, LenteDoMapa } from "./mapa/lente";
import { ONDE_AGIR } from "./mapa/OndeAgir";
import { ONDE_CRESCER } from "./mapa/OndeCrescer";
import { PertoDeVoce, RAIO_DO_PERTO_KM, useLocalizacao } from "./mapa/PertoDeMim";
import { RECEITA } from "./mapa/Receita";
import { CartaoDoRoteiro, useRoteiro, type ParadaNoMapa } from "./mapa/Roteiro";
import estilos from "./Mapa.module.css";

/*
 * O mapa da carteira, por estado. A função dele é responder "para onde eu vou, e o que faço lá?", e,
 * a médio prazo, "como está meu território?". Cada visão (paginas/mapa) dá os números, o desenho, a
 * legenda e a lista dela; esta página monta o resto igual, com o "Perto de mim" e o roteiro.
 */

const LENTES = { agir: ONDE_AGIR, receita: RECEITA, esquecidas: ESQUECIDAS, crescer: ONDE_CRESCER } as const satisfies Record<string, LenteDoMapa>;
type ChaveDaLente = keyof typeof LENTES;
const PADRAO: ChaveDaLente = "agir";
const OPCOES = (Object.keys(LENTES) as ChaveDaLente[]).map((chave) => ({ valor: chave, rotulo: LENTES[chave].rotulo }));

type Escolha = { uf: string; tipo: "regiao" | "municipio"; codigo: string };

/** Quantos municípios, dos que mais pesam, têm o nome escrito no mapa. */
const MUNICIPIOS_COM_NOME = 5;
/** Quantas linhas a lista mostra antes do "Ver todas": cabem na altura do mapa ao lado. */
const LINHAS_DA_LISTA = 8;
/** A folga em volta do estado ou da região, para o contorno não encostar na borda. */
const FOLGA_DA_VISAO = 0.06;

export function Mapa() {
  const { dados: clientes } = useCarga("clientes", carregarClientes);
  const { dados: analises } = useCarga("analises", carregarAnalises);
  const { dados: situacao } = useCarga("situacao", carregarSituacaoDosDados);
  const { dados: visitas } = useCarga("visitas", carregarVisitas);
  const { dados: brasil, erro: erroDoBrasil } = useCarga("mapa:brasil", carregarMapaDoBrasil);
  // O mapa põe cada CNPJ no seu município: o grupo, que não tem cidade, entra pelos CNPJs dele.
  const cnpjs = useMemo(() => (clientes ?? []).flatMap((cliente) => cliente.cnpjs ?? [cliente]), [clientes]);
  const ufs = useMemo(() => ufsDaCarteira(cnpjs), [cnpjs]);
  const acoes = useMemo(
    () => (clientes && analises && situacao ? acoesDaCarteira(clientes, analises, situacao.hoje) : new Map()),
    [clientes, analises, situacao],
  );
  const { dados: mapas, erro: erroDosMapas } = useCarga(`mapa:${ufs.map(({ uf }) => uf).join(",")}`, () =>
    Promise.all(ufs.map(({ uf }) => carregarMapaDaUf(uf))),
  );
  // Os municípios com cliente de todos os estados da carteira: o "perto" e o roteiro passam das divisas.
  const presencas = useMemo(
    () =>
      (mapas ?? []).flatMap((umMapa) => [...montarTerritorio(umMapa, cnpjs, acoes, visitas ?? {}).municipios.values()].map((presenca) => ({ ...presenca, uf: umMapa.uf }))),
    [mapas, cnpjs, acoes, visitas],
  );
  const [parametros, setParametros] = useSearchParams();
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const roteiro = useRoteiro();
  const alterar = (nome: string, valor: string, padrao: string) => {
    const proximos = new URLSearchParams(parametros);
    if (valor === padrao) proximos.delete(nome);
    else proximos.set(nome, valor);
    setParametros(proximos, { replace: true });
  };
  const { localizacao, buscar, esquecer } = useLocalizacao((posicao) => {
    // O mapa vai para o estado de onde o aparelho está, se ele for da carteira.
    const perto = municipioMaisPerto(posicao, mapas ?? []);
    if (perto && perto.uf !== parametros.get("uf")) alterar("uf", perto.uf, ufs[0]?.uf ?? "");
    setEscolha(null);
  });

  if (erroDoBrasil || erroDosMapas) return <Aviso texto="O mapa não carregou. Recarregue a página para tentar de novo." />;
  if (!clientes || !analises || !situacao || !visitas || !brasil || !mapas) return <Carregando />;
  if (ufs.length === 0) return <Aviso texto="Nenhum cliente da carteira tem o município no cadastro da Suprens." />;

  const chave = chaveDaLente(parametros.get("visao"));
  const lente: LenteDoMapa = LENTES[chave];
  const uf = ufs.find((item) => item.uf === parametros.get("uf"))?.uf ?? ufs[0]?.uf ?? "";
  const mapa = mapas.find((item) => item.uf === uf);
  if (!mapa) return <Carregando />;
  const territorio = montarTerritorio(mapa, cnpjs, acoes, visitas);
  const contexto: ContextoDaLente = { territorio, hoje: situacao.hoje, visitas };
  const circulos = lente.circulos(territorio);
  const semMunicipio = cnpjs.filter((cliente) => !cliente.municipio).length;
  const escolhaDoEstado = escolha?.uf === uf ? escolha : null;
  const posicao = localizacao.estado === "achou" ? localizacao.posicao : null;
  const paradas = ordenarParadas(paradasDoRoteiro(roteiro.codigos, mapas, presencas), posicao);
  const escolherMunicipio = (codigo: string, ufDoMunicipio: string) => {
    if (ufDoMunicipio !== uf) alterar("uf", ufDoMunicipio, ufs[0]?.uf ?? "");
    setEscolha({ uf: ufDoMunicipio, tipo: "municipio", codigo });
  };

  return (
    <div className={estilos.pagina}>
      <CabecalhoPagina titulo="Mapa" descricao="Para onde ir, de onde vem a receita e onde ainda dá para crescer" />
      <div className={estilos.controles}>
        <div className={estilos.grupoDeControles}>
          <Segmentos rotulo="O que o mapa mostra" opcoes={OPCOES} selecionado={chave} aoEscolher={(valor) => alterar("visao", valor, PADRAO)} />
          <button
            type="button"
            className={botoes.secundario}
            onClick={buscar}
            disabled={localizacao.estado === "buscando"}
            aria-pressed={localizacao.estado === "achou"}
          >
            <LocateFixed size={16} aria-hidden="true" />
            {localizacao.estado === "buscando" ? "Procurando…" : "Perto de mim"}
          </button>
        </div>
        {ufs.length > 1 ? (
          <Segmentos
            rotulo="Estado"
            opcoes={ufs.map(({ uf: sigla, clientes: quantos }) => ({ valor: sigla, rotulo: sigla, contagem: quantos }))}
            selecionado={uf}
            aoEscolher={(valor) => alterar("uf", valor, ufs[0]?.uf ?? "")}
          />
        ) : null}
      </div>
      {localizacao.estado === "erro" ? (
        <p className={estilos.aviso} role="alert">
          <Info size={15} aria-hidden="true" />
          {localizacao.mensagem}
        </p>
      ) : null}
      {semMunicipio > 0 ? (
        <p className={estilos.aviso}>
          <Info size={15} aria-hidden="true" />
          {formatarContagem(semMunicipio, "cliente da carteira está", "clientes da carteira estão")} sem o município no cadastro e{" "}
          {semMunicipio === 1 ? "fica" : "ficam"} fora do mapa.
        </p>
      ) : null}
      <lente.Indicadores {...contexto} />
      <div className={estilos.principal}>
        <Cartao
          titulo={territorio.nome}
          icone={IconeDoMapa}
          subtitulo={lente.subtitulo}
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
            descricao={`Mapa de ${territorio.nome}: ${lente.subtitulo}`}
            brasil={brasil}
            mapas={mapas}
            uf={uf}
            visao={visaoDa(mapa, escolhaDoEstado, posicao)}
            classes={lente.classes(contexto)}
            comCliente={new Set(cnpjs.flatMap((cliente) => (cliente.municipio ? [cliente.municipio] : [])))}
            circulos={circulos}
            rotulos={rotulosDe(circulos)}
            municipioEscolhido={escolhaDoEstado?.tipo === "municipio" ? escolhaDoEstado.codigo : null}
            regiaoEscolhida={escolhaDoEstado?.tipo === "regiao" ? escolhaDoEstado.codigo : null}
            posicao={posicao}
            roteiro={paradas.map(({ municipio }) => municipio)}
            dicaDe={(municipio) => <DicaDoMunicipio municipio={municipio} lente={lente} contexto={contexto} />}
            aoEscolher={(municipio) => setEscolha({ uf, tipo: "municipio", codigo: municipio.codigo })}
          />
          <lente.Legenda {...contexto} />
        </Cartao>
        {posicao ? (
          <PertoDeVoce
            lugares={pertoDe(posicao, presencas, RAIO_DO_PERTO_KM)}
            ufAtual={uf}
            isNoRoteiro={roteiro.isNoRoteiro}
            isRoteiroCheio={roteiro.isCheio}
            alternarNoRoteiro={(lugar) => roteiro.alternar(lugar.municipio.codigo)}
            aoEscolher={(lugar) => escolherMunicipio(lugar.municipio.codigo, lugar.uf)}
            aoFechar={esquecer}
          />
        ) : (
          <Lista
            key={`${chave}:${uf}`}
            lente={lente}
            contexto={contexto}
            escolhido={escolhaDoEstado?.codigo ?? null}
            aoEscolher={({ tipo, codigo }) => setEscolha({ uf, tipo, codigo })}
          />
        )}
      </div>
      {paradas.length > 0 ? (
        <CartaoDoRoteiro
          paradas={paradas}
          partida={posicao}
          aoTirar={roteiro.alternar}
          aoLimpar={roteiro.limpar}
          aoEscolher={(parada) => escolherMunicipio(parada.municipio.codigo, parada.uf)}
        />
      ) : null}
      {escolhaDoEstado ? (
        <DetalheDaEscolha
          escolha={escolhaDoEstado}
          lente={lente}
          contexto={contexto}
          roteiro={roteiro}
          aoFechar={() => setEscolha(null)}
        />
      ) : null}
    </div>
  );
}

function chaveDaLente(valor: string | null): ChaveDaLente {
  return valor !== null && valor in LENTES ? (valor as ChaveDaLente) : PADRAO;
}

type PropsDaLista = { lente: LenteDoMapa; contexto: ContextoDaLente; escolhido: string | null; aoEscolher: (item: ItemDaLista) => void };

/** A lista que acompanha o mapa, na ordem da visão; a linha escolhida é a que o mapa aproxima. */
function Lista({ lente, contexto, escolhido, aoEscolher }: PropsDaLista) {
  const [isCompleta, setIsCompleta] = useState(false);
  const itens = lente.itens(contexto);
  const { titulo, icone, subtitulo, barra, vazio } = lente.lista;
  return (
    <Cartao titulo={titulo} icone={icone} subtitulo={subtitulo} className={estilos.cartaoDoRanking}>
      {itens.length === 0 ? (
        <p className={estilos.vazio}>{vazio(contexto)}</p>
      ) : (
        <ol className={estilos.ranking}>
          {(isCompleta ? itens : itens.slice(0, LINHAS_DA_LISTA)).map((item) => (
            <li key={item.codigo}>
              <button
                type="button"
                className={estilos.itemDoRanking}
                aria-pressed={item.codigo === escolhido}
                onClick={() => aoEscolher(item)}
                style={{ "--parte": item.parte } as CSSProperties}
              >
                <span className={estilos.nomeDaRegiao}>{item.nome}</span>
                <span className={estilos.valorDaRegiao}>{item.valor}</span>
                <span className={`${estilos.barra} ${barra}`} aria-hidden="true" />
                <span className={estilos.detalheDaRegiao}>{item.detalhe}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {itens.length > LINHAS_DA_LISTA ? (
        <button type="button" className={estilos.verTodas} aria-expanded={isCompleta} onClick={() => setIsCompleta(!isCompleta)}>
          {isCompleta ? `Ver só as ${LINHAS_DA_LISTA} primeiras` : `Ver todas (${itens.length})`}
          {isCompleta ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        </button>
      ) : null}
    </Cartao>
  );
}

/** O que toda dica tem (o nome, o faturado e a região) em volta do que é só da visão. */
function DicaDoMunicipio({ municipio, lente, contexto }: { municipio: MunicipioDoMapa; lente: LenteDoMapa; contexto: ContextoDaLente }) {
  const presenca = contexto.territorio.municipios.get(municipio.codigo);
  const regiao = contexto.territorio.regioes.find((item) => item.regiao.codigo === municipio.regiao);
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
      <lente.Dica {...contexto} municipio={municipio} />
      {presenca?.ultimaVisita ? (
        <p className={estilos.linhaDaDica}>
          Sua última visita: <DataRelativa data={presenca.ultimaVisita} hoje={contexto.hoje} />
        </p>
      ) : null}
      {regiao ? <p className={estilos.regiaoDaDica}>Região de {regiao.regiao.nome}</p> : null}
    </>
  );
}

type PropsDoDetalhe = {
  escolha: Escolha;
  lente: LenteDoMapa;
  contexto: ContextoDaLente;
  roteiro: Pick<ReturnType<typeof useRoteiro>, "isNoRoteiro" | "isCheio" | "alternar">;
  aoFechar: () => void;
};

/**
 * A região ou o município escolhido: o que a visão diz dele e os clientes, cada um com o caminho para
 * a ficha. O município também entra e sai do roteiro daqui.
 */
function DetalheDaEscolha({ escolha, lente, contexto, roteiro, aoFechar }: PropsDoDetalhe) {
  const { territorio } = contexto;
  const regiao =
    escolha.tipo === "regiao"
      ? territorio.regioes.find((item) => item.regiao.codigo === escolha.codigo)
      : territorio.regioes.find((item) => item.regiao.codigo === municipioDaEscolha(territorio, escolha)?.regiao);
  const presenca = escolha.tipo === "municipio" ? territorio.municipios.get(escolha.codigo) : undefined;
  const clientes = (presenca ? presenca.clientes : (regiao?.municipios.flatMap((item) => item.clientes) ?? []))
    .slice()
    .sort((a, b) => b.faturamento12m - a.faturamento12m);
  const titulo = escolha.tipo === "regiao" ? (regiao?.regiao.nome ?? "") : (municipioDaEscolha(territorio, escolha)?.nome ?? "Município");
  return (
    <Cartao
      titulo={titulo}
      icone={escolha.tipo === "regiao" ? MapPinned : Users}
      subtitulo={escolha.tipo === "regiao" ? "Região imediata do IBGE" : regiao ? `Região de ${regiao.regiao.nome}` : undefined}
      acoes={
        <>
          {escolha.tipo === "municipio" ? (
            <button
              type="button"
              className={botoes.secundario}
              onClick={() => roteiro.alternar(escolha.codigo)}
              disabled={!roteiro.isNoRoteiro(escolha.codigo) && roteiro.isCheio}
              aria-pressed={roteiro.isNoRoteiro(escolha.codigo)}
            >
              {roteiro.isNoRoteiro(escolha.codigo) ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {roteiro.isNoRoteiro(escolha.codigo) ? "No roteiro" : roteiro.isCheio ? "Roteiro cheio" : "Pôr no roteiro"}
            </button>
          ) : null}
          <button type="button" className={botoes.icone} onClick={aoFechar} aria-label={`Fechar ${titulo}`}>
            <X size={18} aria-hidden="true" />
          </button>
        </>
      }
    >
      {escolha.tipo === "regiao" && regiao && lente.SobreARegiao ? <lente.SobreARegiao {...contexto} regiao={regiao} /> : null}
      <TabelaResponsiva
        descricao={`Clientes de ${titulo}`}
        itens={clientes}
        chaveDe={(cliente) => cliente.codigo}
        linkDe={(cliente) => `/clientes/${cliente.codigo}`}
        vazio={vazioDaEscolha(escolha, regiao?.populacao)}
        ordemInicial={lente.ordemInicial}
        parametroDaOrdem="ordem-mapa"
        colunas={[
          { titulo: "Cliente", ordenarPor: (cliente) => cliente.nome, celula: (cliente) => <Identificacao titulo={cliente.nome} detalhe={`${cliente.cidade}/${cliente.uf}`} /> },
          ...lente.colunas(contexto),
        ]}
      />
    </Cartao>
  );
}

function municipioDaEscolha(territorio: Territorio, escolha: Escolha): MunicipioDoMapa | undefined {
  if (escolha.tipo !== "municipio") return undefined;
  return (
    territorio.municipios.get(escolha.codigo)?.municipio ??
    territorio.regioes.flatMap(({ semCliente }) => semCliente).find((municipio) => municipio.codigo === escolha.codigo)
  );
}

function vazioDaEscolha(escolha: Escolha, populacao: number | undefined): string {
  if (escolha.tipo === "municipio") return "Nenhum cliente da carteira neste município ainda.";
  return populacao ? `Nenhum cliente da carteira nesta região: ${formatarCompacto(populacao)} habitantes para conquistar.` : "Nenhum cliente.";
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

/** A parte do mapa à vista: a região escolhida, a volta do aparelho no "Perto de mim" ou o estado todo. */
function visaoDa(mapa: MapaDaUf, escolha: Escolha | null, posicao: Ponto | null): Caixa {
  const regiao = escolha?.tipo === "regiao" ? mapa.regioes.find((item) => item.codigo === escolha.codigo) : undefined;
  if (!regiao && posicao) {
    const raio = unidadesDoMapa(RAIO_DO_PERTO_KM, posicao[1]);
    return [posicao[0] - raio, posicao[1] - raio, posicao[0] + raio, posicao[1] + raio];
  }
  const [x0, y0, x1, y1] = regiao?.caixa ?? mapa.caixa;
  const folga = Math.max(x1 - x0, y1 - y0) * FOLGA_DA_VISAO;
  return [x0 - folga, y0 - folga, x1 + folga, y1 + folga];
}

/** As cidades do roteiro que estão nos mapas carregados, com o que a carteira tem nelas. */
function paradasDoRoteiro(codigos: readonly string[], mapas: readonly MapaDaUf[], presencas: readonly ParadaNoMapa["presenca"][]): ParadaNoMapa[] {
  return codigos.flatMap((codigo) =>
    mapas.flatMap((umMapa) => {
      const municipio = umMapa.municipios.find((candidato) => candidato.codigo === codigo);
      return municipio ? [{ municipio, uf: umMapa.uf, presenca: presencas.find((presenca) => presenca?.municipio.codigo === codigo) }] : [];
    }),
  );
}

/** O nome vai ao lado dos maiores círculos com valor. */
function rotulosDe(circulos: readonly CirculoDoMapa[]): MunicipioDoMapa[] {
  return circulos
    .filter(({ valor }) => valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, MUNICIPIOS_COM_NOME)
    .map(({ municipio }) => municipio);
}
