import type { Caixa, Camada, Coord, Dados, Feicao, Mapa, Ponto, Tabela, Trecho } from "./esquema";
import { SCHEMA } from "./esquema";
import { CATALOGO, camadaDoCatalogo, estiloPadrao } from "./catalogo";
import { comprimento, pontoEm, recortar } from "./geo";
import { chaveBr, fmt, nomeBr, novoId, num } from "./util";

/* ---------- criação ---------- */
export const caixaPadrao = (tipo: "trecho" | "ponto", p: Partial<Caixa> = {}): Caixa => ({
  mostrar: { nome: true, uf: true, km: tipo === "trecho", extensao: false, coordenadas: false },
  prefixo: tipo === "trecho" ? "Rodovia:" : "", extra: "",
  fundo: "#173f73", texto: "#ffffff", linha: "#4a9200", tamanhoFonte: 18, negrito: true, sombra: true, dx: null, dy: null, ...p,
});

export const tabelaPadrao = (): Tabela => ({
  visivel: false, x: null, y: null,
  colunas: [
    { nome: "Rodovia", largura: 0, alinhamento: "centro" }, { nome: "Contrato", largura: 0, alinhamento: "centro" },
    { nome: "Tipo", largura: 170, alinhamento: "centro" }, { nome: "Extensão (km)", largura: 0, alinhamento: "centro" },
    { nome: "Situação", largura: 110, alinhamento: "centro" },
  ],
  linhas: [],
  estilo: { cabecalhoFundo: "#1f3864", cabecalhoTexto: "#ffffff", texto: "#222222", fundo: "#ffffff", zebra: "#eeeeee", divisoria: "#cccccc",
    borda: "#222222", espessuraBorda: 2, tamanhoFonte: 13, espacamento: 7, cabecalhoNegrito: true, sombra: true },
});

/** Mapa vazio. `comCatalogo`: já com as camadas oficiais e enquadramento pela UF. */
export function novoMapa(uf = "AM", comCatalogo = true): Mapa {
  const m: Mapa = {
    schema: SCHEMA, id: novoId("map"), titulo: "Mapa", revisao: 1, modelo: "", tema: "dnit",
    tela: { largura: 1280, altura: 620, predefinicao: "larga", transparente: true, fundo: "#ffffff" },
    enquadramento: { camadaId: "", campo: "", valor: uf, recortar: true, vizinhas: false, corVizinhas: "#ececec", margem: 5, zoom: 100,
      deslocX: 0, deslocY: 0, ajuste: "auto", fixo: null, sombra: { ativa: true, distancia: 11, desfoque: 7, opacidade: 0.35 } },
    rodovias: { camadaId: "", campoBr: "", campoUf: "", campoKmIni: "", campoKmFim: "" },
    camadas: [], trechos: [], pontos: [], tabela: tabelaPadrao(),
  };
  if (comCatalogo) {
    m.camadas = CATALOGO.map((d) => camadaDoCatalogo(d.id));
    m.enquadramento.camadaId = "ibge-uf"; m.enquadramento.campo = "sigla";
    m.rodovias = { camadaId: "snv", campoBr: "vl_br", campoUf: "sg_uf", campoKmIni: "vl_km_inic", campoKmFim: "vl_km_fina" };
  }
  return m;
}

export const TAMANHOS: Record<string, { texto: string; largura: number; altura: number }> = {
  larga: { texto: "Faixa larga (1280×620)", largura: 1280, altura: 620 },
  "16x9": { texto: "16:9 (1280×720)", largura: 1280, altura: 720 },
  "4x3": { texto: "4:3 (1000×750)", largura: 1000, altura: 750 },
  quadrado: { texto: "Quadrado (800×800)", largura: 800, altura: 800 },
  retrato: { texto: "Retrato (720×960)", largura: 720, altura: 960 },
};

/* ---------- consulta ---------- */
export const camada = (m: Mapa, id: string) => m.camadas.find((c) => c.id === id);
export const feicoesDe = (c: Camada | undefined, dados: Dados): Feicao[] => (c ? c.feicoes ?? dados[c.id] ?? [] : []);

export function campos(fs: Feicao[]): string[] {
  const s = new Set<string>();
  fs.slice(0, 500).forEach((f) => Object.keys(f.props).forEach((k) => s.add(k)));
  return [...s];
}
export function valoresDistintos(fs: Feicao[], campo: string, filtro?: (f: Feicao) => boolean): string[] {
  if (!campo) return [];
  const s = new Set<string>();
  for (const f of fs) {
    if (filtro && !filtro(f)) continue;
    const v = f.props[campo];
    if (v !== null && v !== undefined && v !== "") s.add(String(v).trim());
    if (s.size > 600) break;
  }
  return [...s].sort((a, b) => (+a && +b ? +a - +b : a.localeCompare(b, "pt-BR")));
}
const adivinhar = (cs: string[], re: RegExp) => cs.find((c) => re.test(c)) || "";

export const ehPrincipal = (c: Camada, f: Feicao) => f.props.capital === "sim" || num(f.props.rank, 99999) <= (c.municipios?.principais ?? 8);
export const estiloAtivo = (c: Camada) => (c.municipios?.modo === "poligono" ? c.municipios.estiloPoligono : c.estilo);
export const tipoAtivo = (c: Camada): Camada["tipo"] => (c.municipios ? (c.municipios.modo === "poligono" ? "poligono" : "ponto") : c.tipo);

export function passaFiltro(c: Camada, f: Feicao): boolean {
  const { campo, valores } = c.filtro;
  if (!campo || !valores.trim()) return true;
  const vs = valores.split(";").map(chaveBr).filter(Boolean);
  return vs.includes(chaveBr(f.props[campo]));
}

/** Feições efetivamente desenhadas: representação (municípios), "só principais" e filtro. */
export function feicoesVisiveis(c: Camada, dados: Dados): Feicao[] {
  let fs = feicoesDe(c, dados);
  if (c.municipios) {
    if (c.municipios.soPrincipais) fs = fs.filter((f) => ehPrincipal(c, f));
    if (c.municipios.modo === "ponto") fs = fs.filter((f) => f.pt).map((f) => ({ geom: f.pt!, props: f.props }));
  }
  return fs.filter((f) => passaFiltro(c, f));
}

/* ---------- camadas ---------- */
/** Acrescenta camada de arquivo próprio (feições já em graus). */
export function adicionarCamadaArquivo(m: Mapa, nome: string, feicoes: Feicao[], src: string): Camada {
  const cont = { ponto: 0, linha: 0, poligono: 0 };
  feicoes.forEach((f) => cont[f.geom.tipo]++);
  const tipo = (Object.entries(cont).sort((a, b) => b[1] - a[1])[0][0]) as Camada["tipo"];
  const nomeLimpo = nome.replace(/\.(geojson|json|kml|kmz|shp|zip)$/i, "");
  const hidro = /hidro|rio|drenag|water/i.test(nomeLimpo);
  const c: Camada = {
    id: novoId("cam"), nome: nomeLimpo, tipo, visivel: true, src, origem: { tipo: "arquivo", arquivo: nome },
    estilo: estiloPadrao(tipo === "poligono" ? { preenchimento: "#d9d6ad", contorno: "#7b817c" }
      : tipo === "linha" ? { contorno: hidro ? "#a9d3d4" : "#d9a181", espessura: hidro ? 2.2 : 1.6 } : {}),
    filtro: { campo: "", valores: "" }, feicoes,
  };
  if (tipo === "ponto") c.estilo.rotuloCampo = adivinhar(campos(feicoes), /^(nome|name|nm_mun|municipio|cidade)/i);
  m.camadas.push(c);
  if (tipo === "poligono" && !m.enquadramento.camadaId) {
    const cs = campos(feicoes);
    m.enquadramento.camadaId = c.id;
    m.enquadramento.campo = adivinhar(cs, /sigla|sg_uf|^uf$|^sg/i) || cs[0] || "";
    m.enquadramento.valor = valoresDistintos(feicoes, m.enquadramento.campo)[0] || "";
  }
  if (tipo === "linha" && !m.rodovias.camadaId && adivinhar(campos(feicoes), /(^|_)br$|^br|rodovia/i)) definirCamadaRodovias(m, c.id, feicoes);
  return c;
}

/** Define a camada de rodovias e adivinha os campos BR, UF e km. */
export function definirCamadaRodovias(m: Mapa, id: string, fs: Feicao[]) {
  const cs = campos(fs);
  m.rodovias = {
    camadaId: id,
    campoBr: adivinhar(cs, /^vl_br$|(^|_)br$|^br|rodovia/i),
    campoUf: adivinhar(cs, /sg_uf|^uf$|sigla_uf|^sg_?uf/i),
    campoKmIni: adivinhar(cs, /km_?ini|km_?inic|kmini|km_i$/i),
    campoKmFim: adivinhar(cs, /km_?fi|kmfim|km_f$/i),
  };
}

export function moverCamada(m: Mapa, id: string, dir: number) {
  const a = m.camadas, i = a.findIndex((c) => c.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
}

/* ---------- trechos ---------- */
export function feicoesDaRodovia(m: Mapa, dados: Dados, br: string, uf: string): Feicao[] {
  const r = m.rodovias, fs = feicoesDe(camada(m, r.camadaId), dados);
  if (!r.campoBr) return [];
  const k = chaveBr(br);
  return fs.filter((f) => f.geom.tipo === "linha" && chaveBr(f.props[r.campoBr]) === k && (!r.campoUf || !uf || String(f.props[r.campoUf]).trim() === uf));
}

export interface GeometriaTrecho { pedacos: Coord[][]; extensao: number; faixa: [number, number] | null; ancora: Coord | null; porCampos: boolean }

/** Recorte do trecho: pelos campos de km do SNV ou, sem eles, pelo comprimento acumulado (aproximado). */
export function geometriaTrecho(m: Mapa, dados: Dados, t: Pick<Trecho, "br" | "uf" | "kmIni" | "kmFim">): GeometriaTrecho {
  const r = m.rodovias, fs = feicoesDaRodovia(m, dados, t.br, t.uf);
  const a = Math.min(t.kmIni, t.kmFim), b = Math.max(t.kmIni, t.kmFim), pedacos: Coord[][] = [];
  let ext = 0, min = Infinity, max = -Infinity;
  const porCampos = !!(r.campoKmIni && r.campoKmFim);
  if (porCampos) {
    for (const f of fs) {
      const ki = num(f.props[r.campoKmIni], NaN), kf = num(f.props[r.campoKmFim], NaN);
      if (!Number.isFinite(ki) || !Number.isFinite(kf)) continue;
      const lo = Math.min(ki, kf), hi = Math.max(ki, kf);
      min = Math.min(min, lo); max = Math.max(max, hi);
      const o0 = Math.max(a, lo), o1 = Math.min(b, hi);
      if (o1 <= o0) continue;
      const vao = kf - ki || 1;
      pedacos.push(...recortar(f.geom.partes, (o0 - ki) / vao, (o1 - ki) / vao));
      ext += o1 - o0;
    }
  } else {
    let acc = 0;
    for (const f of fs) {
      const len = comprimento(f.geom.partes), lo = acc, hi = acc + len;
      acc = hi;
      const o0 = Math.max(a, lo), o1 = Math.min(b, hi);
      if (o1 > o0 && len) { pedacos.push(...recortar(f.geom.partes, (o0 - lo) / len, (o1 - lo) / len)); ext += o1 - o0; }
    }
    if (fs.length) { min = 0; max = acc; }
  }
  return { pedacos, extensao: ext, faixa: Number.isFinite(min) ? [min, max] : null, ancora: pedacos.length ? pontoEm(pedacos, 0.5) : null, porCampos };
}

/** Ajusta km inicial/final à extensão disponível da rodovia na UF. */
export function usarTrechoCompleto(m: Mapa, dados: Dados, t: Trecho) {
  const g = geometriaTrecho(m, dados, { ...t, kmIni: -1e9, kmFim: 1e9 });
  if (g.faixa) { t.kmIni = +g.faixa[0].toFixed(1); t.kmFim = +g.faixa[1].toFixed(1); }
}

export function adicionarTrecho(m: Mapa, dados: Dados, br?: string, uf?: string): Trecho | null {
  const r = m.rodovias, fs = feicoesDe(camada(m, r.camadaId), dados);
  if (!r.campoBr) return null;
  const brs = valoresDistintos(fs, r.campoBr);
  if (!br) {
    if (!brs.length) return null;
    const usadas = m.trechos.map((t) => chaveBr(t.br));
    br = brs.find((b) => !usadas.includes(chaveBr(b))) || brs[0];
  }
  if (uf === undefined) {
    const ufs = r.campoUf ? valoresDistintos(fs, r.campoUf, (f) => chaveBr(f.props[r.campoBr]) === chaveBr(br)) : [];
    uf = ufs.includes(m.enquadramento.valor) ? m.enquadramento.valor : ufs[0] || "";
  }
  const t: Trecho = { id: novoId("tr"), br, uf, kmIni: 0, kmFim: 0, cor: "#9813ad", espessura: 6, caixa: caixaPadrao("trecho") };
  usarTrechoCompleto(m, dados, t);
  m.trechos.push(t);
  return t;
}

/* ---------- pontos ---------- */
/** Ponto circular, com as cores padrão dos trechos e das caixas das rodovias. */
export function adicionarPonto(m: Mapa, lon: number, lat: number, nome?: string): Ponto {
  const p: Ponto = { id: novoId("pt"), nome: nome || `Ponte ${m.pontos.length + 1}`, lon, lat, simbolo: "circulo",
    cor: "#9813ad", contorno: "#ffffff", tamanho: 7, caixa: caixaPadrao("ponto") };
  m.pontos.push(p);
  return p;
}

export function remover(m: Mapa, id: string) {
  m.trechos = m.trechos.filter((t) => t.id !== id);
  m.pontos = m.pontos.filter((p) => p.id !== id);
  m.camadas = m.camadas.filter((c) => c.id !== id);
  if (m.enquadramento.camadaId === id) m.enquadramento.camadaId = "";
  if (m.rodovias.camadaId === id) m.rodovias.camadaId = "";
}

export const item = (m: Mapa, id: string | null): Trecho | Ponto | undefined =>
  id ? m.trechos.find((t) => t.id === id) || m.pontos.find((p) => p.id === id) : undefined;
export const ehTrecho = (x: Trecho | Ponto): x is Trecho => "br" in x;

/* ---------- tabela ---------- */
/** Preenche as colunas "Rodovia" e "Extensão" a partir dos trechos; as demais ficam como estão. */
export function preencherTabela(m: Mapa, dados: Dados) {
  const T = m.tabela;
  const ci = T.colunas.findIndex((c) => /rodovia|^br/i.test(c.nome)), ce = T.colunas.findIndex((c) => /extens/i.test(c.nome));
  m.trechos.forEach((t, i) => {
    const lin = T.linhas[i] || (T.linhas[i] = T.colunas.map(() => ""));
    if (ci >= 0) lin[ci] = nomeBr(t.br);
    if (ce >= 0) lin[ce] = fmt(geometriaTrecho(m, dados, t).extensao) + " km";
  });
  T.visivel = true;
}

/** Resumo para listas do painel. */
export function resumo(m: Mapa) {
  return { titulo: m.titulo, uf: m.enquadramento.valor, trechos: m.trechos.length, pontos: m.pontos.length,
    rodovias: [...new Set(m.trechos.map((t) => nomeBr(t.br)))].join(", "), tema: m.tema, revisao: m.revisao, tamanho: `${m.tela.largura} × ${m.tela.altura}` };
}

/** Cópia para desfazer: feições compartilhadas por referência (não são duplicadas). */
export function instantaneo(m: Mapa): { json: string; feicoes: Map<string, Feicao[]> } {
  const feicoes = new Map<string, Feicao[]>();
  const json = JSON.stringify(m, (k, v) => {
    if (k === "feicoes" && Array.isArray(v)) { const id = "F" + feicoes.size; feicoes.set(id, v); return id; }
    return v;
  });
  return { json, feicoes };
}
export function restaurar(s: { json: string; feicoes: Map<string, Feicao[]> }): Mapa {
  const m = JSON.parse(s.json) as Mapa;
  for (const c of m.camadas) if (typeof c.feicoes === "string") c.feicoes = s.feicoes.get(c.feicoes as unknown as string);
  return m;
}
