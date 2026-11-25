import {
  NOME_PREFIXO, NS_PREFIXO, desempacotar, empacotar, extrairDoAlt, extrairDoXml, nsDe, paraAlt, paraXml, revisaoDoXml, type Fonte,
} from "./fonte";
import { renderSvg, validar } from "@geo-ppt/core";
import { dadosPara } from "./camadas";
import { svgParaPng } from "./render";
import { dividir, montador } from "./mensagens";

/*
 * Persistência no PowerPoint (equivalente ao word.ts do word-fluxo):
 *  - imagem do mapa no slide, com NOME de forma "geo-ppt:<id>" (e tag GEOPPT=<id>);
 *  - fonte compactada numa parte XML personalizada da apresentação (urn:geo-ppt:<id>, atributo revisao) — PowerPointApi 1.7;
 *    sem 1.7, nas configurações do documento (chave "geo-ppt:<id>");
 *  - cópia da fonte no texto alternativo da imagem (recuperação se a parte XML se perder).
 * Partes do PowerPoint mais novas que os tipos instalados são acessadas como `any`.
 */

/** Largura do slide 16:9 padrão, em pontos. */
const LARGURA_SLIDE_PT = 960;
/** Largura de referência do elemento (px) que ocupa metade do slide; mesma proporção px→pt para todos os mapas. */
const TELA_REFERENCIA_PX = 1280;

export interface Forma { slideId: string; shapeId: string; left: number; top: number; width: number; height: number }
export interface MapaLido { fonte: Fonte; origem: "xml" | "config" | "alt"; forma: Forma }
export interface MapaDoc { id: string; titulo: string; slide: number; forma: Forma }
export class ConflitoError extends Error {}

const PPT = () => (globalThis as any).PowerPoint;
const suporta = (set: string, v: string) => { try { return Office.context.requirements.isSetSupported(set, v); } catch { return false; } };
/** Seleção de formas, nomes e navegação (PowerPointApi 1.5). */
export const temApiFormas = () => !!PPT() && suporta("PowerPointApi", "1.5");
/** Partes XML personalizadas (PowerPointApi 1.7). */
const temXml = () => !!PPT() && suporta("PowerPointApi", "1.7");
const chamar = <T>(fn: (cb: (r: Office.AsyncResult<T>) => void) => void) =>
  new Promise<T>((ok, erro) => fn((r) => (r.status === Office.AsyncResultStatus.Succeeded ? ok(r.value) : erro(new Error(r.error.message)))));

export function larguraNoSlide(f: Fonte): number {
  return Math.min(LARGURA_SLIDE_PT * 0.9, (LARGURA_SLIDE_PT * 0.5 * f.tela.largura) / TELA_REFERENCIA_PX);
}

/** Desenha a fonte (carregando as camadas oficiais) e prepara imagem, fonte compactada e texto alternativo. */
async function preparar(fonte: Fonte) {
  const { dados } = await dadosPara(fonte);
  const png = await svgParaPng(renderSvg(fonte, dados), fonte.tela.largura, fonte.tela.altura);
  const empacotado = await empacotar(fonte);
  return { png, empacotado, alt: paraAlt(fonte, empacotado) };
}

/* ---------- fonte: XML / configurações ---------- */
async function lerXml(ctx: any, id: string): Promise<{ partes: any[]; xml: string | null }> {
  if (!temXml()) return { partes: [], xml: null };
  const partes = ctx.presentation.customXmlParts.getByNamespace(nsDe(id));
  partes.load("items");
  await ctx.sync();
  if (!partes.items.length) return { partes: [], xml: null };
  const xml = partes.items[0].getXml();
  await ctx.sync();
  return { partes: partes.items, xml: xml.value };
}
const chaveConfig = (id: string) => NOME_PREFIXO + id;
function lerConfig(id: string): { revisao: number; fonte: string } | null {
  try { return (Office.context.document.settings.get(chaveConfig(id)) as { revisao: number; fonte: string }) ?? null; } catch { return null; }
}
async function gravarConfig(id: string, v: { revisao: number; fonte: string } | null) {
  const s = Office.context.document.settings;
  if (v) s.set(chaveConfig(id), v); else s.remove(chaveConfig(id));
  await chamar<void>((cb) => s.saveAsync(cb as any));
}

async function lerFontePorId(ctx: any, id: string, shape: any): Promise<{ fonte: Fonte; origem: MapaLido["origem"] } | null> {
  const { xml } = await lerXml(ctx, id);
  const doXml = xml && extrairDoXml(xml);
  if (doXml) {
    // A revisão que vale é a do atributo (é o que a coedição compara), não a gravada dentro da fonte.
    const fonte = await desempacotar(doXml), rev = revisaoDoXml(xml!);
    if (Number.isFinite(rev)) fonte.revisao = rev;
    return { fonte, origem: "xml" };
  }
  const cfg = lerConfig(id);
  if (cfg?.fonte) return { fonte: await desempacotar(cfg.fonte), origem: "config" };
  try {
    shape.load("altTextDescription");
    await ctx.sync();
    const doAlt = extrairDoAlt(shape.altTextDescription);
    if (doAlt) return { fonte: await desempacotar(doAlt), origem: "alt" };
  } catch { /* texto alternativo indisponível nesta versão */ }
  return null;
}

const formaDe = (slideId: string, s: any): Forma => ({ slideId, shapeId: s.id, left: s.left, top: s.top, width: s.width, height: s.height });

/* ---------- leitura ---------- */
/** Mapa sob a seleção (forma nomeada "geo-ppt:<id>"). */
export async function lerSelecao(): Promise<MapaLido | null> {
  if (!temApiFormas()) return null;
  return PPT().run(async (ctx: any) => {
    const sel = ctx.presentation.getSelectedShapes(), slides = ctx.presentation.getSelectedSlides();
    sel.load("items/id,items/name,items/left,items/top,items/width,items/height");
    slides.load("items/id");
    await ctx.sync();
    const s = sel.items.find((x: any) => String(x.name || "").startsWith(NOME_PREFIXO));
    if (!s || !slides.items.length) return null;
    const lida = await lerFontePorId(ctx, s.name.slice(NOME_PREFIXO.length), s);
    return lida ? { ...lida, forma: formaDe(slides.items[0].id, s) } : null;
  });
}

/** Todos os mapas do suplemento, na ordem dos slides. */
export async function listarMapas(): Promise<MapaDoc[]> {
  if (!temApiFormas()) return [];
  return PPT().run(async (ctx: any) => {
    const slides = ctx.presentation.slides;
    slides.load("items/id");
    await ctx.sync();
    const cols = slides.items.map((sl: any) => { const c = sl.shapes; c.load("items/id,items/name,items/left,items/top,items/width,items/height"); return c; });
    await ctx.sync();
    const out: MapaDoc[] = [];
    slides.items.forEach((sl: any, i: number) => cols[i].items.forEach((s: any) => {
      const nome = String(s.name || "");
      if (nome.startsWith(NOME_PREFIXO)) out.push({ id: nome.slice(NOME_PREFIXO.length), titulo: "", slide: i + 1, forma: formaDe(sl.id, s) });
    }));
    return out;
  });
}

export async function lerMapa(m: MapaDoc): Promise<MapaLido | null> {
  return PPT().run(async (ctx: any) => {
    const s = ctx.presentation.slides.getItem(m.forma.slideId).shapes.getItem(m.forma.shapeId);
    const lida = await lerFontePorId(ctx, m.id, s);
    return lida ? { ...lida, forma: m.forma } : null;
  });
}

export async function irParaMapa(m: MapaDoc): Promise<void> {
  await PPT().run(async (ctx: any) => {
    ctx.presentation.setSelectedSlides([m.forma.slideId]);
    await ctx.sync();
    ctx.presentation.slides.getItem(m.forma.slideId).setSelectedShapes([m.forma.shapeId]);
    await ctx.sync();
  });
}

/* ---------- escrita ---------- */
async function idsDoSlide(slideId?: string): Promise<{ slideId: string; ids: string[] }> {
  return PPT().run(async (ctx: any) => {
    const slide = slideId ? ctx.presentation.slides.getItem(slideId) : ctx.presentation.getSelectedSlides().getItemAt(0);
    slide.load("id");
    const c = slide.shapes;
    c.load("items/id");
    await ctx.sync();
    return { slideId: slide.id, ids: c.items.map((x: any) => x.id) };
  });
}

/** Coloca a imagem no slide (na seleção, ou no lugar de `alvo`) e devolve a forma nova, já nomeada. */
async function colocarImagem(fonte: Fonte, png: string, alt: string, alvo?: Forma): Promise<Forma> {
  if (alvo && temApiFormas()) await PPT().run(async (ctx: any) => { ctx.presentation.setSelectedSlides([alvo.slideId]); await ctx.sync(); });
  const largura = alvo?.width ?? larguraNoSlide(fonte);
  const opts: Office.SetSelectedDataOptions = {
    coercionType: Office.CoercionType.Image,
    imageWidth: largura,
    imageHeight: (largura * fonte.tela.altura) / fonte.tela.largura,
    ...(alvo ? { imageLeft: alvo.left, imageTop: alvo.top } : {}),
  };
  const antes = temApiFormas() ? await idsDoSlide(alvo?.slideId) : null;
  await chamar<void>((cb) => Office.context.document.setSelectedDataAsync(png, opts, cb as any));
  if (!antes) throw new Error("Imagem inserida, mas esta versão do PowerPoint não permite identificá-la (requer PowerPointApi 1.5).");
  return PPT().run(async (ctx: any) => {
    const slide = ctx.presentation.slides.getItem(antes.slideId), shapes = slide.shapes;
    shapes.load("items/id,items/name,items/left,items/top,items/width,items/height");
    await ctx.sync();
    const novas = shapes.items.filter((x: any) => !antes.ids.includes(x.id));
    const shp = novas[novas.length - 1];
    if (!shp) throw new Error("A imagem não foi encontrada no slide após a inserção.");
    shp.name = NOME_PREFIXO + fonte.id;
    try { shp.tags.add("GEOPPT", fonte.id); } catch { /* tags: PowerPointApi 1.3 */ }
    try { shp.altTextTitle = fonte.titulo; shp.altTextDescription = alt; } catch { /* texto alternativo pela API: versões recentes */ }
    if (alvo) shapes.items.find((x: any) => x.id === alvo.shapeId)?.delete();
    await ctx.sync();
    try { slide.setSelectedShapes([shp.id]); await ctx.sync(); } catch { /* seleção é cortesia */ }
    return formaDe(antes.slideId, shp);
  });
}

async function gravarFonte(fonte: Fonte, empacotado: string) {
  if (temXml()) {
    await PPT().run(async (ctx: any) => {
      const { partes } = await lerXml(ctx, fonte.id);
      partes.forEach((p) => p.delete());
      ctx.presentation.customXmlParts.add(paraXml(fonte, empacotado));
      await ctx.sync();
    });
    if (lerConfig(fonte.id)) await gravarConfig(fonte.id, null);
  } else await gravarConfig(fonte.id, { revisao: fonte.revisao, fonte: empacotado });
}

/** Insere o mapa no slide atual e grava a fonte. */
export async function inserirMapa(fonte: Fonte): Promise<Forma> {
  const { png, empacotado, alt } = await preparar(fonte);
  const forma = await colocarImagem(fonte, png, alt);
  await gravarFonte(fonte, empacotado);
  return forma;
}

/** Substitui imagem e fonte no mesmo lugar. `revisaoBase` é a revisão que o editor abriu. */
export async function atualizarMapa(fonte: Fonte, revisaoBase: number, forma: Forma): Promise<{ fonte: Fonte; forma: Forma }> {
  const atual = temXml()
    ? await PPT().run(async (ctx: any) => { const { xml } = await lerXml(ctx, fonte.id); return xml ? revisaoDoXml(xml) : NaN; })
    : lerConfig(fonte.id)?.revisao ?? NaN;
  if (Number.isFinite(atual) && atual !== revisaoBase) {
    throw new ConflitoError(`O mapa foi alterado por outra pessoa (revisão ${atual}, aberta ${revisaoBase}). Feche e abra de novo.`);
  }
  const nova: Fonte = { ...fonte, revisao: revisaoBase + 1 };
  const { png, empacotado, alt } = await preparar(nova);
  const nf = await colocarImagem(nova, png, alt, forma);
  await gravarFonte(nova, empacotado);
  return { fonte: nova, forma: nf };
}

export interface ResultadoLote { mapas: number; alterados: number; falhas: string[] }

/** Aplica uma transformação a todos os mapas (substituir, tema, atualizar camadas). `transformar` devolve null quando nada muda. */
export async function aplicarEmTodos(transformar: (f: Fonte) => Fonte | null, somenteContar = false, aoProgredir?: (i: number, n: number) => void): Promise<ResultadoLote> {
  const lista = await listarMapas();
  const r: ResultadoLote = { mapas: lista.length, alterados: 0, falhas: [] };
  for (const [i, item] of lista.entries()) {
    aoProgredir?.(i + 1, lista.length);
    try {
      const lida = await lerMapa(item);
      const novo = lida && transformar(structuredClone(lida.fonte));
      if (!lida || !novo) continue;
      r.alterados++;
      if (!somenteContar) await atualizarMapa(novo, lida.fonte.revisao, lida.forma);
    } catch (e) {
      r.falhas.push(`Slide ${item.slide}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return r;
}

/** Remove fontes (XML/configurações) de mapas que já não estão em nenhum slide. */
export async function limparOrfas(vivos: Set<string>): Promise<number> {
  let n = 0;
  if (temXml()) {
    n += await PPT().run(async (ctx: any) => {
      const partes = ctx.presentation.customXmlParts;
      partes.load("items/namespaceUri");
      await ctx.sync();
      const mortas = partes.items.filter((p: any) => String(p.namespaceUri).startsWith(NS_PREFIXO) && !vivos.has(String(p.namespaceUri).slice(NS_PREFIXO.length)));
      mortas.forEach((p: any) => p.delete());
      await ctx.sync();
      return mortas.length;
    });
  }
  return n;
}

export function aoMudarSelecao(cb: () => void): () => void {
  const tipo = Office.EventType.DocumentSelectionChanged;
  Office.context.document.addHandlerAsync(tipo, cb);
  return () => Office.context.document.removeHandlerAsync(tipo, { handler: cb });
}

/**
 * Abre o editor numa janela grande (Dialog API). Resolve com a fonte editada,
 * ou null se o usuário cancelar ou fechar a janela.
 */
export function abrirEditor(fonte: Fonte, rotuloAplicar: string): Promise<Fonte | null> {
  return new Promise((resolve, reject) => {
    // O parâmetro t evita que o PowerPoint reuse uma cópia antiga da página do editor (o GitHub Pages permite cache de 10 min).
    const url = new URL(`${import.meta.env.BASE_URL}editor.html?t=${Date.now()}`, location.origin).href;
    Office.context.ui.displayDialogAsync(url, { height: 92, width: 92, displayInIframe: false }, (r) => {
      if (r.status !== Office.AsyncResultStatus.Succeeded) return reject(new Error(r.error.message));
      const dialogo = r.value;
      let concluido = false;
      const fim = (valor: Fonte | null) => {
        if (concluido) return;
        concluido = true;
        try { dialogo.close(); } catch { /* janela já fechada */ }
        resolve(valor);
      };
      const receber = montador((msg) => {
        if (msg.tipo === "pronto") dividir({ tipo: "abrir", fonte, rotulo: rotuloAplicar }).forEach((p) => dialogo.messageChild(p));
        else if (msg.tipo === "aplicar") {
          try { fim(validar(msg.fonte)); } catch (e) { reject(e); fim(null); }
        } else if (msg.tipo === "cancelar") fim(null);
      });
      dialogo.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => receber((arg as { message: string }).message));
      dialogo.addEventHandler(Office.EventType.DialogEventReceived, () => fim(null));
    });
  });
}
