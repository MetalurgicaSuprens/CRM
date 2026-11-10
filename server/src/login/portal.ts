import type { Papel } from "./usuarios.ts";

/*
 * Os dois sites do sistema: o CRM, dos representantes, e a administração, só de quem administra.
 * Cada um tem o seu cookie de sessão e só aceita os logins do próprio papel: a sessão e a chave de
 * um não valem no outro, nem neste computador, onde os dois ficam em "localhost".
 */

export type Portal = {
  papel: Papel;
  /** O nome do cookie da sessão. Com o prefixo __Host-, ele só vale no endereço que o gravou. */
  cookie: string;
  /** O nome que o gerenciador de chaves do aparelho mostra ao lado da chave. */
  nome: string;
};

export const PORTAL_DO_CRM: Portal = { papel: "representante", cookie: "__Host-crm", nome: "CRM Suprens" };
/** O CRM aberto na rede interna com o login provisório (loginProvisorio.ts), por http: o cookie fica sem o prefixo __Host-. */
export const PORTAL_DA_REDE_INTERNA: Portal = { ...PORTAL_DO_CRM, cookie: "crm-rede-interna" };
export const PORTAL_DO_ADMIN: Portal = { papel: "admin", cookie: "__Host-crm-admin", nome: "Administração do CRM Suprens" };
