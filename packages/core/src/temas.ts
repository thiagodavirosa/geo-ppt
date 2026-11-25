import type { Mapa } from "./esquema";

/** Temas visuais aplicáveis a um mapa ou a todos os mapas da apresentação (aba Substituir). */
export interface Tema {
  nome: string; uf: { preenchimento: string; contorno: string }; vizinhas: string; hidro: string; est: string; snv: string;
  mun: { preenchimento: string; contorno: string; rotulo: string }; trecho: string;
  caixa: { fundo: string; texto: string; linha: string }; ponto: { cor: string; contorno: string };
  tabela: { cabecalhoFundo: string; cabecalhoTexto: string; fundo: string; zebra: string; texto: string; divisoria: string; borda: string };
  sombra: boolean;
}

export const TEMAS: Record<string, Tema> = {
  dnit: { nome: "DNIT (padrão)", uf: { preenchimento: "#d9d6ad", contorno: "#7b817c" }, vizinhas: "#ececec", hidro: "#a9d3d4", est: "#e2b48f", snv: "#d9a181",
    mun: { preenchimento: "#ffffff", contorno: "#3d3d3d", rotulo: "#333333" }, trecho: "#9813ad", caixa: { fundo: "#173f73", texto: "#ffffff", linha: "#4a9200" },
    ponto: { cor: "#9813ad", contorno: "#ffffff" },
    tabela: { cabecalhoFundo: "#1f3864", cabecalhoTexto: "#ffffff", fundo: "#ffffff", zebra: "#eeeeee", texto: "#222222", divisoria: "#cccccc", borda: "#222222" }, sombra: true },
  claro: { nome: "Claro", uf: { preenchimento: "#f1efe4", contorno: "#9aa0a6" }, vizinhas: "#f7f7f7", hidro: "#bfe0f0", est: "#e8c8ad", snv: "#c9a58f",
    mun: { preenchimento: "#ffffff", contorno: "#555555", rotulo: "#333333" }, trecho: "#d1495b", caixa: { fundo: "#ffffff", texto: "#1f2937", linha: "#d1495b" },
    ponto: { cor: "#d1495b", contorno: "#ffffff" },
    tabela: { cabecalhoFundo: "#e5e7eb", cabecalhoTexto: "#111827", fundo: "#ffffff", zebra: "#f9fafb", texto: "#111827", divisoria: "#e5e7eb", borda: "#9ca3af" }, sombra: false },
  cinza: { nome: "Cinza (impressão)", uf: { preenchimento: "#e6e6e6", contorno: "#6b6b6b" }, vizinhas: "#f5f5f5", hidro: "#bdbdbd", est: "#c8c8c8", snv: "#9e9e9e",
    mun: { preenchimento: "#ffffff", contorno: "#333333", rotulo: "#222222" }, trecho: "#111111", caixa: { fundo: "#333333", texto: "#ffffff", linha: "#111111" },
    ponto: { cor: "#111111", contorno: "#ffffff" },
    tabela: { cabecalhoFundo: "#333333", cabecalhoTexto: "#ffffff", fundo: "#ffffff", zebra: "#eeeeee", texto: "#111111", divisoria: "#cccccc", borda: "#111111" }, sombra: false },
  contraste: { nome: "Alto contraste", uf: { preenchimento: "#fff8dc", contorno: "#000000" }, vizinhas: "#ffffff", hidro: "#0077cc", est: "#ff9900", snv: "#7a4a00",
    mun: { preenchimento: "#ffffff", contorno: "#000000", rotulo: "#000000" }, trecho: "#e00000", caixa: { fundo: "#000000", texto: "#ffffff", linha: "#e00000" },
    ponto: { cor: "#e00000", contorno: "#000000" },
    tabela: { cabecalhoFundo: "#000000", cabecalhoTexto: "#ffffff", fundo: "#ffffff", zebra: "#fff3cc", texto: "#000000", divisoria: "#000000", borda: "#000000" }, sombra: true },
};

/** Aplica o tema (camadas do catálogo, trechos, pontos, caixas e tabela). Devolve false se o tema não existe. */
export function aplicarTema(m: Mapa, id: string): boolean {
  const T = TEMAS[id];
  if (!T) return false;
  m.tema = id;
  for (const c of m.camadas) {
    if (c.origem.tipo !== "catalogo") continue;
    const s = c.estilo;
    switch (c.origem.id) {
      case "ibge-uf": s.preenchimento = T.uf.preenchimento; s.contorno = T.uf.contorno; break;
      case "hidro": s.contorno = T.hidro; break;
      case "est": s.contorno = T.est; break;
      case "snv": s.contorno = T.snv; break;
      case "ibge-mun":
        s.preenchimento = T.mun.preenchimento; s.contorno = T.mun.contorno; s.rotuloCor = T.mun.rotulo;
        if (c.municipios) c.municipios.estiloPoligono.rotuloCor = T.mun.rotulo;
        break;
    }
  }
  m.enquadramento.corVizinhas = T.vizinhas;
  m.enquadramento.sombra.ativa = T.sombra;
  for (const t of m.trechos) t.cor = T.trecho;
  for (const p of m.pontos) { p.cor = T.ponto.cor; p.contorno = T.ponto.contorno; }
  for (const it of [...m.trechos, ...m.pontos]) Object.assign(it.caixa, T.caixa, { sombra: T.sombra });
  Object.assign(m.tabela.estilo, T.tabela, { sombra: T.sombra });
  return true;
}
