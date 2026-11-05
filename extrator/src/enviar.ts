import { lerConfiguracaoDoEnvio } from "./configuracao.ts";
import { enviarFotoMaisNova } from "./envio/enviarFoto.ts";
import { ErroNoEnvio } from "./envio/sftp.ts";

/*
 * Leva a foto mais nova, com o manifesto, ao servidor do CRM, pelo programa de envio seguro do
 * Windows (docs/plano.md, "Troca da foto"). Não lê o Oracle: roda depois do npm run foto.
 * Uso: npm run enviar -- [--env <arquivo .env>] [--dados <pasta>]
 */

const { pastaDasFotos, destino } = lerConfiguracaoDoEnvio(process.argv.slice(2));
try {
  const { foto, isEnviada, fotosApagadas } = await enviarFotoMaisNova(pastaDasFotos, destino);
  console.log(isEnviada ? `Foto ${foto} enviada para ${destino.endereco}.` : `A foto ${foto} já estava em ${destino.endereco}.`);
  if (fotosApagadas > 0) console.log(`  fotos antigas apagadas no servidor: ${fotosApagadas}`);
} catch (erro) {
  if (!(erro instanceof ErroNoEnvio)) throw erro;
  console.error(erro.message);
  process.exitCode = 1;
}
