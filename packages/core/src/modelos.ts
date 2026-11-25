import type { Mapa } from "./esquema";
import { validar } from "./esquema";
import { aplicarTema } from "./temas";
import { UFS } from "./catalogo";
import { novoId } from "./util";
import projetos from "../modelos/projetos.json";
import uf from "../modelos/uf.json";
import pontes from "../modelos/pontes.json";
import localizacao from "../modelos/localizacao.json";
import branco from "../modelos/branco.json";
import demo from "../modelos/demo.json";

export interface InfoModelo { id: string; nome: string; descricao: string; icone: string }

/** Galeria (aba Novo). `icone`: SVG 64×46 em linhas finas. */
export const MODELOS: InfoModelo[] = [
  { id: "projetos", nome: "Projetos por rodovia", descricao: "UF com SNV, trechos por km, caixas \"Rodovia:\" e tabela de contratos.",
    icone: '<path d="M8 12l12-6 14 4 6 12-6 14-18 2-9-11z" fill="none" stroke="#111"/><path d="M27 9l-2 12-8 10" stroke="#f35919" stroke-width="3" fill="none"/><rect x="42" y="8" width="18" height="14" fill="none" stroke="#111"/><path d="M42 12h18" stroke="#111"/>' },
  { id: "uf", nome: "Mapa da UF", descricao: "Limite, hidrografia, malhas federal e estadual e principais cidades.",
    icone: '<path d="M8 12l12-6 14 4 6 12-6 14-18 2-9-11z" fill="none" stroke="#111"/><path d="M6 26c10-3 20 3 34-2" stroke="#7a7a7a" fill="none"/><path d="M14 9l8 10 6 16" stroke="#f35919" stroke-width="2" fill="none"/>' },
  { id: "pontes", nome: "Pontes e OAEs", descricao: "Pontos com caixas ancoradas e tabela de pontos.",
    icone: '<path d="M8 12l12-6 14 4 6 12-6 14-18 2-9-11z" fill="none" stroke="#111"/><circle cx="20" cy="19" r="3.5" fill="#f35919"/><circle cx="30" cy="29" r="3.5" fill="#f35919"/><rect x="42" y="8" width="18" height="14" fill="none" stroke="#111"/><path d="M42 12h18" stroke="#111"/>' },
  { id: "localizacao", nome: "Localização da UF", descricao: "UF em destaque entre as vizinhas, formato quadrado.",
    icone: '<rect x="6" y="4" width="38" height="38" fill="#ececec" stroke="#cfcfcf"/><path d="M15 16l8-6 10 4 4 10-6 10-12 1-6-9z" fill="#fff" stroke="#f35919" stroke-width="1.5"/>' },
  { id: "branco", nome: "Em branco", descricao: "Sem camadas oficiais: carregue SHP, GeoJSON, KML ou KMZ.",
    icone: '<rect x="4" y="4" width="56" height="38" fill="none" stroke="#7a7a7a" stroke-dasharray="4 3"/><path d="M32 16v14M25 23h14" stroke="#111"/>' },
];

const FONTES: Record<string, unknown> = { projetos, uf, pontes, localizacao, branco, demo };
export const idsModelos = () => Object.keys(FONTES);

/** Novo mapa a partir de um modelo: id novo, revisão 1, UF e tema escolhidos. `demo` = dados offline simplificados. */
export function instanciarModelo(id: string, sigla = "AM", tema = "dnit"): Mapa {
  const fonte = FONTES[id] ?? FONTES.projetos;
  const m = validar(JSON.parse(JSON.stringify(fonte)));
  m.id = novoId("map");
  m.revisao = 1;
  m.modelo = id in FONTES ? id : "projetos";
  if (id !== "demo") m.enquadramento.valor = UFS[sigla] ? sigla : "AM";
  if (tema && tema !== m.tema) aplicarTema(m, tema);
  return m;
}
