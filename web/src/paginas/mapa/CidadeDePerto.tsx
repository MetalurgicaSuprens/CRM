import type { ReactNode } from "react";
import { Link } from "react-router";
import { ExternalLink, FileText, MapPin, X } from "lucide-react";
import botoes from "../../componentes/Botao.module.css";
import { Cartao } from "../../componentes/Cartao";
import { DataRelativa } from "../../componentes/Quando";
import { Valor } from "../../componentes/Valor";
import type { ClienteNoMapa } from "../../dados/cidade";
import type { AcoesDoCliente } from "../../dados/mapa";
import { linkDoEnderecoNoGoogleMaps } from "../../dados/viagem";
import { formatarContagem, formatarEndereco } from "../../formato";
import estilos from "../Mapa.module.css";
import { Motivo } from "./OndeAgir";

/*
 * A cidade de perto: a legenda dos pontos dos clientes, a dica de cada um e o cartão do cliente
 * escolhido no mapa, com o caminho para a ficha e para o Google Maps.
 */

/** O que o ponto de cada cliente quer dizer, e quantos da cidade ficaram sem ponto. */
export function LegendaDosClientes({ semPonto }: { semPonto: number }) {
  return (
    <div className={estilos.legenda}>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="critico" aria-hidden="true" />
        parado
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="atencao" aria-hidden="true" />
        comprando menos ou passou do ciclo
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="oportunidade" aria-hidden="true" />
        mix para oferecer ou cliente novo
      </span>
      <span className={estilos.itemDaLegenda}>
        <span className={estilos.bolinha} data-tom="em_dia" aria-hidden="true" />
        em dia
      </span>
      <span className={estilos.itemDaLegenda}>o tamanho é o faturado em 12 meses</span>
      {semPonto > 0 ? (
        <span className={estilos.itemDaLegenda}>
          {formatarContagem(semPonto, "cliente sem ponto", "clientes sem ponto")}: pessoa física ou endereço que o IBGE não achou
        </span>
      ) : null}
    </div>
  );
}

export function DicaDoCliente({ cliente: { cliente }, acoes }: { cliente: ClienteNoMapa; acoes: AcoesDoCliente | undefined }) {
  return (
    <>
      <p className={estilos.tituloDaDica}>{cliente.nome}</p>
      <p className={estilos.linhaDaDica}>
        <Motivo acoes={acoes} />
      </p>
      <p className={estilos.linhaDaDica}>
        <Valor valor={cliente.faturamento12m} compacto /> em 12 meses
      </p>
      {cliente.endereco ? <p className={estilos.regiaoDaDica}>{formatarEndereco(cliente.endereco)}</p> : null}
    </>
  );
}

type PropsDoCartao = {
  cliente: ClienteNoMapa;
  acoes: AcoesDoCliente | undefined;
  hoje: string;
  /** O botão do roteiro, que a página monta. */
  noRoteiro: ReactNode;
  aoFechar: () => void;
};

/** O cliente que o representante tocou no mapa, ao lado dele: o que pede ação, o endereço e os caminhos. */
export function CartaoDoCliente({ cliente: { cliente }, acoes, hoje, noRoteiro, aoFechar }: PropsDoCartao) {
  const { endereco } = cliente;
  return (
    <Cartao
      titulo={cliente.nome}
      icone={MapPin}
      subtitulo={endereco ? formatarEndereco(endereco) : `${cliente.cidade}/${cliente.uf}`}
      className={estilos.cartaoDoRanking}
      acoes={
        <button type="button" className={botoes.icone} onClick={aoFechar} aria-label={`Fechar ${cliente.nome}`}>
          <X size={18} aria-hidden="true" />
        </button>
      }
    >
      <dl className={`${estilos.numeros} ${estilos.numerosDoCliente}`}>
        <div>
          <dt>Motivo</dt>
          <dd>
            <Motivo acoes={acoes} />
          </dd>
        </div>
        <div>
          <dt>Faturado em 12 meses</dt>
          <dd>
            <Valor valor={cliente.faturamento12m} compacto />
          </dd>
        </div>
        <div>
          <dt>Última compra</dt>
          <dd>
            <DataRelativa data={cliente.ultimaCompra} hoje={hoje} />
          </dd>
        </div>
      </dl>
      <div className={estilos.acoesDoCliente}>
        <Link className={botoes.secundario} to={`/clientes/${cliente.codigo}`}>
          <FileText size={16} aria-hidden="true" />
          Abrir a ficha
        </Link>
        {noRoteiro}
        {endereco ? (
          <a className={botoes.secundario} href={linkDoEnderecoNoGoogleMaps(endereco, cliente.cidade, cliente.uf)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Google Maps
          </a>
        ) : null}
      </div>
      {endereco?.ponto && endereco.ponto.precisao !== "numero" ? (
        <p className={estilos.notaDaPosicao}>
          O ponto é aproximado: {endereco.ponto.precisao === "rua" ? "o IBGE não tem este número; ele fica no número mais perto da rua" : "o IBGE não achou a rua; ele fica no meio do CEP"}.
        </p>
      ) : null}
    </Cartao>
  );
}
