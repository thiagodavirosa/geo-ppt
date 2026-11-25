import { lerArquivos, pareceProjetado, reprojetar, srcDoTexto, srcManual, type Feicao } from "@geo-ppt/core";

export interface CamadaLida { nome: string; feicoes: Feicao[]; src: string }

/** Lê arquivos escolhidos pelo usuário e devolve camadas já em graus, com mensagens do que não deu certo. */
export async function lerCamadas(arquivos: FileList | File[], srcSeAusente: string): Promise<{ camadas: CamadaLida[]; avisos: string[] }> {
  const lista = await Promise.all([...arquivos].map(async (f) => ({ nome: f.name, buf: await f.arrayBuffer() })));
  const lidos = await lerArquivos(lista);
  const camadas: CamadaLida[] = [], avisos: string[] = [];
  if (!lidos.length) avisos.push("Nenhuma camada reconhecida. Para shapefile, envie .zip ou .shp + .dbf (+ .prj).");
  for (const r of lidos) {
    if (!r.feicoes.length) { avisos.push(`${r.nome}: sem feições.`); continue; }
    let src = srcDoTexto(r.srcTexto), rotulo = "graus (WGS84/SIRGAS)";
    if (src && src.fn === undefined) { avisos.push(`${r.nome}: ${src.rotulo}; reprojete para SIRGAS 2000 (graus) ou UTM.`); continue; }
    if (!src && pareceProjetado(r.feicoes)) {
      src = srcManual(srcSeAusente);
      if (!src) { avisos.push(`${r.nome}: coordenadas projetadas sem SRC. Escolha "SRC se ausente" e carregue de novo.`); continue; }
    }
    if (src?.fn) { reprojetar(r.feicoes, src.fn); rotulo = src.rotulo; }
    camadas.push({ nome: r.nome, feicoes: r.feicoes, src: rotulo });
  }
  return { camadas, avisos };
}
