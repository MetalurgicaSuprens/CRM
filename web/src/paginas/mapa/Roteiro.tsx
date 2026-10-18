import { useState } from "react";
import { ExternalLink, Route, Trash2, X } from "lucide-react";
import type { Ponto } from "dominio/mapa";
import botoes from "../../componentes/Botao.module.css";
import { Cartao } from "../../componentes/Cartao";
import type { MunicipioNoTerritorio } from "../../dados/mapa";
import { gravarRoteiro, lerRoteiro, linkDoGoogleMaps, PARADAS_NO_ROTEIRO, trechosDoRoteiro, type Parada } from "../../dados/viagem";
import { formatarNumero } from "../../formato";
import estilos from "../Mapa.module.css";
import { descreverAcoes } from "./OndeAgir";

/*
 * O roteiro da viagem: as cidades que o representante pôs nele, na ordem que dá menos estrada, e o link
 * para o Google Maps. Fica só neste aparelho (dados/viagem.ts).
 */

/** Os códigos das cidades do roteiro, gravados no aparelho a cada mudança. */
export function useRoteiro() {
  const [codigos, setCodigos] = useState<string[]>(lerRoteiro);
  const mudar = (proximos: string[]) => {
    gravarRoteiro(proximos);
    setCodigos(proximos);
  };
  const isNoRoteiro = (codigo: string) => codigos.includes(codigo);
  return {
    codigos,
    isNoRoteiro,
    isCheio: codigos.length >= PARADAS_NO_ROTEIRO,
    alternar: (codigo: string) => {
      if (isNoRoteiro(codigo)) mudar(codigos.filter((outro) => outro !== codigo));
      else if (codigos.length < PARADAS_NO_ROTEIRO) mudar([...codigos, codigo]);
    },
    limpar: () => mudar([]),
  };
}

/** A parada com o que a carteira tem na cidade, para dizer o que fazer lá. */
export type ParadaNoMapa = Parada & { presenca: MunicipioNoTerritorio | undefined };

type Props = {
  /** Já na ordem da viagem (ordenarParadas). */
  paradas: readonly ParadaNoMapa[];
  partida: Ponto | null;
  aoTirar: (codigo: string) => void;
  aoLimpar: () => void;
  aoEscolher: (parada: ParadaNoMapa) => void;
};

export function CartaoDoRoteiro({ paradas, partida, aoTirar, aoLimpar, aoEscolher }: Props) {
  const trechos = trechosDoRoteiro(paradas, partida);
  const total = trechos.reduce((soma, trecho) => soma + trecho, 0);
  const link = linkDoGoogleMaps(paradas);
  return (
    <Cartao
      titulo="Roteiro"
      icone={Route}
      subtitulo={partida ? "Daqui, sempre para a cidade mais perto que falta" : "Da primeira cidade escolhida, sempre para a mais perto que falta"}
      acoes={
        <button type="button" className={botoes.secundario} onClick={aoLimpar}>
          <Trash2 size={16} aria-hidden="true" />
          Limpar
        </button>
      }
    >
      <ol className={estilos.paradas}>
        {paradas.map((parada, i) => (
          <li key={parada.municipio.codigo} className={estilos.paradaDoRoteiro}>
            <span className={estilos.numeroDaParada} aria-hidden="true">
              {i + 1}
            </span>
            <button type="button" className={estilos.nomeDaParada} onClick={() => aoEscolher(parada)}>
              <strong>
                {parada.municipio.nome}/{parada.uf}
              </strong>
              <span>
                {(trechos[i] ?? 0) > 0 ? `+${formatarNumero(Math.round(trechos[i] ?? 0))} km` : "partida"} ·{" "}
                {parada.presenca ? descreverAcoes(parada.presenca.acoes) : "sem cliente da carteira"}
              </span>
            </button>
            <button type="button" className={botoes.icone} onClick={() => aoTirar(parada.municipio.codigo)} aria-label={`Tirar ${parada.municipio.nome} do roteiro`}>
              <X size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className={estilos.rodapeDoRoteiro}>
        <span>
          Cerca de {formatarNumero(Math.round(total))} km em linha reta{partida ? ", saindo daqui" : ""}
        </span>
        {link ? (
          <a className={botoes.primario} href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Abrir no Google Maps
          </a>
        ) : null}
      </div>
      <p className={estilos.notaDaPosicao}>O roteiro fica só neste aparelho. O Google recebe só os nomes das cidades e parte de onde o aparelho estiver.</p>
    </Cartao>
  );
}
