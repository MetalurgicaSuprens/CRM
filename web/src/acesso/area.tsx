import { createContext, useContext } from "react";

/*
 * As telas de entrada e de convite servem aos dois sites: o CRM, dos representantes, e a
 * administração. A área diz qual, para os textos que mudam de um para o outro.
 */

export type Area = {
  /** Ao lado da marca, nas telas de entrada e de convite; o CRM fica só com a marca. */
  nome: string | null;
  /** "Da próxima vez, é só abrir ..." */
  oSite: string;
  /** "Entrar ..." */
  noSite: string;
  /** "Você foi convidado para ..." */
  convidadoPara: string;
  ajudaDoPrimeiroAcesso: string;
  ajudaDoAcessoPerdido: string;
  /** Depois de criar a chave, como entrar também pelo computador; a administração já é aberta nele. */
  dicaDoComputador: string | null;
};

export const AREA_DO_CRM: Area = {
  nome: null,
  oSite: "o CRM",
  noSite: "no CRM",
  convidadoPara: "o CRM dos representantes da Suprens",
  ajudaDoPrimeiroAcesso: "abra o link do convite que você recebeu do administrador.",
  ajudaDoAcessoPerdido: "peça um novo convite ao administrador do CRM.",
  dicaDoComputador: 'Vai usar o CRM também no computador? Na tela de entrada dele, escolha "usar outro aparelho" e leia o QR code com este celular.',
};

export const AREA_DA_ADMINISTRACAO: Area = {
  nome: "Administração",
  oSite: "a administração",
  noSite: "na administração",
  convidadoPara: "a administração do CRM dos representantes da Suprens",
  ajudaDoPrimeiroAcesso: 'no servidor, rode npm run admin -- criar-admin --nome "Seu nome" e abra o link que ele escreve.',
  ajudaDoAcessoPerdido: "no servidor, gere um convite novo com npm run admin -- novo-convite.",
  dicaDoComputador: null,
};

const ContextoDaArea = createContext<Area>(AREA_DO_CRM);

export const ProvedorDaArea = ContextoDaArea.Provider;

export function useArea(): Area {
  return useContext(ContextoDaArea);
}
