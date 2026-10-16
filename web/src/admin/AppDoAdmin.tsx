import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AREA_DA_ADMINISTRACAO, ProvedorDaArea } from "../acesso/area";
import { Convite } from "../paginas/Convite";
import { Entrar } from "../paginas/Entrar";
import { LayoutDoAdmin } from "./LayoutDoAdmin";
import { DetalheDoLogin } from "./paginas/DetalheDoLogin";
import { Logins } from "./paginas/Logins";
import { NovoLogin } from "./paginas/NovoLogin";
import { Registro } from "./paginas/Registro";

/** A administração: as mesmas telas de entrada e de convite do CRM, com os textos dela, e as telas de gestão. */
export function AppDoAdmin() {
  return (
    <ProvedorDaArea value={AREA_DA_ADMINISTRACAO}>
      <BrowserRouter>
        <Routes>
          <Route path="entrar" element={<Entrar />} />
          <Route path="convite" element={<Convite />} />
          <Route element={<LayoutDoAdmin />}>
            <Route index element={<Logins />} />
            <Route path="logins/novo" element={<NovoLogin />} />
            <Route path="logins/:id" element={<DetalheDoLogin />} />
            <Route path="registro" element={<Registro />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProvedorDaArea>
  );
}
