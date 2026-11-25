import {
  defCatalogo, deGeoJson, envelope, envelopeValido, ENVELOPE_UF, escolherWfs, feicoesDoQuadro, lerGeoJson, pareceProjetado, pontoInterno,
  reprojetar, siglaPorCodigo, srcDoTexto, UFS, CAPITAIS, urlsIbge, urlsWfs, type Camada, type Dados, type Feicao, type Mapa,
} from "@geo-ppt/core";

/** Situação de carga de cada camada do catálogo (não é gravada na fonte). */
export interface EstadoCarga { estado: "ocioso" | "carregando" | "ok" | "erro"; msg: string; uf: string }
export type Cargas = Record<string, EstadoCarga>;

/* ---------- rede com cache (IndexedDB) ---------- */
let bd: IDBDatabase | null | false = null;
async function abrirBd(): Promise<IDBDatabase | false> {
  if (bd !== null) return bd;
  bd = await new Promise<IDBDatabase | false>((ok) => {
    try {
      const r = indexedDB.open("geo-ppt-cache", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("c");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(false);
    } catch { ok(false); }
  });
  return bd;
}
async function lerCache(k: string): Promise<{ t: number; v: unknown } | null> {
  const db = await abrirBd();
  if (!db) return null;
  return new Promise((ok) => {
    try { const q = db.transaction("c").objectStore("c").get(k); q.onsuccess = () => ok(q.result ?? null); q.onerror = () => ok(null); } catch { ok(null); }
  });
}
async function gravarCache(k: string, v: unknown) {
  const db = await abrirBd();
  if (db) try { db.transaction("c", "readwrite").objectStore("c").put({ t: Date.now(), v }, k); } catch { /* cache é opcional */ }
}
export async function limparCache() {
  const db = await abrirBd();
  if (db) try { db.transaction("c", "readwrite").objectStore("c").clear(); } catch { /* idem */ }
}

/** GET com cache: válido por `dias`; sem rede ou com erro, usa o cache vencido. */
async function obter<T>(url: string, tipo: "json" | "text", dias: number): Promise<T> {
  const c = await lerCache(url);
  if (c && Date.now() - c.t < dias * 864e5) return c.v as T;
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 60000);
  let r: Response;
  try { r = await fetch(url, { signal: ctl.signal }); }
  catch (e) {
    if (c) return c.v as T;
    throw new Error((e as Error).name === "AbortError" ? "tempo esgotado" : "serviço inacessível (rede ou bloqueio CORS)");
  } finally { clearTimeout(tm); }
  if (!r.ok) { if (c) return c.v as T; throw new Error(`HTTP ${r.status}`); }
  const v = (tipo === "json" ? await r.json() : await r.text()) as T;
  gravarCache(url, v);
  return v;
}

/* ---------- serviços ---------- */
let capacidades: { nome: string; titulo: string }[] | null = null;
/** Camadas publicadas no GeoServer do DNIT (para escolha manual no editor). */
export async function listarCamadasWfs(): Promise<{ nome: string; titulo: string }[]> {
  if (capacidades) return capacidades;
  const xml = await obter<string>(urlsWfs.capacidades(), "text", 7);
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const lista = [...doc.getElementsByTagNameNS("*", "FeatureType")].map((ft) => {
    const g = (t: string) => [...ft.children].find((c) => c.localName === t)?.textContent?.trim() || "";
    return { nome: g("Name"), titulo: g("Title") || g("Name") };
  }).filter((x) => x.nome).sort((a, b) => a.nome.localeCompare(b.nome));
  if (!lista.length) throw new Error("GetCapabilities sem camadas");
  return (capacidades = lista);
}

async function estados(): Promise<Feicao[]> {
  const j = await obter<any>(urlsIbge.estados(), "json", 180);
  const out: Feicao[] = [];
  for (const f of j.features) {
    const cod = String(f.properties?.codarea ?? ""), sg = siglaPorCodigo(cod);
    for (const geom of deGeoJson(f.geometry)) out.push({ geom, props: { sigla: sg, nome: UFS[sg]?.[1] ?? "", codigo: cod } });
  }
  return out;
}

async function municipios(uf: string): Promise<{ feicoes: Feicao[]; populacao: boolean }> {
  const cod = UFS[uf]?.[0];
  if (!cod) throw new Error("UF desconhecida");
  const [malha, nomes] = await Promise.all([
    obter<any>(urlsIbge.municipiosMalha(cod), "json", 180),
    obter<{ id: number; nome: string }[]>(urlsIbge.municipiosNomes(cod), "json", 180),
  ]);
  const pop: Record<string, number> = {};
  let populacao = true;
  try {
    const a = await obter<any>(urlsIbge.populacao(cod), "json", 365);
    for (const s of a[0].resultados[0].series) pop[String(s.localidade.id)] = Number(Object.values(s.serie)[0]) || 0;
  } catch { populacao = false; }
  const nm: Record<string, string> = {};
  nomes.forEach((m) => (nm[String(m.id)] = m.nome));
  const out: Feicao[] = [];
  for (const f of malha.features) {
    const id = String(f.properties?.codarea ?? ""), partes = deGeoJson(f.geometry).flatMap((g) => g.partes);
    const pt = pontoInterno(partes);
    out.push({ geom: { tipo: "poligono", partes }, pt: pt ? { tipo: "ponto", partes: [[pt]] } : undefined,
      props: { codigo: id, nome: nm[id] || id, uf, populacao: pop[id] ?? null, capital: CAPITAIS.has(id) ? "sim" : "não", rank: 99999 } });
  }
  out.filter((f) => f.props.populacao !== null).sort((a, b) => Number(b.props.populacao) - Number(a.props.populacao)).forEach((f, i) => (f.props.rank = i + 1));
  return { feicoes: out, populacao };
}

/** Retângulo de busca no WFS: UF + 15% de folga. */
function retangulo(m: Mapa, dados: Dados): number[] | null {
  let bb = envelope(feicoesDoQuadro(m, dados));
  if (!envelopeValido(bb)) bb = ENVELOPE_UF[m.enquadramento.valor] ? [...ENVELOPE_UF[m.enquadramento.valor]] : bb;
  if (!envelopeValido(bb)) return null;
  const dx = (bb[2] - bb[0]) * 0.15 + 0.2, dy = (bb[3] - bb[1]) * 0.15 + 0.2;
  return [bb[0] - dx, bb[1] - dy, bb[2] + dx, bb[3] + dy];
}

async function wfs(m: Mapa, dados: Dados, c: Camada): Promise<Feicao[]> {
  if (c.origem.tipo !== "catalogo") return [];
  const d = defCatalogo(c.origem.id)!;
  const bb = retangulo(m, dados);
  if (!bb) throw new Error("aguardando limite da UF");
  if (!c.origem.wfs) {
    c.origem.wfs = escolherWfs(await listarCamadasWfs(), d.wfs!.inclui, d.wfs!.exclui);
    if (!c.origem.wfs) throw new Error("camada não encontrada no GeoServer; escolha manualmente");
  }
  const j = await obter<any>(urlsWfs.feicoes(c.origem.wfs, bb, d.wfs!.max), "json", 15);
  if (!j?.features) throw new Error("resposta WFS sem feições");
  const r = lerGeoJson(JSON.stringify(j));
  const src = srcDoTexto(r.srcTexto);
  if (src?.fn) reprojetar(r.feicoes, src.fn);
  else if (!src && pareceProjetado(r.feicoes)) throw new Error("coordenadas projetadas sem SRC");
  return r.feicoes;
}

const precisa = (c: Camada, cargas: Cargas, uf: string, forcar: boolean) => {
  if (c.origem.tipo !== "catalogo" || c.origem.manual) return false;
  const e = cargas[c.id], escopo = defCatalogo(c.origem.id)?.escopo;
  return forcar || !e || e.estado !== "ok" || (escopo === "uf" && e.uf !== uf);
};

async function carregarUma(m: Mapa, dados: Dados, cargas: Cargas, c: Camada, aoMudar?: () => void) {
  if (c.origem.tipo !== "catalogo") return;
  const uf = m.enquadramento.valor;
  cargas[c.id] = { estado: "carregando", msg: "carregando…", uf };
  aoMudar?.();
  try {
    let msg = "";
    if (c.origem.id === "ibge-uf") dados[c.id] = await estados();
    else if (c.origem.id === "ibge-mun") {
      const r = await municipios(uf);
      dados[c.id] = r.feicoes;
      if (!r.populacao) msg = 'população indisponível: "principais" = capital';
    } else dados[c.id] = await wfs(m, dados, c);
    cargas[c.id] = { estado: "ok", msg, uf };
  } catch (e) {
    cargas[c.id] = { estado: "erro", msg: (e as Error).message, uf };
  }
  aoMudar?.();
}

/**
 * Carrega as camadas do catálogo que faltam (ou todas, com `forcar`): primeiro a malha de UFs,
 * que define o recorte, depois as demais em paralelo. Devolve as camadas com erro.
 */
export async function carregarCamadas(m: Mapa, dados: Dados, cargas: Cargas, o: { forcar?: boolean; aoMudar?: () => void } = {}): Promise<Camada[]> {
  const uf = m.enquadramento.valor, forcar = !!o.forcar;
  const lista = m.camadas.filter((c) => precisa(c, cargas, uf, forcar));
  const ufs = lista.find((c) => c.origem.tipo === "catalogo" && c.origem.id === "ibge-uf");
  if (ufs) await carregarUma(m, dados, cargas, ufs, o.aoMudar);
  await Promise.all(lista.filter((c) => c !== ufs).map((c) => carregarUma(m, dados, cargas, c, o.aoMudar)));
  return m.camadas.filter((c) => cargas[c.id]?.estado === "erro");
}

/** Dados prontos para desenhar uma fonte (painel: inserir/atualizar/lote). */
export async function dadosPara(m: Mapa): Promise<{ dados: Dados; erros: Camada[] }> {
  const dados: Dados = {}, cargas: Cargas = {};
  const erros = await carregarCamadas(m, dados, cargas);
  return { dados, erros };
}
