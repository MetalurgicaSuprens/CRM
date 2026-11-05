import { criarAppDoAdmin } from "./admin/appDoAdmin.ts";
import { criarApp } from "./app.ts";
import { auditar } from "./auditoria.ts";
import { abrirBancoDoApp } from "./bancoDoApp.ts";
import { lerConfiguracao } from "./configuracao.ts";
import { criarFotoAtual } from "./foto/fotoAtual.ts";
import { apagarRegistrosAntigos } from "./limpeza.ts";

/*
 * Sobe as duas APIs só no endereço desta máquina: a do CRM, que na produção fica atrás do Apache, e
 * a da administração, que nunca fica na internet (docs/plano.md, "server/"). Uma vez por dia, e na
 * subida, apaga do app.db o registro de acessos que passou do prazo.
 */

const ENDERECO = "127.0.0.1";
const UM_DIA_MS = 24 * 60 * 60_000;

const configuracao = lerConfiguracao();
const banco = abrirBancoDoApp(configuracao.arquivoDoApp);
const foto = criarFotoAtual(configuracao.fotos, {
  aoRecusar: ({ foto: arquivo, motivo }) => auditar(banco, { usuario: null, evento: "foto_recusada", alvo: arquivo, resultado: motivo }),
});
const crm = criarApp({ foto, banco, origem: configuracao.origem });
const admin = criarAppDoAdmin({ foto, banco, origem: configuracao.origemDoAdmin, origemDoCrm: configuracao.origem });
await crm.listen({ host: ENDERECO, port: configuracao.porta });
await admin.listen({ host: ENDERECO, port: configuracao.portaDoAdmin });
console.log(`API do CRM em http://${ENDERECO}:${configuracao.porta}, para o site ${configuracao.origem}.`);
console.log(`API da administração em http://${ENDERECO}:${configuracao.portaDoAdmin}, para o site ${configuracao.origemDoAdmin}.`);
console.log(`Fotos chegam em ${configuracao.fotos.entrada} e são conferidas em ${configuracao.fotos.conferidas}; app.db em ${configuracao.arquivoDoApp}.`);
limparRegistrosAntigos();
setInterval(limparRegistrosAntigos, UM_DIA_MS).unref();

function limparRegistrosAntigos(): void {
  const { registro, sessoes, convites } = apagarRegistrosAntigos(banco, new Date());
  if (registro + sessoes + convites > 0) console.log(`Registros antigos apagados: ${registro} do registro, ${sessoes} sessões e ${convites} convites.`);
}
