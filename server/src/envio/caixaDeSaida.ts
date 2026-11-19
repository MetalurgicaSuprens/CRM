import fs from "node:fs";
import path from "node:path";
import type { EscolhasDoPedido, ItemDoPedido } from "../../../web/src/dados/tipos.ts";

/*
 * A caixa de saída dos pedidos (docs/plano.md, "Pedidos: caminho até o ERP"): um arquivo JSON por
 * pedido enviado, que a máquina do extrator busca pelo SFTP, revalida no Oracle e grava no SGI. O
 * servidor é o único que escreve nesta pasta. O arquivo nasce com nome provisório e só ganha o nome
 * final inteiro e gravado no disco: quem busca nunca vê um pedido pela metade.
 */

/** O formato do arquivo. Muda junto com a leitura do extrator. */
export const VERSAO_DO_ARQUIVO_DO_PEDIDO = 1;

export type PedidoParaOErp = {
  versao: typeof VERSAO_DO_ARQUIVO_DO_PEDIDO;
  /** "CRM-00106" */
  numero: string;
  enviadoEm: string;
  /** O id do login que enviou; nunca o nome. */
  usuario: string;
  /** Os códigos de representante do login, da sessão: o cliente tem de ser de um deles. */
  codigos: string[];
  /** O id opaco do cliente na foto; a LAN acha o cliente do ERP pela chave do id. */
  cliente: string;
  itens: ItemDoPedido[];
  entrega: string | null;
  observacao: string;
  escolhas: EscolhasDoPedido;
  /** O sha256 do conteúdo que a chave de acesso confirmou. */
  hash: string;
};

const PROVISORIO = ".part";

/** Grava o pedido na caixa de saída e devolve o caminho do arquivo. */
export function gravarNaCaixaDeSaida(pasta: string, pedido: PedidoParaOErp): string {
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `${pedido.numero}.json`);
  const provisorio = arquivo + PROVISORIO;
  // Um número do CRM nunca sobrescreve o arquivo de outro pedido.
  if (fs.existsSync(arquivo)) throw new Error(`O pedido ${pedido.numero} já está na caixa de saída.`);
  const descritor = fs.openSync(provisorio, "wx");
  try {
    // A conta de troca de arquivos lê pelo grupo da pasta. O chmod explícito vale por cima do UMask do serviço.
    fs.fchmodSync(descritor, 0o640);
    fs.writeFileSync(descritor, JSON.stringify(pedido));
    fs.fsyncSync(descritor);
  } finally {
    fs.closeSync(descritor);
  }
  fs.renameSync(provisorio, arquivo);
  return arquivo;
}
