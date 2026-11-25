import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { temaEis } from "./tema";
import { App } from "./App";
import { ForaDoOffice } from "./painel/ForaDoOffice";

const raiz = createRoot(document.getElementById("root")!);
const montar = (dentro: boolean) =>
  raiz.render(<FluentProvider theme={temaEis}>{dentro ? <App /> : <ForaDoOffice />}</FluentProvider>);

if (typeof Office === "undefined") montar(false);
else Office.onReady((info) => montar(info.host === Office.HostType.PowerPoint));
