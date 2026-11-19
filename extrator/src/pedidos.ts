import path from "node:path";
import { lerConfiguracao, lerConfiguracaoDoEnvio } from "./configuracao.ts";
import { buscarPedidosNovos } from "./envio/buscarPedidos.ts";
import { ErroNoEnvio } from "./envio/sftp.ts";
import { abrirOracle } from "./oracle.ts";
import { conferirNoErp } from "./pedidos/conferencia.ts";
import { ARQUIVO_PARA_PAUSAR, RECEBIDOS, isPausada, pedidosParaTriar, triarRecebidos, type ResumoDaTriagem } from "./pedidos/triagem.ts";

/*
 * Os pedidos que os representantes enviaram pelo CRM (F5, docs/plano.md, "Pedidos: caminho até o ERP"):
 * traz os novos da caixa de saída do servidor e confere cada um no Oracle (pedidos/triagem.ts). A
 * gravação no SGI vem na próxima etapa. O Oracle só é aberto quando há pedido para conferir.
 * Uso: npm run pedidos -- [--env <arquivo .env>] [--dados <pasta>]
 * O resumo só tem os números dos pedidos do CRM e o destino de cada um: nenhum cliente, item ou valor.
 */

const argumentos = process.argv.slice(2);
const { pastaDosPedidos, destino } = lerConfiguracaoDoEnvio(argumentos);
await buscar();
await triar();

/** Uma falha na busca não impede conferir o que já chegou. */
async function buscar(): Promise<void> {
  try {
    const { recebidos, restantes } = await buscarPedidosNovos(path.join(pastaDosPedidos, RECEBIDOS), destino);
    console.log(recebidos.length > 0 ? `Pedidos recebidos: ${numeros(recebidos)}.` : "Nenhum pedido novo no servidor.");
    if (restantes > 0) console.log(`  ficaram ${restantes} para a próxima passada`);
  } catch (erro) {
    if (!(erro instanceof ErroNoEnvio)) throw erro;
    console.error(erro.message);
    process.exitCode = 1;
  }
}

async function triar(): Promise<void> {
  if (isPausada(pastaDosPedidos)) {
    console.log(`Conferência pausada: apague ${path.join(pastaDosPedidos, ARQUIVO_PARA_PAUSAR)} para voltar.`);
    return;
  }
  if (pedidosParaTriar(pastaDosPedidos).length === 0) return;
  const { oracle: acesso, chaveDoIdDoCliente, autorizados } = lerConfiguracao(argumentos);
  const oracle = await abrirOracle(acesso);
  try {
    console.log(resumir(await triarRecebidos(pastaDosPedidos, (pedido) => conferirNoErp(oracle, pedido, { chaveDoIdDoCliente, autorizados }))));
  } finally {
    await oracle.fechar();
  }
}

function resumir({ porDestino }: ResumoDaTriagem): string {
  const linhas = [
    ["Conferidos, prontos para o SGI", porDestino.conferidos],
    ["Em revisão (acima do valor-teto)", porDestino.revisao],
    ["Aguardando o cadastro da transportadora", porDestino.aguardando],
    ["Em quarentena (veja o motivo na pasta quarentena)", porDestino.quarentena],
  ] as const;
  return linhas
    .filter(([, nomes]) => nomes.length > 0)
    .map(([rotulo, nomes]) => `${rotulo}: ${nomes.join(", ")}`)
    .join("\n");
}

function numeros(arquivos: readonly string[]): string {
  return arquivos.map((nome) => nome.replace(".json", "")).join(", ");
}
