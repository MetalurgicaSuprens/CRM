import { criarAleatorio } from "./aleatorio";
import type { EnderecoDoCliente } from "./tipos";

/*
 * O endereço das empresas da carteira fictícia: rua e bairro inventados e o ponto a poucos km do
 * centro da cidade, para o mapa ter onde pôr cada uma. A semente é o próprio código do cliente, e
 * o sorteio da carteira continua o mesmo.
 */

/** O centro (latitude, longitude) das cidades da carteira fictícia (ficticio.ts, CIDADES). */
const CENTRO_DA_CIDADE: Readonly<Record<string, readonly [number, number]>> = {
  "3543402": [-21.178, -47.806], "3509502": [-22.906, -47.061], "3538709": [-22.725, -47.649],
  "3506003": [-22.315, -49.061], "3516200": [-20.539, -47.401], "3552205": [-23.502, -47.458],
  "3549805": [-20.82, -49.379], "4113700": [-23.311, -51.163], "4115200": [-23.42, -51.938],
  "4104808": [-24.956, -53.455], "4119905": [-25.095, -50.162], "4209102": [-26.304, -48.849],
  "4204202": [-27.101, -52.615], "4202404": [-26.919, -49.066], "3170206": [-18.919, -48.277],
  "3170107": [-19.747, -47.932], "3151800": [-21.788, -46.562], "5218805": [-17.798, -50.928],
  "5002704": [-20.469, -54.62], "5003702": [-22.221, -54.806],
};

const RUAS = [
  "R XV DE NOVEMBRO", "AV BRASIL", "R SETE DE SETEMBRO", "AV DAS INDUSTRIAS", "R BARAO DO RIO BRANCO",
  "AV INDEPENDENCIA", "R DOM PEDRO II", "AV JOAO GOULART", "R TIRADENTES", "ROD DOS IMIGRANTES",
];
const BAIRROS = ["CENTRO", "DISTRITO INDUSTRIAL", "VILA NOVA", "JARDIM AMERICA", "SAO JOSE", "PARQUE INDUSTRIAL"];
/** Uns 2 km em volta do centro: dentro da cidade em todas as da lista. */
const AFASTAMENTO_EM_GRAUS = 0.02;

export function enderecoFicticio(codigo: string, municipio: string): EnderecoDoCliente {
  const aleatorio = criarAleatorio(Number(codigo.slice(0, 9)));
  const numero = aleatorio.inteiro(10, 3_500);
  const centro = CENTRO_DA_CIDADE[municipio];
  const precisao = aleatorio.escolher(["numero", "numero", "numero", "rua", "cep"] as const);
  return {
    texto: `${aleatorio.escolher(RUAS)}, ${numero}${aleatorio.chance(0.2) ? ` SALA ${aleatorio.inteiro(1, 20)}` : ""}`,
    bairro: aleatorio.escolher(BAIRROS),
    cep: String(aleatorio.inteiro(10_000_001, 89_999_999)),
    ponto:
      centro && aleatorio.chance(0.92)
        ? {
            latitude: centro[0] + aleatorio.entre(-AFASTAMENTO_EM_GRAUS, AFASTAMENTO_EM_GRAUS),
            longitude: centro[1] + aleatorio.entre(-AFASTAMENTO_EM_GRAUS, AFASTAMENTO_EM_GRAUS),
            precisao,
          }
        : null,
  };
}
