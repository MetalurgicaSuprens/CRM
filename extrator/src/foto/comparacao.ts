import type { ResumoDaFoto } from "./resumo.ts";

/*
 * Antes de gravar, o extrator compara a foto nova com a anterior (docs/plano.md, "extrator/",
 * "Antes de gravar"). Entre duas cargas seguidas o ERP muda pouco: uma tabela que encolhe ou
 * cresce pela metade, ou notas que voltam no tempo, indicam leitura incompleta ou do banco errado.
 */

/** Abaixo disso, a mudança normal de uma carga para a outra passa de 50%, como nos pedidos em aberto. */
const LINHAS_MINIMAS_PARA_COMPARAR = 1000;
const MUDANCA_MAXIMA = 0.5;

/**
 * Por que as duas fotos não se comparam; null se se comparam. Outra versão do esquema muda as
 * tabelas, e outra lista de autorizados muda o volume de propósito.
 */
export function motivoParaNaoComparar(nova: ResumoDaFoto, anterior: ResumoDaFoto): string | null {
  if (nova.versaoDoEsquema !== anterior.versaoDoEsquema) {
    return `a anterior é da versão ${anterior.versaoDoEsquema} do esquema, e esta da ${nova.versaoDoEsquema}`;
  }
  if (nova.representantes.join() !== anterior.representantes.join()) return "a lista de representantes autorizados mudou";
  return null;
}

/** O que impede a foto nova de substituir a anterior; vazio se ela pode. Só para fotos que se comparam. */
export function problemasDaFotoNova(nova: ResumoDaFoto, anterior: ResumoDaFoto): string[] {
  return [...problemasDeData(nova, anterior), ...problemasDeVolume(nova, anterior)];
}

function problemasDeData(nova: ResumoDaFoto, anterior: ResumoDaFoto): string[] {
  const problemas: string[] = [];
  if (nova.geradaEm < anterior.geradaEm) {
    problemas.push(`o relógio do Oracle voltou: a foto anterior é de ${anterior.geradaEm}, e esta de ${nova.geradaEm}`);
  }
  if (anterior.notaMaisRecente !== null && (nova.notaMaisRecente === null || nova.notaMaisRecente < anterior.notaMaisRecente)) {
    problemas.push(`a nota mais recente voltou de ${anterior.notaMaisRecente} para ${nova.notaMaisRecente ?? "nenhuma"}: o extrator está lendo o banco de produção?`);
  }
  return problemas;
}

function problemasDeVolume(nova: ResumoDaFoto, anterior: ResumoDaFoto): string[] {
  return Object.entries(anterior.linhas)
    .filter(([, antes]) => antes >= LINHAS_MINIMAS_PARA_COMPARAR)
    .flatMap(([tabela, antes]) => {
      const agora = nova.linhas[tabela] ?? 0;
      const mudanca = agora / antes - 1;
      if (Math.abs(mudanca) <= MUDANCA_MAXIMA) return [];
      return [`${tabela}: de ${formatarLinhas(antes)} para ${formatarLinhas(agora)} linhas (${formatarMudanca(mudanca)})`];
    });
}

function formatarLinhas(linhas: number): string {
  return linhas.toLocaleString("pt-BR");
}

function formatarMudanca(mudanca: number): string {
  const percentual = `${Math.round(Math.abs(mudanca) * 100)}%`;
  return mudanca < 0 ? `−${percentual}` : `+${percentual}`;
}
