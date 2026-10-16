/*
 * O que toda página dos dois sites carrega antes de tudo: as fontes, hospedadas aqui mesmo (CSP), os
 * tokens de cor e espaço e o CSS de base. O CRM (src/main.tsx) e a administração (admin/main.tsx).
 */

// Só o subconjunto latino: cobre o português, inclusive o sinal de menos (−) e o •.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/oswald/latin-500.css";
import "./tokens.css";
import "./base.css";
