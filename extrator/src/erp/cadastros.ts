import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { numero, texto } from "./linha.ts";
import { data, emLista, textoDaData } from "./sql.ts";

/** O SGI só lê os vendedores na empresa 20210001 (untDmVenPvd.dfm:499-503). */
const EMPRESA_DOS_VENDEDORES = 20210001;

/** Início da leitura, pelo relógio do Oracle: vira a hora do dado e o "hoje" das regras. */
export async function lerMomentoDoOracle(oracle: Oracle): Promise<string> {
  const [linha] = await oracle.consultar(`SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD"T"HH24:MI') FROM DUAL`);
  if (!linha) throw new Error("O Oracle não devolveu a data.");
  return texto(linha, 0);
}

/** Código → nome da CRVN; há uma linha por gerente e supervisor, por isso o MAX. */
export async function lerNomesDosRepresentantes(oracle: Oracle, autorizados: string[]): Promise<Map<string, string>> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT VENDEDOR, MAX(TRIM(NOME)) FROM ABC71.CRVN
      WHERE EMP_FIL = ${EMPRESA_DOS_VENDEDORES} AND VENDEDOR IN ${lista.sql}
      GROUP BY VENDEDOR`,
    lista.binds,
  );
  return new Map(linhas.map((linha) => [String(numero(linha, 0)), texto(linha, 1)]));
}

/** Dias úteis como o SGI (untFunMat.pas:676): útil, salvo CAL_DUT_COM = 'NAO'. */
export async function lerCalendario(oracle: Oracle, referencia: Referencia): Promise<Map<string, boolean>> {
  const linhas = await oracle.consultar(
    `SELECT ${textoDaData("CAL_DTA")}, CASE WHEN NVL(TRIM(CAL_DUT_COM), 'SIM') = 'NAO' THEN 0 ELSE 1 END
       FROM ABC71.SGI5_TAB_DP_CALEND
      WHERE CAL_DTA >= ${data("inicio")} AND CAL_DTA < ${data("fim")} + 1`,
    { inicio: referencia.inicioDoAnoAnterior, fim: referencia.fimDoMesAtual },
  );
  return new Map(linhas.map((linha) => [texto(linha, 0), numero(linha, 1) === 1]));
}
