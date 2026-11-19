import { lerConfiguracaoDoEnvio } from "./configuracao.ts";
import { buscarPedidosNovos } from "./envio/buscarPedidos.ts";
import { ErroNoEnvio } from "./envio/sftp.ts";

/*
 * Traz os pedidos que os representantes enviaram pelo CRM para a pasta de recebidos desta máquina
 * (F5, docs/plano.md, "Pedidos: caminho até o ERP"). Por enquanto, só traz: a conferência no Oracle e a
 * gravação no SGI vêm nas próximas etapas. Não lê o Oracle.
 * Uso: npm run pedidos -- [--env <arquivo .env>] [--dados <pasta>]
 * O resumo só tem os números dos pedidos do CRM: nenhum cliente, item ou valor.
 */

const { pastaDosPedidos, destino } = lerConfiguracaoDoEnvio(process.argv.slice(2));
try {
  const { recebidos, restantes } = await buscarPedidosNovos(pastaDosPedidos, destino);
  console.log(recebidos.length > 0 ? `Pedidos recebidos: ${recebidos.map((nome) => nome.replace(".json", "")).join(", ")}.` : "Nenhum pedido novo.");
  if (restantes > 0) console.log(`  ficaram ${restantes} para a próxima passada`);
} catch (erro) {
  if (!(erro instanceof ErroNoEnvio)) throw erro;
  console.error(erro.message);
  process.exitCode = 1;
}
