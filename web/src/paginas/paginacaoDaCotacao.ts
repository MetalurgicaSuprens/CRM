/**
 * Como a cotação se divide em folhas A4 (pedido do Lucas em 2026-11-23): cada folha leva itens até encher;
 * a caixa que continua termina com "Continua na página N"; os totais fecham a caixa e descem com pelo menos
 * um item, para nenhuma folha ter só o total; o fechamento (endereços, observações e nota) vai bloco a bloco
 * para onde couber. As alturas vêm medidas da própria folha, em pixels, e já incluem o espaço até o próximo.
 */
export type MedidasDaCotacao = {
  /** A altura do conteúdo de uma folha, entre a margem de cima e o rodapé da página. */
  util: number;
  /** O topo da primeira folha: a marca, o cliente e as condições comerciais. */
  abertura: number;
  /** A linha curta com o cliente, no topo das folhas seguintes. */
  cabecalhoCurto: number;
  /** A caixa dos itens sem nenhuma linha: a faixa "Itens", os títulos das colunas e as bordas. */
  caixaVazia: number;
  /** Cada item, na ordem da cotação. */
  linhas: readonly number[];
  /** A linha "Continua na página N" que fecha a caixa que segue na próxima folha. */
  continua: number;
  totais: number;
  /** Os blocos depois dos itens, na ordem: endereços, observações e a nota. */
  fechamento: readonly number[];
};

export type FolhaDaCotacao = {
  /** Os itens desta folha: do índice `primeiro` até antes do `fim`. Sem itens, `primeiro === fim`. */
  primeiro: number;
  fim: number;
  isContinua: boolean;
  temTotais: boolean;
  /** Quantos blocos do fechamento, a partir do `primeiroDoFechamento`, vão nesta folha. */
  primeiroDoFechamento: number;
  fimDoFechamento: number;
};

export function paginarCotacao(medidas: MedidasDaCotacao): FolhaDaCotacao[] {
  const folhas = distribuirItens(medidas);
  distribuirFechamento(folhas, medidas);
  return folhas.map(({ usado: _usado, ...folha }) => folha);
}

type FolhaEmMontagem = FolhaDaCotacao & { usado: number };

function novaFolha(medidas: MedidasDaCotacao, folhas: readonly FolhaEmMontagem[], primeiro: number): FolhaEmMontagem {
  const topo = folhas.length === 0 ? medidas.abertura : medidas.cabecalhoCurto;
  return { primeiro, fim: primeiro, isContinua: false, temTotais: false, primeiroDoFechamento: 0, fimDoFechamento: 0, usado: topo };
}

function distribuirItens(medidas: MedidasDaCotacao): FolhaEmMontagem[] {
  const { linhas, util } = medidas;
  const folhas: FolhaEmMontagem[] = [];
  let folha = novaFolha(medidas, folhas, 0);
  folha.usado += medidas.caixaVazia;
  folhas.push(folha);
  linhas.forEach((altura, indice) => {
    const reserva = indice < linhas.length - 1 ? medidas.continua : 0;
    const isPrimeiraDaFolha = folha.fim === folha.primeiro;
    if (!isPrimeiraDaFolha && folha.usado + altura + reserva > util) {
      folha = continuarNaProxima(medidas, folhas, folha);
    }
    folha.usado += altura;
    folha.fim = indice + 1;
  });
  fecharComTotais(medidas, folhas);
  return folhas;
}

function continuarNaProxima(medidas: MedidasDaCotacao, folhas: FolhaEmMontagem[], anterior: FolhaEmMontagem): FolhaEmMontagem {
  anterior.isContinua = true;
  anterior.usado += medidas.continua;
  const folha = novaFolha(medidas, folhas, anterior.fim);
  folha.usado += medidas.caixaVazia;
  folhas.push(folha);
  return folha;
}

/** Os totais não cabem: os últimos itens descem com eles, até sobrar lugar para o "continua". */
function fecharComTotais(medidas: MedidasDaCotacao, folhas: FolhaEmMontagem[]): void {
  const ultima = ultimaDe(folhas);
  if (ultima.usado + medidas.totais <= medidas.util || ultima.fim - ultima.primeiro <= 1) {
    ultima.temTotais = true;
    ultima.usado += medidas.totais;
    return;
  }
  const descem: number[] = [];
  while (ultima.fim - ultima.primeiro > 1 && (descem.length === 0 || ultima.usado + medidas.continua > medidas.util)) {
    ultima.fim -= 1;
    ultima.usado -= alturaDaLinha(medidas, ultima.fim);
    descem.unshift(ultima.fim);
  }
  const folha = continuarNaProxima(medidas, folhas, ultima);
  folha.fim = folha.primeiro + descem.length;
  folha.usado += descem.reduce((soma, indice) => soma + alturaDaLinha(medidas, indice), 0) + medidas.totais;
  folha.temTotais = true;
}

function distribuirFechamento(folhas: FolhaEmMontagem[], medidas: MedidasDaCotacao): void {
  let folha = ultimaDe(folhas);
  medidas.fechamento.forEach((altura, indice) => {
    const isVazia = folha.fimDoFechamento === folha.primeiroDoFechamento && folha.fim === folha.primeiro;
    if (!isVazia && folha.usado + altura > medidas.util) {
      folha = novaFolha(medidas, folhas, medidas.linhas.length);
      folha.primeiroDoFechamento = indice;
      folha.fimDoFechamento = indice;
      folhas.push(folha);
    }
    folha.usado += altura;
    folha.fimDoFechamento = indice + 1;
  });
}

function ultimaDe(folhas: readonly FolhaEmMontagem[]): FolhaEmMontagem {
  const ultima = folhas[folhas.length - 1];
  if (!ultima) throw new Error("A cotação começa sempre com uma folha");
  return ultima;
}

const alturaDaLinha = (medidas: MedidasDaCotacao, indice: number) => medidas.linhas[indice] ?? 0;
