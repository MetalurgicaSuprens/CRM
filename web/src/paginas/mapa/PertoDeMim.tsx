import { useState } from "react";
import { Check, Navigation, Plus, X } from "lucide-react";
import { projetar, type Ponto } from "dominio/mapa";
import botoes from "../../componentes/Botao.module.css";
import { Cartao } from "../../componentes/Cartao";
import { Valor } from "../../componentes/Valor";
import type { MunicipioNoTerritorio } from "../../dados/mapa";
import { formatarNumero } from "../../formato";
import estilos from "../Mapa.module.css";
import { descreverAcoes } from "./OndeAgir";

/*
 * "Perto de mim": o aparelho dá a posição, e o mapa mostra as cidades com cliente em volta, com o que
 * pede ação em cada uma. A posição fica só na memória desta aba: não vai ao servidor, não vai para o
 * endereço da página e não é gravada.
 */

/** Até onde o "perto" vai, em km em linha reta. */
export const RAIO_DO_PERTO_KM = 150;
/** Quantas cidades o cartão lista, das mais perto. */
const CIDADES_PERTO = 12;

export type Localizacao = { estado: "parado" } | { estado: "buscando" } | { estado: "achou"; posicao: Ponto } | { estado: "erro"; mensagem: string };

/** A posição da última busca, só na memória da aba: continua ao voltar da ficha e some ao recarregar. */
let ultimaPosicao: Ponto | null = null;

export function useLocalizacao(aoAchar: (posicao: Ponto) => void) {
  const [localizacao, setLocalizacao] = useState<Localizacao>(() => (ultimaPosicao ? { estado: "achou", posicao: ultimaPosicao } : { estado: "parado" }));
  const buscar = () => {
    if (!("geolocation" in navigator)) {
      setLocalizacao({ estado: "erro", mensagem: "Este navegador não dá a localização." });
      return;
    }
    setLocalizacao({ estado: "buscando" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const posicao = projetar(coords.longitude, coords.latitude);
        ultimaPosicao = posicao;
        setLocalizacao({ estado: "achou", posicao });
        aoAchar(posicao);
      },
      (erro) =>
        setLocalizacao({
          estado: "erro",
          mensagem:
            erro.code === erro.PERMISSION_DENIED
              ? "O navegador não deu permissão para a localização. Libere nas configurações dele e tente de novo."
              : "Não deu para achar a localização agora. Tente de novo.",
        }),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  };
  const esquecer = () => {
    ultimaPosicao = null;
    setLocalizacao({ estado: "parado" });
  };
  return { localizacao, buscar, esquecer };
}

export type LugarPerto = MunicipioNoTerritorio & { uf: string; distanciaKm: number };

type Props = {
  lugares: readonly LugarPerto[];
  ufAtual: string;
  isNoRoteiro: (codigo: string) => boolean;
  isRoteiroCheio: boolean;
  alternarNoRoteiro: (lugar: LugarPerto) => void;
  aoEscolher: (lugar: LugarPerto) => void;
  aoFechar: () => void;
};

/** As cidades com cliente em volta do aparelho, da mais perto à mais longe, cada uma com o que pede ação. */
export function PertoDeVoce({ lugares, ufAtual, isNoRoteiro, isRoteiroCheio, alternarNoRoteiro, aoEscolher, aoFechar }: Props) {
  return (
    <Cartao
      titulo="Perto de você"
      icone={Navigation}
      subtitulo={`As cidades com cliente a até ${RAIO_DO_PERTO_KM} km, em linha reta`}
      acoes={
        <button type="button" className={botoes.icone} onClick={aoFechar} aria-label="Sair de Perto de mim">
          <X size={18} aria-hidden="true" />
        </button>
      }
      className={estilos.cartaoDoRanking}
    >
      {lugares.length === 0 ? (
        <p className={estilos.vazio}>Nenhuma cidade com cliente a até {RAIO_DO_PERTO_KM} km daqui.</p>
      ) : (
        <ol className={estilos.ranking}>
          {lugares.slice(0, CIDADES_PERTO).map((lugar) => {
            const isParada = isNoRoteiro(lugar.municipio.codigo);
            return (
              <li key={lugar.municipio.codigo} className={estilos.lugarPerto}>
                <button type="button" className={estilos.itemDoRanking} onClick={() => aoEscolher(lugar)}>
                  <span className={estilos.nomeDaRegiao}>
                    {lugar.municipio.nome}
                    {lugar.uf !== ufAtual ? `/${lugar.uf}` : ""}
                  </span>
                  <span className={estilos.valorDaRegiao}>{formatarNumero(Math.round(lugar.distanciaKm))} km</span>
                  <span className={estilos.detalheDaRegiao}>
                    {lugar.acoes.emJogoPorMes > 0 ? (
                      <>
                        <Valor valor={lugar.acoes.emJogoPorMes} compacto comoPerda /> por mês em jogo ·{" "}
                      </>
                    ) : null}
                    {descreverAcoes(lugar.acoes)}
                  </span>
                </button>
                <button
                  type="button"
                  className={`${botoes.icone} ${estilos.botaoDoRoteiro}`}
                  onClick={() => alternarNoRoteiro(lugar)}
                  disabled={!isParada && isRoteiroCheio}
                  aria-pressed={isParada}
                  aria-label={isParada ? `Tirar ${lugar.municipio.nome} do roteiro` : `Pôr ${lugar.municipio.nome} no roteiro`}
                  title={!isParada && isRoteiroCheio ? "O roteiro já tem 10 cidades" : undefined}
                >
                  {isParada ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className={estilos.notaDaPosicao}>Sua localização fica só neste aparelho: o CRM não a envia nem a guarda.</p>
    </Cartao>
  );
}
