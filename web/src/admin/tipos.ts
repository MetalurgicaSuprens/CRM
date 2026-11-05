/*
 * O contrato da API da administração (server/src/admin): o que as telas recebem e mandam.
 */

export type Papel = "representante" | "admin";

/**
 * "ativo": tem chave que vale; "aguardando": sem chave, com convite valendo (o primeiro acesso, ou
 * um aparelho novo); "sem_acesso": sem chave nem convite que valha; "desativado": o login foi desligado.
 */
export type SituacaoDoLogin = "ativo" | "aguardando" | "sem_acesso" | "desativado";

/** "trocado": saiu um convite mais novo para o mesmo login, e só o último link vale. */
export type EstadoDoConvite = "valendo" | "usado" | "expirado" | "trocado";

export type CodigoDoLogin = { codigo: string; nome: string | null };

export type ConviteNaGestao = { criadoEm: string; validoAte: string; estado: EstadoDoConvite; usadoEm: string | null };

export type LoginNaGestao = {
  id: string;
  nome: string;
  papel: Papel;
  situacao: SituacaoDoLogin;
  criadoEm: string;
  codigos: CodigoDoLogin[];
  chavesAtivas: number;
  /** Os provedores das chaves que valem: Google, Apple, Windows Hello... */
  provedores: string[];
  ultimaEntrada: string | null;
  sessoesAbertas: number;
  ultimoConvite: ConviteNaGestao | null;
};

export type ChaveNaGestao = { id: string; provedor: string; sincronizada: boolean; criadaEm: string; ultimoUso: string | null; bloqueadaEm: string | null };

/** "motivo" do fim: saiu, inatividade, limite ou revogada (chave bloqueada ou login desativado). */
export type SessaoNaGestao = { criadaEm: string; ultimoUso: string; aberta: boolean; encerradaEm: string | null; motivo: string | null; provedor: string };

export type DetalheDoLogin = LoginNaGestao & { chaves: ChaveNaGestao[]; convites: ConviteNaGestao[]; sessoes: SessaoNaGestao[] };

export type EventoDoRegistro = {
  id: number;
  momento: string;
  /** Quem fez: o nome do login, "Linha de comando" ou nulo, como na entrada com chave desconhecida. */
  quem: string | null;
  idDeQuem: string | null;
  evento: string;
  /** O alvo descrito: o nome do login, a chave pelo provedor e o dono, o cliente pelo nome. */
  alvo: string | null;
  /** "ok" ou o motivo da recusa. */
  resultado: string;
};

export type PaginaDoRegistro = { eventos: EventoDoRegistro[]; temMais: boolean };

/** Um código da lista de autorizados da foto e o login ativo que já o usa, se houver. */
export type RepresentanteAutorizado = {
  codigo: string;
  nome: string;
  login: { id: string; nome: string } | null;
  /** O faturado nos 12 meses fechados, pelas vendas atribuídas ao código (a visão do representante, a do Início). */
  faturado12m: number | null;
};

export type ListaDeAutorizados = {
  /** Os 12 meses fechados do faturado, de "2025-10" a "2026-09"; nulo sem foto. */
  periodo: { inicio: string; fim: string } | null;
  representantes: RepresentanteAutorizado[];
};

export type SituacaoDaAdministracao = {
  admin: { id: string; nome: string };
  /** Agora, em Brasília ("2026-10-16T09:15"). */
  relogio: string;
  foto: { geradaEm: string; dataRef: string; representantes: number; clientes: number } | null;
  /** A carga do ERP que o servidor recusou desde a que está em uso; o momento é em Brasília. Null se não houve. */
  cargaRecusada: { momento: string; motivo: string } | null;
};

/** O link sai uma vez só: o banco guarda só o hash do token. */
export type ConviteGerado = { idDoLogin: string; nome: string; link: string; validoAte: string };
