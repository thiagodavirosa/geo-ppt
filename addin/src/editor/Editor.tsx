import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Caption1, Divider, MessageBar, MessageBarBody, Select, Tab, TabList, Text,
  Toolbar, ToolbarButton, ToolbarDivider, makeStyles, tokens,
} from "@fluentui/react-components";
import { ID_TABELA, TEMAS, aplicarTema, item, remover, renderSvg, validar, verificar, type Dados, type Mapa } from "@geo-ppt/core";
import { carregarCamadas, type Cargas } from "../camadas";
import { baixar, svgParaPng } from "../render";
import { Historico } from "./historico";
import type { Ctx } from "./contexto";
import { Tela } from "./Tela";
import { SecaoCamadas } from "./SecaoCamadas";
import { SecaoElemento } from "./SecaoElemento";
import { SecaoTrechos } from "./SecaoTrechos";
import { SecaoPontos } from "./SecaoPontos";
import { SecaoCaixa } from "./SecaoCaixa";
import { SecaoTabela } from "./SecaoTabela";

const useStyles = makeStyles({
  raiz: { display: "flex", flexDirection: "column", height: "100%", background: tokens.colorNeutralBackground1 },
  barra: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`, borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, flexWrap: "wrap" },
  titulo: { marginRight: tokens.spacingHorizontalM },
  direita: { marginLeft: "auto", display: "flex", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  corpo: { display: "flex", flex: 1, minHeight: 0 },
  lateral: { width: "360px", flexShrink: 0, overflowY: "auto", borderRight: `1px solid ${tokens.colorNeutralStroke1}`, padding: tokens.spacingHorizontalS, boxSizing: "border-box" },
  status: { padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`, borderTop: `1px solid ${tokens.colorNeutralStroke1}`, minHeight: "22px", color: tokens.colorNeutralForeground2 },
  erro: { color: "#b42318" },
  lista: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingTop: tokens.spacingVerticalS },
});

/**
 * Editor de mapa (janela grande do Office ou navegador). Recebe a fonte inicial e devolve a editada em `onAplicar`.
 * O mapa é alterado no lugar (ref) e redesenhado por versão; o histórico guarda instantâneos para desfazer.
 */
export function Editor(p: { inicial: Mapa; rotuloAplicar: string; onAplicar: (m: Mapa) => void; onCancelar: () => void }) {
  const s = useStyles();
  const mapa = useRef<Mapa>(p.inicial);
  const dados = useRef<Dados>({});
  const cargas = useRef<Cargas>({});
  const hist = useRef(new Historico());
  const [versao, setVersao] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [modoPonto, setModoPonto] = useState(false);
  const [aba, setAba] = useState<"propriedades" | "verificar">("propriedades");
  const [msg, setMsg] = useState<{ t: string; erro?: boolean }>({ t: "" });
  const importar = useRef<HTMLInputElement>(null);

  const refrescar = useCallback(() => setVersao((v) => v + 1), []);
  const recarregar = useCallback(async (forcar = false) => {
    const m = mapa.current;
    if (!m.camadas.some((c) => c.origem.tipo === "catalogo" && !c.origem.manual)) return;
    setMsg({ t: "Carregando camadas oficiais (IBGE e DNIT)…" });
    const erros = await carregarCamadas(m, dados.current, cargas.current, { forcar, aoMudar: refrescar });
    if (mapa.current !== m) return;
    refrescar();
    setMsg(erros.length
      ? { t: `Camadas indisponíveis: ${erros.map((c) => c.nome).join(", ")}. Use "Arquivo…" na camada ou o modelo de demonstração.`, erro: true }
      : { t: "Camadas oficiais carregadas." });
  }, [refrescar]);
  useEffect(() => { recarregar(); }, [recarregar]);

  const ctx: Ctx = {
    m: mapa.current, dados: dados.current, cargas: cargas.current, sel, modoPonto, setModoPonto,
    selecionar: setSel,
    mutar: (fn, chave) => { hist.current.antes(mapa.current, chave); fn(mapa.current); refrescar(); },
    antes: () => hist.current.antes(mapa.current),
    refrescar,
    recarregar: (f) => { recarregar(f); },
    aviso: (t, erro) => setMsg({ t, erro }),
  };

  const trocar = (m: Mapa | null) => { if (m) { mapa.current = m; setSel(null); refrescar(); } };
  const desfazer = () => trocar(hist.current.desfazer(mapa.current));
  const refazer = () => trocar(hist.current.refazer(mapa.current));

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const edicao = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName);
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !edicao) { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); return; }
      if ((e.ctrlKey || e.metaKey) && k === "y" && !edicao) { e.preventDefault(); refazer(); return; }
      if (e.key === "Escape") { setModoPonto(false); return; }
      if (edicao || !sel) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        ctx.mutar((m) => { if (sel === ID_TABELA) m.tabela.visivel = false; else remover(m, sel); });
        setSel(null);
        return;
      }
      const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
      if (!d) return;
      e.preventDefault();
      const passo = e.shiftKey ? 8 : 1;
      ctx.mutar((m) => {
        if (sel === ID_TABELA) { if (m.tabela.x !== null && m.tabela.y !== null) { m.tabela.x += d[0] * passo; m.tabela.y += d[1] * passo; } return; }
        const it = item(m, sel);
        if (it && it.caixa.dx !== null && it.caixa.dy !== null) { it.caixa.dx += d[0] * passo; it.caixa.dy += d[1] * passo; }
      }, "setas");
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const alertas = useMemo(() => (aba === "verificar" ? verificar(mapa.current, dados.current) : []), [aba, versao]);
  const m = mapa.current;

  async function exportarPng() {
    const b64 = await svgParaPng(renderSvg(m, dados.current), m.tela.largura, m.tela.altura, 2);
    baixar(`${m.titulo || "mapa"}.png`, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), "image/png");
  }
  async function importarJson(f: File | undefined) {
    if (!f) return;
    try {
      const novo = validar(JSON.parse(await f.text()));
      hist.current.antes(mapa.current);
      novo.id = m.id; novo.revisao = m.revisao;   // continua sendo o mesmo mapa do slide
      trocar(novo);
      recarregar(true);
      setMsg({ t: `Fonte importada de ${f.name}.` });
    } catch (e) { setMsg({ t: `Não foi possível importar: ${(e as Error).message}`, erro: true }); }
  }

  return (
    <div className={s.raiz}>
      <div className={s.barra}>
        <Text weight="semibold" className={s.titulo}>{m.titulo}</Text>
        <Button appearance="primary" onClick={() => { setSel(null); p.onAplicar(mapa.current); }}>{p.rotuloAplicar}</Button>
        <Button onClick={p.onCancelar}>Cancelar</Button>
        <Toolbar size="small" aria-label="Edição">
          <ToolbarDivider />
          <ToolbarButton title="Desfazer (Ctrl+Z)" disabled={!hist.current.podeDesfazer} onClick={desfazer}>↶</ToolbarButton>
          <ToolbarButton title="Refazer (Ctrl+Y)" disabled={!hist.current.podeRefazer} onClick={refazer}>↷</ToolbarButton>
          <ToolbarDivider />
        </Toolbar>
        <Select size="small" aria-label="Tema" value={TEMAS[m.tema] ? m.tema : ""} onChange={(_, d) => ctx.mutar((x) => aplicarTema(x, d.value))}>
          {!TEMAS[m.tema] && <option value="">Tema…</option>}
          {Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.nome}</option>)}
        </Select>
        <span className={s.direita}>
          <Button size="small" onClick={() => baixar(`${m.titulo || "mapa"}.svg`, renderSvg(m, dados.current), "image/svg+xml")}>SVG</Button>
          <Button size="small" onClick={exportarPng}>PNG</Button>
          <Button size="small" title="Exportar a fonte editável" onClick={() => baixar(`${m.titulo || "mapa"}.json`, JSON.stringify(m), "application/json")}>JSON</Button>
          <Button size="small" title="Importar uma fonte (.json)" onClick={() => importar.current?.click()}>Importar JSON</Button>
          <input ref={importar} type="file" accept=".json" hidden onChange={(e) => { importarJson(e.target.files?.[0]); e.target.value = ""; }} />
        </span>
      </div>
      <div className={s.corpo}>
        <aside className={s.lateral}>
          <TabList size="small" selectedValue={aba} onTabSelect={(_, d) => setAba(d.value as typeof aba)}>
            <Tab value="propriedades">Propriedades</Tab>
            <Tab value="verificar">Verificar</Tab>
          </TabList>
          {aba === "propriedades" ? (
            <Accordion multiple collapsible defaultOpenItems={["caixa", "trechos"]}>
              <AccordionItem value="camadas"><AccordionHeader size="small">Camadas</AccordionHeader><AccordionPanel><SecaoCamadas c={ctx} /></AccordionPanel></AccordionItem>
              <AccordionItem value="elemento"><AccordionHeader size="small">Elemento e enquadramento</AccordionHeader><AccordionPanel><SecaoElemento c={ctx} /></AccordionPanel></AccordionItem>
              <AccordionItem value="trechos"><AccordionHeader size="small">Rodovias e trechos (km)</AccordionHeader><AccordionPanel><SecaoTrechos c={ctx} /></AccordionPanel></AccordionItem>
              <AccordionItem value="pontos"><AccordionHeader size="small">Pontos</AccordionHeader><AccordionPanel><SecaoPontos c={ctx} /></AccordionPanel></AccordionItem>
              <AccordionItem value="caixa"><AccordionHeader size="small">Caixa selecionada</AccordionHeader><AccordionPanel><SecaoCaixa c={ctx} /></AccordionPanel></AccordionItem>
              <AccordionItem value="tabela"><AccordionHeader size="small">Tabela</AccordionHeader><AccordionPanel><SecaoTabela c={ctx} /></AccordionPanel></AccordionItem>
            </Accordion>
          ) : (
            <div className={s.lista}>
              {alertas.length === 0 && <MessageBar intent="success"><MessageBarBody>Nada a corrigir.</MessageBarBody></MessageBar>}
              {alertas.map((a, i) => <MessageBar key={i} intent={a.nivel === "erro" ? "error" : "warning"}><MessageBarBody>{a.texto}</MessageBarBody></MessageBar>)}
              <Divider />
              <Caption1>Camadas indisponíveis não entram na verificação de geometria.</Caption1>
            </div>
          )}
        </aside>
        <Tela c={ctx} versao={versao} />
      </div>
      <div className={`${s.status} ${msg.erro ? s.erro : ""}`} role="status">{msg.t}</div>
    </div>
  );
}
