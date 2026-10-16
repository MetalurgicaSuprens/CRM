import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./estilos/global";
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
