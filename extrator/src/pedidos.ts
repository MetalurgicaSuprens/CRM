import path from "node:path";
import { lerConfiguracao, lerConfiguracaoDoEnvio } from "./configuracao.ts";
import { buscarPedidosNovos } from "./envio/buscarPedidos.ts";
import { ErroNoEnvio } from "./envio/sftp.ts";
import { abrirOracle, type Oracle } from "./oracle.ts";
import { conferirNoErp } from "./pedidos/conferencia.ts";
import { gravarConferidos, pedidosParaGravar, type ResumoDaGravacao } from "./pedidos/gravacao.ts";
import { ARQUIVO_PARA_PAUSAR, RECEBIDOS, isPausada, pedidosParaTriar, triarRecebidos, type ResumoDaTriagem } from "./pedidos/triagem.ts";

/*
 * Os pedidos que os representantes enviaram pelo CRM (F5, docs/plano.md, "Pedidos: caminho até o ERP"):
 * traz os novos da caixa de saída do servidor, confere cada um no Oracle (pedidos/triagem.ts) e grava
 * no SGI os conferidos (pedidos/gravacao.ts), se CRM_GRAVAR_NO_SGI=ligado. O arquivo PAUSAR suspende a
 * conferência e a gravação. O Oracle só é aberto quando há o que conferir ou gravar.
 * Uso: npm run pedidos -- [--env <arquivo .env>] [--dados <pasta>]
 * O resumo só tem os números dos pedidos (do CRM e do SGI) e os motivos: nenhum cliente, item ou valor.
 */

const argumentos = process.argv.slice(2);
const { pastaDosPedidos, destino } = lerConfiguracaoDoEnvio(argumentos);
await buscar();
await conferirEGravar();

/** Uma falha na busca não impede conferir e gravar o que já chegou. */
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

async function conferirEGravar(): Promise<void> {
  if (isPausada(pastaDosPedidos)) {
    console.log(`Conferência e gravação pausadas: apague ${path.join(pastaDosPedidos, ARQUIVO_PARA_PAUSAR)} para voltar.`);
    return;
  }
  const configuracao = lerConfiguracao(argumentos);
  const temParaTriar = pedidosParaTriar(pastaDosPedidos).length > 0;
  const temParaGravar = configuracao.isGravacaoNoSgiLigada && pedidosParaGravar(pastaDosPedidos).length > 0;
  if (temParaTriar || temParaGravar) {
    const oracle = await abrirOracle(configuracao.oracle);
    try {
      if (temParaTriar) console.log(resumirTriagem(await triarRecebidos(pastaDosPedidos, (pedido) => conferirNoErp(oracle, pedido, configuracao))));
      if (configuracao.isGravacaoNoSgiLigada) await gravar(oracle);
    } finally {
      await oracle.fechar();
    }
  }
  const esperando = pedidosParaGravar(pastaDosPedidos);
  if (!configuracao.isGravacaoNoSgiLigada && esperando.length > 0) {
    console.log(`Gravação no SGI desligada (CRM_GRAVAR_NO_SGI): ${numeros(esperando)} esperam em conferidos.`);
  }
}

async function gravar(oracle: Oracle): Promise<void> {
  const resumo = await gravarConferidos(pastaDosPedidos, oracle);
  const linhas = resumirGravacao(resumo);
  if (linhas) console.log(linhas);
  // O Agendador mostra a passada com erro quando um pedido não entrou.
  if (resumo.adiados.length + resumo.quarentena.length > 0) process.exitCode = 1;
}

function resumirTriagem({ porDestino }: ResumoDaTriagem): string {
  const linhas = [
    ["Conferidos, prontos para o SGI", porDestino.conferidos],
    ["Aguardando o cadastro da transportadora", porDestino.aguardando],
    ["Em quarentena (veja o motivo na pasta quarentena)", porDestino.quarentena],
  ] as const;
  return linhas
    .filter(([, nomes]) => nomes.length > 0)
    .map(([rotulo, nomes]) => `${rotulo}: ${nomes.join(", ")}`)
    .join("\n");
}

function resumirGravacao({ gravados, adiados, quarentena }: ResumoDaGravacao): string {
  return [
    ...gravados.map(({ pedido, numeroNoSgi }) => `Gravado no SGI: ${pedido} é o pedido ${numeroNoSgi}, PEDIDO BLOQUEADO.`),
    ...adiados.map(({ pedido, motivo }) => `Não entrou no SGI, tenta de novo na próxima passada: ${pedido} (${motivo})`),
    ...quarentena.map(({ pedido, motivo }) => `Em quarentena na gravação: ${pedido} (${motivo})`),
  ].join("\n");
}

function numeros(arquivos: readonly string[]): string {
  return arquivos.map((nome) => nome.replace(".json", "")).join(", ");
}
