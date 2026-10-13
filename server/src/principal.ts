import { criarApp } from "./app.ts";
import { lerConfiguracao } from "./configuracao.ts";
import { criarFotoAtual } from "./foto/fotoAtual.ts";
import { sessaoDeTeste, type FonteDeSessao } from "./sessao.ts";

/*
 * Sobe a API só no endereço desta máquina: na produção, o Apache fica na frente (docs/plano.md).
 */

const ENDERECO = "127.0.0.1";
/** Sem login (F3), nenhuma rota de representante responde. */
const SEM_LOGIN: FonteDeSessao = () => null;

const configuracao = lerConfiguracao();
const foto = criarFotoAtual(configuracao.pastaDasFotos);
const teste = configuracao.sessaoDeTeste;
const app = criarApp({ foto, sessaoDe: teste ? sessaoDeTeste(teste.nome, teste.codigos) : SEM_LOGIN });
await app.listen({ host: ENDERECO, port: configuracao.porta });
console.log(`API em http://${ENDERECO}:${configuracao.porta}, fotos em ${configuracao.pastaDasFotos}.`);
if (teste) console.log(`Sessão de teste: os códigos ${teste.codigos.join(", ")}, só para quem chama por este computador.`);
