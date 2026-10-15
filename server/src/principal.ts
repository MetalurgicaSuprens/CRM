import { criarApp } from "./app.ts";
import { abrirBancoDoApp } from "./bancoDoApp.ts";
import { lerConfiguracao } from "./configuracao.ts";
import { criarFotoAtual } from "./foto/fotoAtual.ts";

/*
 * Sobe a API só no endereço desta máquina: na produção, o Apache fica na frente (docs/plano.md).
 */

const ENDERECO = "127.0.0.1";

const configuracao = lerConfiguracao();
const foto = criarFotoAtual(configuracao.pastaDasFotos);
const banco = abrirBancoDoApp(configuracao.arquivoDoApp);
const app = criarApp({ foto, banco, origem: configuracao.origem });
await app.listen({ host: ENDERECO, port: configuracao.porta });
console.log(`API em http://${ENDERECO}:${configuracao.porta} para o site ${configuracao.origem}.`);
console.log(`Fotos em ${configuracao.pastaDasFotos}; app.db em ${configuracao.arquivoDoApp}.`);
