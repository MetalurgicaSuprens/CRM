import { useState } from "react";
import { Check, ExternalLink, Plus, Route, Trash2, X } from "lucide-react";
import type { Ponto } from "dominio/mapa";
import botoes from "../../componentes/Botao.module.css";
import { Cartao } from "../../componentes/Cartao";
import { gravidadeDoCliente, type AcoesDoCliente, type MunicipioNoTerritorio } from "../../dados/mapa";
import { codigoDaParada, gravarRoteiro, lerRoteiro, linkDoGoogleMaps, PARADAS_NO_ROTEIRO, trechosDoRoteiro, type Parada } from "../../dados/viagem";
import { formatarNumero } from "../../formato";
import estilos from "../Mapa.module.css";
import { descreverAcoes, descreverMotivo } from "./OndeAgir";

/*
 * O roteiro da viagem: os clientes e as cidades que o representante pôs nele, na ordem que dá menos
 * estrada, e o link para o Google Maps. Fica só neste aparelho (dados/viagem.ts).
 */

/** As paradas do roteiro (o id do cliente ou o código da cidade), gravadas no aparelho a cada mudança. */
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

export type Roteiro = ReturnType<typeof useRoteiro>;

/** Pôr no roteiro e tirar dele, com o aviso de cheio: o mesmo botão no mapa e na ficha. */
export function BotaoDoRoteiro({ codigo, roteiro }: { codigo: string; roteiro: Pick<Roteiro, "isNoRoteiro" | "isCheio" | "alternar"> }) {
  const isNoRoteiro = roteiro.isNoRoteiro(codigo);
  return (
    <button type="button" className={botoes.secundario} onClick={() => roteiro.alternar(codigo)} disabled={!isNoRoteiro && roteiro.isCheio} aria-pressed={isNoRoteiro}>
      {isNoRoteiro ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
      {isNoRoteiro ? "No roteiro" : roteiro.isCheio ? "Roteiro cheio" : "Pôr no roteiro"}
    </button>
  );
}

/** A parada com o que a carteira tem na cidade, ou as ações do cliente, para dizer o que fazer lá. */
export type ParadaNoMapa = Parada & { presenca: MunicipioNoTerritorio | undefined; acoes?: AcoesDoCliente | undefined };

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
      subtitulo={partida ? "Daqui, sempre para a parada mais perto que falta" : "Da primeira parada escolhida, sempre para a mais perto que falta"}
      acoes={
        <button type="button" className={botoes.secundario} onClick={aoLimpar}>
          <Trash2 size={16} aria-hidden="true" />
          Limpar
        </button>
      }
    >
      <ol className={estilos.paradas}>
        {paradas.map((parada, i) => (
          <li key={codigoDaParada(parada)} className={estilos.paradaDoRoteiro}>
            <span className={estilos.numeroDaParada} aria-hidden="true">
              {i + 1}
            </span>
            <button type="button" className={estilos.nomeDaParada} onClick={() => aoEscolher(parada)}>
              <strong>{parada.cliente ? parada.cliente.nome : `${parada.municipio.nome}/${parada.uf}`}</strong>
              <span>
                {(trechos[i] ?? 0) > 0 ? `+${formatarNumero(Math.round(trechos[i] ?? 0))} km` : "partida"} · {oQueFazer(parada)}
              </span>
            </button>
            <button
              type="button"
              className={botoes.icone}
              onClick={() => aoTirar(codigoDaParada(parada))}
              aria-label={`Tirar ${parada.cliente?.nome ?? parada.municipio.nome} do roteiro`}
            >
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
      <p className={estilos.notaDaPosicao}>
        O roteiro fica só neste aparelho. O Google recebe o endereço de cada cliente e o nome de cada cidade, sem a sua posição: ele parte de onde o aparelho estiver.
      </p>
    </Cartao>
  );
}

/** No cliente, a cidade e o motivo; na cidade, o que a carteira pede lá. */
function oQueFazer({ cliente, acoes, municipio, uf, presenca }: ParadaNoMapa): string {
  if (cliente) return `${municipio.nome}/${uf} · ${acoes && gravidadeDoCliente(acoes) ? descreverMotivo(acoes) : "em dia"}`;
  return presenca ? descreverAcoes(presenca.acoes) : "sem cliente da carteira";
}
