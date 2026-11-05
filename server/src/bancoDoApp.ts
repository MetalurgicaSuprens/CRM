import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/*
 * O app.db: o que o próprio CRM produz (docs/plano.md, "Bancos"). Gravação segura (WAL,
 * synchronous FULL, chaves estrangeiras) e migrações em ordem pelo user_version: a posição na lista
 * é a versão. Migração publicada não muda; mudança nova entra no fim da lista.
 */

const MIGRACOES: readonly string[] = [
  // 1. Login (F3): usuários e os códigos de representante, chaves de acesso, convites, sessões e auditoria.
  `
  CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    id_webauthn TEXT NOT NULL UNIQUE,
    ativo INTEGER NOT NULL CHECK (ativo IN (0, 1)),
    criado_em TEXT NOT NULL
  ) STRICT;

  CREATE TABLE usuario_codigos (
    usuario TEXT NOT NULL REFERENCES usuarios (id),
    codigo TEXT NOT NULL,
    ligado_em TEXT NOT NULL,
    ligado_por TEXT NOT NULL,
    PRIMARY KEY (usuario, codigo)
  ) STRICT;

  CREATE TABLE chaves (
    id TEXT PRIMARY KEY,
    usuario TEXT NOT NULL REFERENCES usuarios (id),
    chave_publica BLOB NOT NULL,
    contador INTEGER NOT NULL,
    transportes TEXT NOT NULL,
    aaguid TEXT NOT NULL,
    provedor TEXT NOT NULL,
    sincronizada INTEGER NOT NULL CHECK (sincronizada IN (0, 1)),
    criada_em TEXT NOT NULL,
    ultimo_uso TEXT,
    revogada_em TEXT
  ) STRICT;
  CREATE INDEX chaves_usuario ON chaves (usuario);

  CREATE TABLE convites (
    hash TEXT PRIMARY KEY,
    usuario TEXT NOT NULL REFERENCES usuarios (id),
    criado_por TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    usado_em TEXT,
    trocado_em TEXT
  ) STRICT;
  CREATE INDEX convites_usuario ON convites (usuario);

  CREATE TABLE sessoes (
    hash TEXT PRIMARY KEY,
    usuario TEXT NOT NULL REFERENCES usuarios (id),
    chave TEXT NOT NULL REFERENCES chaves (id),
    criada_em TEXT NOT NULL,
    ultimo_uso TEXT NOT NULL,
    encerrada_em TEXT,
    motivo TEXT
  ) STRICT;
  CREATE INDEX sessoes_usuario ON sessoes (usuario);

  CREATE TABLE auditoria (
    id INTEGER PRIMARY KEY,
    momento TEXT NOT NULL,
    usuario TEXT,
    evento TEXT NOT NULL,
    alvo TEXT,
    resultado TEXT NOT NULL
  ) STRICT;
  `,
  // 2. Administração (2026-10-16): o papel do login. O admin entra só no site da administração e não tem código.
  `
  ALTER TABLE usuarios ADD COLUMN papel TEXT NOT NULL DEFAULT 'representante' CHECK (papel IN ('representante', 'admin'));
  `,
  // 3. Visitas (2026-10-18): o dia em que o representante visitou o cliente, sem texto livre. O Mapa e a ficha mostram a última.
  `
  CREATE TABLE visitas (
    usuario TEXT NOT NULL REFERENCES usuarios (id),
    cliente TEXT NOT NULL,
    data TEXT NOT NULL,
    registrada_em TEXT NOT NULL,
    PRIMARY KEY (usuario, cliente, data)
  ) STRICT;
  `,
  // 4. Rascunhos (2026-11-05): o pedido em montagem, que a tela salva sozinha; o id é o UUID que ela gera. O nome do cliente vem da foto.
  `
  CREATE TABLE rascunhos (
    id TEXT PRIMARY KEY,
    usuario TEXT NOT NULL REFERENCES usuarios (id),
    cliente TEXT NOT NULL,
    entrega TEXT,
    observacao TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  ) STRICT;
  CREATE INDEX rascunhos_usuario ON rascunhos (usuario, atualizado_em);

  CREATE TABLE rascunho_itens (
    rascunho TEXT NOT NULL REFERENCES rascunhos (id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    produto TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_cento REAL NOT NULL,
    PRIMARY KEY (rascunho, produto)
  ) STRICT;
  `,
];

/** Abre o app.db (cria a pasta e o arquivo na primeira vez) e aplica as migrações que faltam. ":memory:" nos testes. */
export function abrirBancoDoApp(arquivo: string): DatabaseSync {
  if (arquivo !== ":memory:") fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const banco = new DatabaseSync(arquivo);
  try {
    // busy_timeout: a linha de comando do admin grava no mesmo arquivo que o servidor.
    banco.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    migrar(banco);
    return banco;
  } catch (erro) {
    banco.close();
    throw erro;
  }
}

/** Tudo ou nada: o passo que lança desfaz o que já gravou. */
export function emTransacao<T>(banco: DatabaseSync, passo: () => T): T {
  banco.exec("BEGIN IMMEDIATE");
  try {
    const resultado = passo();
    banco.exec("COMMIT");
    return resultado;
  } catch (erro) {
    banco.exec("ROLLBACK");
    throw erro;
  }
}

function migrar(banco: DatabaseSync): void {
  const versao = Number(banco.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  if (versao > MIGRACOES.length) throw new Error(`O app.db está na versão ${versao}, mais nova que a deste servidor (${MIGRACOES.length}).`);
  MIGRACOES.slice(versao).forEach((sql, i) =>
    emTransacao(banco, () => {
      banco.exec(sql);
      banco.exec(`PRAGMA user_version = ${versao + i + 1}`);
    }),
  );
}
