import fs from "node:fs";
import path from "node:path";

/*
 * Uma passada de pedidos por vez: a tarefa agendada e quem roda o npm run pedidos à mão não podem gravar
 * o mesmo pedido no SGI ao mesmo tempo. A trava é um arquivo criado de forma exclusiva na pasta de
 * pedidos. Se a passada morrer sem apagá-la, ela vence depois de 30 minutos, mais que o limite de uma
 * passada no Agendador.
 */

export const ARQUIVO_DA_TRAVA = "passada-em-andamento";
const VALIDADE_DA_TRAVA_MS = 30 * 60_000;

export type Trava = { soltar(): void };

/** A trava da pasta, ou null se outra passada está com ela. */
export function travar(pastaDosPedidos: string, agora = Date.now()): Trava | null {
  fs.mkdirSync(pastaDosPedidos, { recursive: true });
  const arquivo = path.join(pastaDosPedidos, ARQUIVO_DA_TRAVA);
  if (fs.existsSync(arquivo) && agora - fs.statSync(arquivo).mtimeMs > VALIDADE_DA_TRAVA_MS) fs.rmSync(arquivo, { force: true });
  try {
    fs.writeFileSync(arquivo, `${process.pid}\n`, { flag: "wx" });
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "EEXIST") return null;
    throw erro;
  }
  return { soltar: () => fs.rmSync(arquivo, { force: true }) };
}
