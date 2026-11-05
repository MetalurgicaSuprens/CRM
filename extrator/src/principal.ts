import type { Foto } from "dominio/esquemaDaFoto";
import { montarFoto } from "./calculo/foto.ts";
import { lerConfiguracao } from "./configuracao.ts";
import { lerDadosDoErp } from "./erp/lerDoErp.ts";
import { FotoRecusada, gravarFoto } from "./foto/gravar.ts";
import { localizarClientes, type ResumoDaLocalizacao } from "./localizacao/localizarClientes.ts";
import { abrirOracle } from "./oracle.ts";

/*
 * Gera uma foto: lê o ERP, põe o ponto do endereço das empresas, aplica as regras e grava a foto.db
 * na pasta de fotos, com o manifesto. A foto que mudou demais desde a anterior não é gravada.
 * Uso: npm run foto -- [--env <arquivo .env>] [--dados <pasta>] [--aceitar-mudanca]
 * O resumo só tem contagens: nenhum nome, código de cliente ou valor do .env.
 */

const inicio = Date.now();
const configuracao = lerConfiguracao(process.argv.slice(2));
const oracle = await abrirOracle(configuracao.oracle);
try {
  const { referencia, dados } = await lerDadosDoErp(oracle, configuracao.autorizados, (mensagem) => console.log(`  ${mensagem}`));
  const inicioDaLocalizacao = Date.now();
  const { carteira, resumo: localizacao } = await localizarClientes(dados.carteira, configuracao.localizacao);
  console.log(`  pontos dos endereços: ${((Date.now() - inicioDaLocalizacao) / 1000).toFixed(1)} s`);
  const foto = montarFoto({ ...dados, carteira }, referencia, configuracao.autorizados, configuracao.chaveDoIdDoCliente);
  const { arquivo, semComparar } = gravarFoto(foto, configuracao.pastaDasFotos, { aceitarMudanca: configuracao.aceitarMudanca });
  console.log(resumir(foto, arquivo, Date.now() - inicio));
  if (semComparar) console.log(`  sem comparar com a foto anterior: ${semComparar}`);
  console.log(resumirALocalizacao(localizacao));
} catch (erro) {
  if (!(erro instanceof FotoRecusada)) throw erro;
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await oracle.fechar();
}

/** Só contagens e códigos IBGE de município, que são públicos. */
function resumirALocalizacao({ comPonto, semPonto, buscados, municipiosSemArquivo }: ResumoDaLocalizacao): string {
  const linhas = [`  clientes com ponto no mapa: ${comPonto}; sem ponto: ${semPonto}; endereços buscados no CNEFE agora: ${buscados}`];
  if (municipiosSemArquivo.length > 0) {
    linhas.push(`  municípios sem o arquivo do CNEFE na pasta de dados (baixe do IBGE e rode de novo): ${municipiosSemArquivo.join(", ")}`);
  }
  return linhas.join("\n");
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
