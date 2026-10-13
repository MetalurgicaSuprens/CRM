import type { Foto } from "dominio/esquemaDaFoto";
import { montarFoto } from "./calculo/foto.ts";
import { lerConfiguracao } from "./configuracao.ts";
import { lerDadosDoErp } from "./erp/lerDoErp.ts";
import { gravarFoto } from "./foto/gravar.ts";
import { abrirOracle } from "./oracle.ts";

/*
 * Gera uma foto: lê o ERP, aplica as regras e grava a foto.db na pasta de fotos.
 * Uso: npm run foto -- [--env <arquivo .env>] [--dados <pasta>]
 * O resumo só tem contagens: nenhum nome, código de cliente ou valor do .env.
 */

const inicio = Date.now();
const configuracao = lerConfiguracao(process.argv.slice(2));
const oracle = await abrirOracle(configuracao.oracle);
try {
  const { referencia, dados } = await lerDadosDoErp(oracle, configuracao.autorizados, (mensagem) => console.log(`  ${mensagem}`));
  const foto = montarFoto(dados, referencia, configuracao.autorizados, configuracao.chaveDoIdDoCliente);
  const arquivo = gravarFoto(foto, configuracao.pastaDasFotos);
  console.log(resumir(foto, arquivo, Date.now() - inicio));
} finally {
  await oracle.fechar();
}

function resumir(foto: Foto, arquivo: string, duracaoMs: number): string {
  const contagens = Object.entries(foto)
    .filter(([, conteudo]) => Array.isArray(conteudo))
    .map(([tabela, linhas]) => `  ${tabela}: ${(linhas as unknown[]).length}`);
  const pedidosSemCliente = foto.pedido_aberto.filter((pedido) => pedido.cliente === null).length;
  const notasSemCliente = foto.nota.filter((nota) => nota.cliente === null).length;
  return [
    `Foto de ${foto.foto.gerada_em} gravada em ${arquivo} (${(duracaoMs / 1000).toFixed(1)} s).`,
    ...contagens,
    `  pedidos de cliente fora da carteira dos autorizados: ${pedidosSemCliente}`,
    `  notas de cliente fora da carteira dos autorizados: ${notasSemCliente}`,
  ].join("\n");
}
