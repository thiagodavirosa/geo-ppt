import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as PE } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { adicionarPonto, calcularLayout, deslocar, ID_TABELA, item, layoutTabela, posicionarCaixa, svgBase, svgSobreposicao, type Layout } from "@geo-ppt/core";
import type { Ctx } from "./contexto";

const useStyles = makeStyles({
  area: { flex: 1, minWidth: 0, overflow: "auto", background: tokens.colorNeutralBackground2, padding: "24px", boxSizing: "border-box" },
  moldura: {
    position: "relative", margin: "0 auto", outline: "1px dashed #7a7a7a",
    background: "repeating-conic-gradient(#ececec 0 25%, #ffffff 0 50%) 0 0 / 18px 18px",
  },
  svg: { display: "block", width: "100%", height: "100%", touchAction: "none", userSelect: "none", cursor: "move" },
  ponto: { cursor: "crosshair" },
  alca: { position: "absolute", background: "#111111", border: "2px solid #ffffff", boxShadow: "0 0 0 1px #111111", touchAction: "none", zIndex: 2 },
  alcaE: { right: "-7px", top: "50%", width: "8px", height: "32px", marginTop: "-16px", borderRadius: "4px", cursor: "ew-resize" },
  alcaS: { bottom: "-7px", left: "50%", width: "32px", height: "8px", marginLeft: "-16px", borderRadius: "4px", cursor: "ns-resize" },
  alcaSE: { right: "-8px", bottom: "-8px", width: "12px", height: "12px", borderRadius: "2px", cursor: "nwse-resize", background: "#f35919" },
  legenda: { textAlign: "center", marginTop: "10px", color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

const IDP = "ed";
type Arraste =
  | { tipo: "caixa"; id: string; sx: number; sy: number; dx0: number; dy0: number; movido: boolean }
  | { tipo: "tabela"; sx: number; sy: number; x0: number; y0: number; movido: boolean }
  | { tipo: "mapa"; sx: number; sy: number; dx: number; dy: number; movido: boolean };

/** O elemento (mapa + caixas + tabela) em escala de tela, com arraste, deslocamento, redimensionamento e inserção de pontos. */
export function Tela({ c: ctx, versao }: { c: Ctx; versao: number }) {
  const s = useStyles(), m = ctx.m, W = m.tela.largura, H = m.tela.altura;
  const area = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), base = useRef<SVGGElement>(null), sob = useRef<SVGGElement>(null);
  const layout = useRef<Layout | null>(null), arraste = useRef<Arraste | null>(null);
  const [disp, setDisp] = useState({ w: 800, h: 600 });
  const [escalaFixa, setEscalaFixa] = useState<number | null>(null);

  useEffect(() => {
    const el = area.current!;
    const ro = new ResizeObserver(() => setDisp({ w: el.clientWidth - 48, h: el.clientHeight - 80 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const escala = escalaFixa ?? Math.min(1, Math.max(0.1, disp.w / W), Math.max(0.1, disp.h / H));

  const desenharSobreposicao = () => { if (layout.current && sob.current) sob.current.innerHTML = svgSobreposicao(m, layout.current, { selecionado: ctx.sel, idp: IDP }); };
  useLayoutEffect(() => {
    const L = calcularLayout(m, ctx.dados);
    layout.current = L;
    base.current!.innerHTML = svgBase(m, ctx.dados, L, IDP);
    base.current!.removeAttribute("transform");
    desenharSobreposicao();
  }, [versao, m, ctx.sel, W, H]);

  const paraSvg = (e: PE) => { const p = svg.current!.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.current!.getScreenCTM()!.inverse()); };

  function aoPressionar(e: PE<SVGSVGElement>) {
    if (e.button !== 0) return;
    const p = paraSvg(e), alvo = e.target as Element;
    const cx = alvo.closest("[data-caixa]"), tb = alvo.closest("[data-tabela]");
    e.preventDefault();
    svg.current!.setPointerCapture(e.pointerId);
    if (cx) {
      const id = cx.getAttribute("data-caixa")!, it = item(m, id);
      if (it) arraste.current = { tipo: "caixa", id, sx: p.x, sy: p.y, dx0: it.caixa.dx ?? 0, dy0: it.caixa.dy ?? 0, movido: false };
      return;
    }
    if (tb && m.tabela.x !== null && m.tabela.y !== null) { arraste.current = { tipo: "tabela", sx: p.x, sy: p.y, x0: m.tabela.x, y0: m.tabela.y, movido: false }; return; }
    if (ctx.modoPonto && layout.current) {
      const [lon, lat] = layout.current.P.inv(p.x, p.y);
      let novo = "";
      ctx.mutar((x) => { novo = adicionarPonto(x, lon, lat).id; });
      ctx.setModoPonto(false);
      ctx.selecionar(novo);
      return;
    }
    arraste.current = { tipo: "mapa", sx: p.x, sy: p.y, dx: 0, dy: 0, movido: false };
  }

  function aoMover(e: PE<SVGSVGElement>) {
    const a = arraste.current;
    if (!a) return;
    const p = paraSvg(e), dx = p.x - a.sx, dy = p.y - a.sy;
    if (!a.movido) {
      if (Math.hypot(dx, dy) < 3) return;
      a.movido = true;
      if (a.tipo !== "mapa") ctx.antes();
    }
    const L = layout.current!;
    if (a.tipo === "caixa") {
      const it = item(m, a.id), c = L.caixas.find((x) => x.id === a.id);
      if (!it || !c) return;
      it.caixa.dx = a.dx0 + dx; it.caixa.dy = a.dy0 + dy;
      posicionarCaixa(m, c);
      desenharSobreposicao();
    } else if (a.tipo === "tabela") {
      m.tabela.x = a.x0 + dx; m.tabela.y = a.y0 + dy;
      L.tabela = layoutTabela(m);
      desenharSobreposicao();
    } else {
      a.dx = dx; a.dy = dy;
      const t = `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`;
      base.current!.setAttribute("transform", t);
      sob.current!.querySelectorAll("[data-item]").forEach((g) => g.setAttribute("transform", t));
    }
  }

  function aoSoltar(e: PE<SVGSVGElement>) {
    const a = arraste.current;
    arraste.current = null;
    try { svg.current!.releasePointerCapture(e.pointerId); } catch { /* já liberado */ }
    if (!a) return;
    if (a.tipo === "caixa") { if (a.movido) ctx.refrescar(); ctx.selecionar(a.id); }
    else if (a.tipo === "tabela") { if (a.movido) ctx.refrescar(); ctx.selecionar(ID_TABELA); }
    else if (a.movido) ctx.mutar((x) => deslocar(x, a.dx, a.dy));
    else ctx.selecionar(null);
  }

  /** Alças: redimensionam o elemento; no ajuste "auto" a tabela acompanha proporcionalmente. */
  function redimensionar(dir: "e" | "s" | "se", e: PE<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation();
    const alca = e.currentTarget, x0 = e.clientX, y0 = e.clientY, w0 = W, h0 = H, tx0 = m.tabela.x, ty0 = m.tabela.y, esc = escala;
    const tw = layout.current?.tabela?.w ?? 0, th = layout.current?.tabela?.h ?? 0;
    alca.setPointerCapture(e.pointerId);
    setEscalaFixa(esc);
    let pedido = 0, registrou = false;
    const mover = (ev: PointerEvent) => {
      if (!registrou) { registrou = true; ctx.antes(); }
      const w = dir !== "s" ? Math.round(Math.min(4000, Math.max(200, w0 + (ev.clientX - x0) / esc))) : w0;
      const h = dir !== "e" ? Math.round(Math.min(4000, Math.max(150, h0 + (ev.clientY - y0) / esc))) : h0;
      m.tela.largura = w; m.tela.altura = h; m.tela.predefinicao = "personalizado";
      if (m.enquadramento.ajuste === "auto" && tx0 !== null && ty0 !== null) { m.tabela.x = (tx0 * w) / w0; m.tabela.y = (ty0 * h) / h0; }
      // a tabela fica inteira dentro do elemento sempre que couber
      if (m.tabela.x !== null && m.tabela.y !== null && tw && tw + 16 <= w) m.tabela.x = Math.max(8, Math.min(m.tabela.x, w - tw - 8));
      if (m.tabela.x !== null && m.tabela.y !== null && th && th + 16 <= h) m.tabela.y = Math.max(8, Math.min(m.tabela.y, h - th - 8));
      if (!pedido) pedido = requestAnimationFrame(() => { pedido = 0; ctx.refrescar(); });
    };
    const soltar = () => {
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", soltar);
      alca.removeEventListener("pointercancel", soltar);
      setEscalaFixa(null);
      ctx.refrescar();
    };
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);
  }

  return (
    <div ref={area} className={s.area}>
      <div className={s.moldura} style={{ width: `${W * escala}px`, height: `${H * escala}px` }}>
        <svg ref={svg} className={`${s.svg} ${ctx.modoPonto ? s.ponto : ""}`} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
          onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}>
          <g ref={base} />
          <g ref={sob} />
        </svg>
        <div className={`${s.alca} ${s.alcaE}`} title="Arraste para redimensionar" onPointerDown={(e) => redimensionar("e", e)} />
        <div className={`${s.alca} ${s.alcaS}`} title="Arraste para redimensionar" onPointerDown={(e) => redimensionar("s", e)} />
        <div className={`${s.alca} ${s.alcaSE}`} title="Arraste para redimensionar" onPointerDown={(e) => redimensionar("se", e)} />
      </div>
      <div className={s.legenda}>
        Elemento {W} × {H}{m.tela.transparente ? " · fundo transparente (xadrez)" : ""} · fundo = mover o mapa · caixas e tabela = reposicionar · alças = redimensionar
      </div>
    </div>
  );
}
