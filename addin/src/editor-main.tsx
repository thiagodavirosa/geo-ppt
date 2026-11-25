import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { temaEis } from "./tema";
import { instanciarModelo, validar, type Mapa } from "@geo-ppt/core";
import { Editor } from "./editor/Editor";
import { dividir, montador } from "./mensagens";

/**
 * Página da janela de diálogo do PowerPoint. O painel envia o mapa por mensagem ("abrir")
 * e recebe "aplicar" (com o mapa editado) ou "cancelar".
 * Com `?demo=<modelo>` (demo, projetos, uf, pontes, localizacao, branco; `&uf=RR&tema=cinza`) abre fora do PowerPoint, para desenvolvimento.
 */
const raizEl = document.getElementById("root")!;
const raiz = createRoot(raizEl);

/** Em vez de uma janela cinza, mostra o que está acontecendo (ou o erro) na própria janela do editor. */
function mostrarEstado(titulo: string, detalhe = "") {
  const div = document.createElement("div");
  div.setAttribute("role", "status");
  div.style.cssText = "font:14px Arial,sans-serif;padding:24px;color:#111;background:#fff;height:100%;box-sizing:border-box;white-space:pre-wrap";
  div.textContent = detalhe ? `${titulo}\n\n${detalhe}` : titulo;
  raizEl.replaceChildren(div);
}
const textoErro = (e: unknown) => (e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e));
window.addEventListener("error", (e) => mostrarEstado("Erro ao carregar o editor", textoErro(e.error ?? e.message)));
window.addEventListener("unhandledrejection", (e) => mostrarEstado("Erro ao carregar o editor", textoErro(e.reason)));
mostrarEstado("Carregando o editor…");

function montar(inicial: Mapa, rotuloAplicar: string, onAplicar: (m: Mapa) => void, onCancelar: () => void) {
  raizEl.replaceChildren();
  raiz.render(
    <FluentProvider theme={temaEis} style={{ height: "100%" }}>
      <Editor inicial={inicial} rotuloAplicar={rotuloAplicar} onAplicar={onAplicar} onCancelar={onCancelar} />
    </FluentProvider>,
  );
}

const q = new URLSearchParams(location.search);
const demo = q.get("demo");
if (demo !== null) {
  const m = instanciarModelo(demo || "demo", (q.get("uf") || "AM").toUpperCase(), q.get("tema") || "dnit");
  montar(m, "Aplicar", (d) => console.log("aplicar", d), () => console.log("cancelar"));
} else {
  const espera = setTimeout(() => mostrarEstado("Aguardando o PowerPoint enviar o mapa…", "Se esta mensagem não sumir, feche esta janela e tente de novo."), 6000);
  Office.onReady(() => {
    const enviar = (msg: object) => dividir(msg).forEach((p) => Office.context.ui.messageParent(p));
    const receber = montador((msg) => {
      try {
        if (msg.tipo === "abrir") {
          clearTimeout(espera);
          montar(validar(msg.fonte), msg.rotulo, (d) => enviar({ tipo: "aplicar", fonte: d }), () => enviar({ tipo: "cancelar" }));
        }
      } catch (e) {
        mostrarEstado("Não foi possível abrir o mapa", textoErro(e));
      }
    });
    Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (arg) => receber((arg as unknown as { message: string }).message));
    enviar({ tipo: "pronto" });
  });
}
