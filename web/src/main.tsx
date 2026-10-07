import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Só o subconjunto latino: cobre o português, inclusive o sinal de menos (−) e o •.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/oswald/latin-500.css";
import "./estilos/tokens.css";
import "./estilos/base.css";
import { App } from "./App";
import { ProvedorValores } from "./contexto/valores";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Elemento #raiz não encontrado no index.html");

createRoot(raiz).render(
  <StrictMode>
    <ProvedorValores>
      <App />
    </ProvedorValores>
  </StrictMode>,
);
