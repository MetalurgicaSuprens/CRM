import { describe, expect, it } from "vitest";
import { escreverOrdem, lerOrdem, ordenar, proximaOrdem, type ColunaOrdenavel } from "./ordenacao";

type Cliente = { nome: string; faturado: number; variacao: number | null };

const NOME: ColunaOrdenavel<Cliente> = { titulo: "Cliente", ordenarPor: (cliente) => cliente.nome };
const FATURADO: ColunaOrdenavel<Cliente> = { titulo: "Faturado 12 meses", numerica: true, ordenarPor: (cliente) => cliente.faturado };
const TENDENCIA: ColunaOrdenavel<Cliente> = { titulo: "Tendência" };
const COLUNAS = [NOME, FATURADO, TENDENCIA];

const nomes = (clientes: Cliente[]) => clientes.map((cliente) => cliente.nome);

describe("ordenar", () => {
  it("ordena números nos dois sentidos", () => {
    const clientes = [
      { nome: "B", faturado: 20, variacao: null },
      { nome: "A", faturado: 300, variacao: null },
      { nome: "C", faturado: 5, variacao: null },
    ];
    expect(nomes(ordenar(clientes, (cliente) => cliente.faturado, "crescente"))).toEqual(["C", "B", "A"]);
    expect(nomes(ordenar(clientes, (cliente) => cliente.faturado, "decrescente"))).toEqual(["A", "B", "C"]);
  });

  it("deixa os vazios no fim nos dois sentidos", () => {
    const clientes = [
      { nome: "sem", faturado: 0, variacao: null },
      { nome: "queda", faturado: 0, variacao: -0.3 },
      { nome: "alta", faturado: 0, variacao: 0.2 },
    ];
    expect(nomes(ordenar(clientes, (cliente) => cliente.variacao, "crescente"))).toEqual(["queda", "alta", "sem"]);
    expect(nomes(ordenar(clientes, (cliente) => cliente.variacao, "decrescente"))).toEqual(["alta", "queda", "sem"]);
  });

  it("compara textos sem pesar acento nem maiúscula", () => {
    const valores = ["Óleo", "abraçadeira", "Mangueira", "engate"];
    expect(ordenar(valores, (valor) => valor, "crescente")).toEqual(["abraçadeira", "engate", "Mangueira", "Óleo"]);
  });

  it("compara o número dentro dos códigos pelo valor", () => {
    expect(ordenar(["CRM-00108", "CRM-00099", "CRM-00101"], (codigo) => codigo, "crescente")).toEqual(["CRM-00099", "CRM-00101", "CRM-00108"]);
    expect(ordenar(["NF 9", "NF 10"], (nota) => nota, "crescente")).toEqual(["NF 9", "NF 10"]);
  });

  it("mantém a ordem de chegada nos empates e não altera a lista original", () => {
    const clientes = [
      { nome: "primeiro", faturado: 10, variacao: null },
      { nome: "segundo", faturado: 10, variacao: null },
    ];
    expect(nomes(ordenar(clientes, (cliente) => cliente.faturado, "decrescente"))).toEqual(["primeiro", "segundo"]);
    expect(nomes(ordenar([...clientes].reverse(), (cliente) => cliente.faturado, "crescente"))).toEqual(["segundo", "primeiro"]);
    expect(nomes(clientes)).toEqual(["primeiro", "segundo"]);
  });
});

describe("proximaOrdem", () => {
  it("começa números do maior para o menor e textos de A a Z", () => {
    expect(proximaOrdem(null, FATURADO)).toEqual({ coluna: "Faturado 12 meses", sentido: "decrescente" });
    expect(proximaOrdem({ coluna: "Faturado 12 meses", sentido: "decrescente" }, NOME)).toEqual({ coluna: "Cliente", sentido: "crescente" });
  });

  it("inverte o sentido ao clicar de novo na mesma coluna", () => {
    const decrescente = proximaOrdem(null, FATURADO);
    const crescente = proximaOrdem(decrescente, FATURADO);
    expect(crescente.sentido).toBe("crescente");
    expect(proximaOrdem(crescente, FATURADO).sentido).toBe("decrescente");
  });
});

describe("ordem na URL", () => {
  it("vai e volta pelo título, sem acento, com o sinal de menos no decrescente", () => {
    const ordem = { coluna: "Faturado 12 meses", sentido: "decrescente" } as const;
    expect(escreverOrdem(ordem)).toBe("-faturado-12-meses");
    expect(escreverOrdem({ coluna: "Última compra", sentido: "crescente" })).toBe("ultima-compra");
    expect(lerOrdem("-faturado-12-meses", COLUNAS)).toEqual(ordem);
    expect(lerOrdem("cliente", COLUNAS)).toEqual({ coluna: "Cliente", sentido: "crescente" });
  });

  it("ignora ordem vazia, desconhecida ou de coluna que não ordena", () => {
    expect(lerOrdem(null, COLUNAS)).toBeNull();
    expect(lerOrdem("queda", COLUNAS)).toBeNull();
    expect(lerOrdem("tendencia", COLUNAS)).toBeNull();
  });
});
