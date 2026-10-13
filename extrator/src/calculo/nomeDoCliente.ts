/** O fantasia do ERP tem 25 caracteres: com 24 ou mais, ele quase sempre veio cortado. */
const FANTASIA_CORTADO = 24;

/**
 * Nome na tela: o fantasia; sem ele, a razão social; e a razão quando o fantasia veio cortado e
 * ela é mais longa (regra validada no protótipo antigo, CRM-prototipo/REGRAS.md).
 */
export function nomeDoCliente(fantasia: string, razaoSocial: string): string {
  if (!fantasia) return razaoSocial;
  if (fantasia.length >= FANTASIA_CORTADO && razaoSocial.length > fantasia.length) return razaoSocial;
  return fantasia;
}
