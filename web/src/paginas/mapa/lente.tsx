import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { MunicipioDoMapa } from "dominio/mapa";
import type { Ordem } from "../../componentes/ordenacao";
import { DataRelativa } from "../../componentes/Quando";
import type { ColunaDaTabela } from "../../componentes/TabelaResponsiva";
import type { RegiaoNoTerritorio, Territorio } from "../../dados/mapa";
import type { ClienteResumo, UltimasVisitas } from "../../dados/tipos";
import type { CirculoDoMapa } from "../../graficos/MapaDoTerritorio";

/*
 * O que muda de uma visão do mapa para a outra; a página (paginas/Mapa.tsx) monta o resto igual: os
 * números do alto, o desenho, a legenda, a dica, a lista ao lado e as colunas dos clientes escolhidos.
 */

/** O território do estado, a data da foto e a última visita do login a cada cliente. */
export type ContextoDaLente = { territorio: Territorio; hoje: string; visitas: UltimasVisitas };

/** Uma linha da lista ao lado do mapa: uma região ou um município, que o toque escolhe. */
export type ItemDaLista = {
  tipo: "regiao" | "municipio";
  codigo: string;
  nome: string;
  valor: ReactNode;
  /** De 0 a 1: o tamanho da barra, em relação ao maior da lista. */
  parte: number;
  detalhe: ReactNode;
};

export type LenteDoMapa = {
  rotulo: string;
  /** Embaixo do nome do estado, no cartão do mapa. */
  subtitulo: string;
  lista: {
    titulo: string;
    icone: LucideIcon;
    subtitulo: string;
    /** A classe da cor da barra (Mapa.module.css). */
    barra: string | undefined;
    vazio: (contexto: ContextoDaLente) => string;
  };
  Indicadores: (props: ContextoDaLente) => ReactNode;
  circulos: (territorio: Territorio) => CirculoDoMapa[];
  /** A classe de cor de cada município do estado escolhido (MapaDoTerritorio.module.css). */
  classes: (contexto: ContextoDaLente) => Map<string, string>;
  Legenda: (props: ContextoDaLente) => ReactNode;
  /** As linhas da dica que são só desta visão, entre o faturado do município e a região dele. */
  Dica: (props: ContextoDaLente & { municipio: MunicipioDoMapa }) => ReactNode;
  itens: (contexto: ContextoDaLente) => ItemDaLista[];
  /** Os clientes da região ou do município escolhido: as colunas depois do nome, e a ordem ao abrir. */
  colunas: (contexto: ContextoDaLente) => ColunaDaTabela<ClienteResumo>[];
  ordemInicial: Ordem;
  /** Na região escolhida, o que vem antes dos clientes dela. */
  SobreARegiao?: (props: ContextoDaLente & { regiao: RegiaoNoTerritorio }) => ReactNode;
};

/** A coluna da última visita do login, nas listas de clientes que pedem viagem. */
export function colunaDaVisita({ visitas, hoje }: ContextoDaLente): ColunaDaTabela<ClienteResumo> {
  return {
    titulo: "Última visita",
    ordenarPor: (cliente) => visitas[cliente.codigo] ?? null,
    celula: (cliente) => <DataRelativa data={visitas[cliente.codigo] ?? null} hoje={hoje} />,
  };
}

/** O fundo dos municípios com cliente, nas visões que não pintam o município de outra cor. */
export function classesDosMunicipiosComCliente({ territorio }: ContextoDaLente): Map<string, string> {
  return new Map([...territorio.municipios.keys()].map((codigo) => [codigo, "cliente"]));
}
