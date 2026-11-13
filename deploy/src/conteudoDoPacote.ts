/*
 * O que nunca vai ao servidor do CRM, mesmo que caia na pasta do pacote por engano (CLAUDE.md,
 * "Segurança"): segredos, bancos de dados, o extrator e o driver do Oracle.
 */

const EXTENSOES_DE_CHAVE = [".pem", ".key", ".crt", ".p12", ".pfx"];
const PASTAS_QUE_FICAM_NA_LAN = ["data", "extrator"];

/** Por que o arquivo fica fora do pacote, ou null se ele pode ir. O caminho é relativo à raiz do pacote. */
export function motivoParaFicarFora(caminho: string): string | null {
  const partes = caminho.split(/[\\/]/);
  const nome = (partes.at(-1) ?? "").toLowerCase();
  if (isArquivoDeAmbiente(nome)) return "segredo (.env)";
  if (EXTENSOES_DE_CHAVE.some((extensao) => nome.endsWith(extensao)) || /^id_(rsa|ed25519)/.test(nome)) return "chave ou certificado";
  if (/\.(db|sqlite)(-.*)?$/.test(nome) || nome.endsWith(".part")) return "banco de dados";
  if (PASTAS_QUE_FICAM_NA_LAN.includes(partes[0] ?? "")) return "só fica na rede interna";
  if (partes.includes("oracledb")) return "driver do Oracle";
  return null;
}

function isArquivoDeAmbiente(nome: string): boolean {
  return (nome === ".env" || nome.startsWith(".env.")) && nome !== ".env.example";
}

/** Os arquivos que não podem ir, cada um com o motivo. */
export function arquivosProibidos(caminhos: readonly string[]): string[] {
  return caminhos.flatMap((caminho) => {
    const motivo = motivoParaFicarFora(caminho);
    return motivo ? [`${caminho}: ${motivo}`] : [];
  });
}
