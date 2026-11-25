import { z } from "zod";

/**
 * Esquema geo-ppt/1.0: a fonte editável de um mapa (equivalente ao fluxo-word/1.0 do word-fluxo).
 * É o que fica gravado na apresentação, junto da imagem, e o que trafega entre painel e editor.
 * Camadas do catálogo (IBGE, DNIT) não levam feições: são recarregadas dos serviços/cache.
 */
export const SCHEMA = "geo-ppt/1.0" as const;

const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor deve ser #rrggbb");
const coord = z.tuple([z.number(), z.number()]);
export const geometriaEsq = z.object({
  tipo: z.enum(["ponto", "linha", "poligono"]),
  partes: z.array(z.array(coord)),
});
/** Feições não passam por validação item a item (podem ser milhares): só a forma geral. */
const feicaoEsq = z.looseObject({ geom: geometriaEsq, props: z.record(z.string(), z.unknown()) });

export const estiloEsq = z.object({
  preenchimento: cor.default("#ffffff"),
  contorno: cor.default("#333333"),
  opacidade: z.number().min(0).max(1).default(1),
  espessura: z.number().min(0).max(30).default(1.4),
  tamanho: z.number().min(1).max(40).default(5),
  rotuloCampo: z.string().default(""),
  rotuloCor: cor.default("#333333"),
  rotuloTamanho: z.number().min(6).max(48).default(15),
});

export const ID_CATALOGO = ["ibge-uf", "hidro", "est", "snv", "ibge-mun"] as const;
export type IdCatalogo = (typeof ID_CATALOGO)[number];

const origemEsq = z.union([
  z.object({ tipo: z.literal("catalogo"), id: z.enum(ID_CATALOGO), wfs: z.string().default(""), manual: z.boolean().default(false), arquivo: z.string().default("") }),
  z.object({ tipo: z.literal("arquivo"), arquivo: z.string().default("") }),
]);

export const camadaEsq = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: z.enum(["ponto", "linha", "poligono"]),
  visivel: z.boolean().default(true),
  origem: origemEsq,
  src: z.string().default("graus"),
  estilo: estiloEsq,
  filtro: z.object({ campo: z.string().default(""), valores: z.string().default("") }).default({ campo: "", valores: "" }),
  /** Só para municípios: pontos (sedes) ou polígonos (limites), e "principais". */
  municipios: z
    .object({
      modo: z.enum(["ponto", "poligono"]).default("ponto"),
      soPrincipais: z.boolean().default(true),
      principais: z.number().int().min(0).max(500).default(8),
      rotularSoPrincipais: z.boolean().default(true),
      estiloPoligono: estiloEsq,
    })
    .optional(),
  /** Feições gravadas: só arquivos próprios (ou camada do catálogo substituída por arquivo). */
  feicoes: z.array(feicaoEsq).optional(),
});

export const caixaEsq = z.object({
  mostrar: z.object({
    nome: z.boolean().default(true),
    uf: z.boolean().default(true),
    km: z.boolean().default(true),
    extensao: z.boolean().default(false),
    coordenadas: z.boolean().default(false),
  }),
  prefixo: z.string().default(""),
  extra: z.string().default(""),
  fundo: cor.default("#173f73"),
  texto: cor.default("#ffffff"),
  linha: cor.default("#4a9200"),
  tamanhoFonte: z.number().min(8).max(48).default(18),
  negrito: z.boolean().default(true),
  sombra: z.boolean().default(true),
  /** Deslocamento da caixa em relação à âncora (px do elemento). null = posição automática. */
  dx: z.number().nullable().default(null),
  dy: z.number().nullable().default(null),
});

export const trechoEsq = z.object({
  id: z.string(),
  br: z.string(),
  uf: z.string().default(""),
  kmIni: z.number(),
  kmFim: z.number(),
  cor: cor.default("#9813ad"),
  espessura: z.number().min(1).max(30).default(6),
  caixa: caixaEsq,
});

export const pontoEsq = z.object({
  id: z.string(),
  nome: z.string(),
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  simbolo: z.enum(["circulo", "quadrado", "triangulo", "losango"]).default("circulo"),
  cor: cor.default("#9813ad"),
  contorno: cor.default("#ffffff"),
  tamanho: z.number().min(2).max(40).default(7),
  caixa: caixaEsq,
});

export const colunaEsq = z.object({
  nome: z.string(),
  largura: z.number().min(0).max(1200).default(0),
  alinhamento: z.enum(["centro", "esquerda", "direita"]).default("centro"),
});

export const tabelaEsq = z.object({
  visivel: z.boolean().default(false),
  x: z.number().nullable().default(null),
  y: z.number().nullable().default(null),
  colunas: z.array(colunaEsq),
  linhas: z.array(z.array(z.string())),
  estilo: z.object({
    cabecalhoFundo: cor.default("#1f3864"),
    cabecalhoTexto: cor.default("#ffffff"),
    texto: cor.default("#222222"),
    fundo: cor.default("#ffffff"),
    zebra: cor.default("#eeeeee"),
    divisoria: cor.default("#cccccc"),
    borda: cor.default("#222222"),
    espessuraBorda: z.number().min(0).max(10).default(2),
    tamanhoFonte: z.number().min(7).max(36).default(13),
    espacamento: z.number().min(0).max(30).default(7),
    cabecalhoNegrito: z.boolean().default(true),
    sombra: z.boolean().default(true),
  }),
});

export const mapaEsq = z.object({
  schema: z.literal(SCHEMA),
  id: z.string().min(1),
  titulo: z.string().default("Mapa"),
  revisao: z.number().int().min(1).default(1),
  modelo: z.string().default(""),
  tema: z.string().default("dnit"),
  tela: z.object({
    largura: z.number().min(200).max(4000),
    altura: z.number().min(150).max(4000),
    predefinicao: z.string().default("personalizado"),
    transparente: z.boolean().default(true),
    fundo: cor.default("#ffffff"),
  }),
  enquadramento: z.object({
    camadaId: z.string().default(""),
    campo: z.string().default(""),
    valor: z.string().default(""),
    recortar: z.boolean().default(true),
    vizinhas: z.boolean().default(false),
    corVizinhas: cor.default("#ececec"),
    margem: z.number().min(0).max(30).default(5),
    zoom: z.number().min(10).max(1000).default(100),
    deslocX: z.number().default(0),
    deslocY: z.number().default(0),
    /** auto: o mapa se ajusta ao tamanho do elemento; fixo: mantém a escala ao redimensionar. */
    ajuste: z.enum(["auto", "fixo"]).default("auto"),
    fixo: z.object({ cx: z.number(), cy: z.number(), cosl: z.number(), kBase: z.number(), ax: z.number(), ay: z.number() }).nullable().default(null),
    sombra: z.object({
      ativa: z.boolean().default(true),
      distancia: z.number().min(0).max(60).default(11),
      desfoque: z.number().min(0).max(40).default(7),
      opacidade: z.number().min(0).max(1).default(0.35),
    }),
  }),
  rodovias: z.object({
    camadaId: z.string().default(""),
    campoBr: z.string().default(""),
    campoUf: z.string().default(""),
    campoKmIni: z.string().default(""),
    campoKmFim: z.string().default(""),
  }),
  camadas: z.array(camadaEsq),
  trechos: z.array(trechoEsq),
  pontos: z.array(pontoEsq),
  tabela: tabelaEsq,
});

export type Coord = [number, number];
export type Geometria = z.infer<typeof geometriaEsq>;
/** `pt`: ponto representativo (sede/rótulo) calculado para polígonos de municípios. */
export type Feicao = { geom: Geometria; props: Record<string, unknown>; pt?: Geometria };
export type Estilo = z.infer<typeof estiloEsq>;
export type Camada = Omit<z.infer<typeof camadaEsq>, "feicoes"> & { feicoes?: Feicao[] };
export type Caixa = z.infer<typeof caixaEsq>;
export type Trecho = z.infer<typeof trechoEsq>;
export type Ponto = z.infer<typeof pontoEsq>;
export type Coluna = z.infer<typeof colunaEsq>;
export type Tabela = z.infer<typeof tabelaEsq>;
export type Mapa = Omit<z.infer<typeof mapaEsq>, "camadas"> & { camadas: Camada[] };
/** Feições carregadas em tempo de execução (camadas do catálogo), por id de camada. Não são gravadas. */
export type Dados = Record<string, Feicao[]>;

/** Valida (e completa com os padrões) uma fonte de mapa. Lança Error com a lista de problemas. */
export function validar(entrada: unknown): Mapa {
  const bruto = migrar(entrada);
  const r = mapaEsq.safeParse(bruto);
  if (!r.success) {
    const lista = r.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`);
    throw new Error(`Fonte de mapa inválida (${SCHEMA}):\n${lista.join("\n")}`);
  }
  return r.data as Mapa;
}

/** Ponto único de migração entre versões do esquema. */
export function migrar(entrada: unknown): unknown {
  if (!entrada || typeof entrada !== "object") throw new Error("Fonte de mapa vazia.");
  const o = entrada as { schema?: string };
  if (o.schema === SCHEMA) return o;
  if (typeof o.schema === "string" && o.schema.startsWith("geo-ppt/")) {
    throw new Error(`Esta fonte usa ${o.schema}, mais nova que a suportada (${SCHEMA}). Atualize o suplemento.`);
  }
  throw new Error("Não é uma fonte de mapa do GEO PowerPoint.");
}
