import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavigationType, useLocation, useNavigationType, type Location } from "react-router";
import { ChartColumn, ClipboardList, House, MapIcon, Users } from "lucide-react";

/*
 * A navegação do CRM: as telas do menu, de onde se chegou a cada tela e onde a página estava. Com
 * isso, o "Voltar" da ficha leva à tela de onde se veio, na mesma aba e na mesma altura da página.
 * A memória é da aba do navegador, por entrada do histórico: recarregar a página a esquece.
 */

export const NAVEGACAO = [
  { para: "/", rotulo: "Início", Icone: House },
  { para: "/clientes", rotulo: "Clientes", Icone: Users },
  { para: "/analises", rotulo: "Análises", Icone: ChartColumn },
  { para: "/pedidos", rotulo: "Pedidos", Icone: ClipboardList },
  { para: "/mapa", rotulo: "Mapa", Icone: MapIcon },
] as const;

/** A tela de onde se chegou a cada entrada do histórico, pela chave da entrada. */
const origens = new Map<string, Location>();
/** A rolagem de cada entrada do histórico, para voltar a ela. */
const rolagens = new Map<string, number>();
/** Até quantos quadros (meio segundo) a rolagem espera a página voltar à altura que tinha. */
const QUADROS_PARA_RESTAURAR = 30;

/**
 * A origem da tela atual chega às telas por contexto, e não lida direto do mapa: a tela desenha antes
 * de o Layout anotar a entrada nova do histórico (a troca de filtro, por exemplo, cria uma).
 */
const OrigemDaTela = createContext<Location | null>(null);
export const ProvedorDaOrigem = OrigemDaTela.Provider;

/**
 * No Layout: anota a origem e a rolagem de cada tela; ao voltar, devolve a rolagem; ao abrir outra,
 * vai ao topo. Devolve a origem da tela atual, para o ProvedorDaOrigem.
 */
export function useMemoriaDaNavegacao(): Location | null {
  const local = useLocation();
  const tipo = useNavigationType();
  const anterior = useRef<Location | null>(null);
  const chaveAtual = useRef(local.key);
  const [origem, setOrigem] = useState<Location | null>(null);

  useEffect(() => {
    // O navegador não devolve a rolagem sozinho: a página ainda não tem a altura quando ele tenta.
    window.history.scrollRestoration = "manual";
    const anotar = () => rolagens.set(chaveAtual.current, window.scrollY);
    window.addEventListener("scroll", anotar, { passive: true });
    return () => window.removeEventListener("scroll", anotar);
  }, []);

  useLayoutEffect(() => {
    const de = anterior.current;
    anotarOrigem(local, de, tipo);
    // Antes da pintura: a tela desenha de novo já com a origem certa.
    setOrigem(origens.get(local.key) ?? null);
    anterior.current = local;
    chaveAtual.current = local.key;
    const rolagem = tipo === NavigationType.Pop ? rolagens.get(local.key) : undefined;
    if (rolagem !== undefined) return restaurarRolagem(rolagem);
    if (de?.pathname !== local.pathname) window.scrollTo(0, 0);
    return undefined;
  }, [local, tipo]);

  return origem;
}

/** A tela de onde se chegou à atual, quando se chegou por um link do próprio CRM. */
export function useOrigem(): Location | null {
  return useContext(OrigemDaTela);
}

/** O nome da tela do menu no caminho, como "Análises"; null fora do menu. */
export function rotuloDaTela(caminho: string): string | null {
  return NAVEGACAO.find(({ para }) => para === caminho)?.rotulo ?? null;
}

/** O link leva a outra tela, que lembra de onde veio; a troca de filtro (replace) herda a origem. */
function anotarOrigem(local: Location, de: Location | null, tipo: NavigationType): void {
  if (!de || de.key === local.key) return;
  if (tipo === NavigationType.Push) origens.set(local.key, de);
  if (tipo === NavigationType.Replace) {
    const origem = origens.get(de.key);
    if (origem) origens.set(local.key, origem);
  }
}

/**
 * Volta à rolagem salva e insiste a cada quadro até a página parar de crescer nela: as tabelas se
 * medem depois de desenhar, e a altura muda. Para se a pessoa rolar antes.
 */
function restaurarRolagem(alvo: number): () => void {
  let quadro = 0;
  let restantes = QUADROS_PARA_RESTAURAR;
  let alturaAnterior = -1;
  const tentar = () => {
    window.scrollTo(0, alvo);
    const altura = document.documentElement.scrollHeight;
    const parou = Math.abs(window.scrollY - alvo) <= 1 && altura === alturaAnterior;
    alturaAnterior = altura;
    restantes -= 1;
    if (!parou && restantes > 0) quadro = requestAnimationFrame(tentar);
  };
  const desistir = () => cancelAnimationFrame(quadro);
  window.addEventListener("wheel", desistir, { once: true, passive: true });
  window.addEventListener("touchstart", desistir, { once: true, passive: true });
  tentar();
  return () => {
    desistir();
    window.removeEventListener("wheel", desistir);
    window.removeEventListener("touchstart", desistir);
  };
}
