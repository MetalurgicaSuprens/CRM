import { describe, expect, it } from "vitest";
import { paginarCotacao, type MedidasDaCotacao } from "./paginacaoDaCotacao";

// Folhas de 100: a primeira começa com 30 de abertura, as outras com 5; a caixa vazia ocupa 10.
const medidas = (mudancas: Partial<MedidasDaCotacao>): MedidasDaCotacao => ({
  util: 100,
  abertura: 30,
  cabecalhoCurto: 5,
  caixaVazia: 10,
  linhas: [],
  continua: 4,
  totais: 12,
  fechamento: [],
  ...mudancas,
});
const linhas = (quantas: number) => Array.from({ length: quantas }, () => 5);
const itensDe = (folhas: ReturnType<typeof paginarCotacao>) => folhas.map((folha) => folha.fim - folha.primeiro);

describe("paginarCotacao", () => {
  it("põe tudo numa folha quando cabe", () => {
    const folhas = paginarCotacao(medidas({ linhas: linhas(5), fechamento: [10, 5] }));
    expect(folhas).toEqual([{ primeiro: 0, fim: 5, isContinua: false, temTotais: true, primeiroDoFechamento: 0, fimDoFechamento: 2 }]);
  });

  it("enche cada folha de itens e marca a que continua", () => {
    // Primeira: 30 + 10 + 4 do continua deixam 56, 11 itens; as seguintes: 5 + 10 + 4 deixam 81, 16 itens.
    const folhas = paginarCotacao(medidas({ linhas: linhas(30), totais: 0 }));
    expect(itensDe(folhas)).toEqual([11, 16, 3]);
    expect(folhas.map((folha) => folha.isContinua)).toEqual([true, true, false]);
  });

  it("leva os últimos itens para a folha em que cabem com os totais, sem deixar vão", () => {
    // 11 itens na primeira; os 3 seguintes e os totais cabem na segunda (5 + 10 + 15 + 12).
    const folhas = paginarCotacao(medidas({ linhas: linhas(14) }));
    expect(itensDe(folhas)).toEqual([11, 3]);
    expect(folhas[1]).toMatchObject({ temTotais: true });
  });

  it("desce o último item com os totais quando eles não cabem, para nenhuma folha ter só o total", () => {
    // 12 itens cabem sem o continua (30 + 10 + 60 = 100), mas os totais não: o último desce com eles.
    const folhas = paginarCotacao(medidas({ linhas: linhas(12) }));
    expect(itensDe(folhas)).toEqual([11, 1]);
    expect(folhas[0]).toMatchObject({ isContinua: true, temTotais: false });
    expect(folhas[1]).toMatchObject({ temTotais: true });
  });

  it("passa para a folha seguinte só o bloco do fechamento que não cabe", () => {
    // Com 5 itens e os totais, a primeira usa 77: os endereços (20) cabem, a nota (10) não.
    const folhas = paginarCotacao(medidas({ linhas: linhas(5), fechamento: [20, 10] }));
    expect(folhas).toHaveLength(2);
    expect(folhas[0]).toMatchObject({ primeiroDoFechamento: 0, fimDoFechamento: 1 });
    expect(folhas[1]).toMatchObject({ primeiro: 5, fim: 5, primeiroDoFechamento: 1, fimDoFechamento: 2 });
  });

  it("põe pelo menos um item em cada folha, mesmo que a linha seja maior que a folha", () => {
    const folhas = paginarCotacao(medidas({ linhas: [200, 200], totais: 0 }));
    expect(itensDe(folhas)).toEqual([1, 1]);
  });
});
