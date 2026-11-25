import { useEffect, useRef, useState } from "react";
import { Button, Caption1, Checkbox, Text, Textarea, Field, makeStyles, tokens } from "@fluentui/react-components";
import {
  adicionarCamadaArquivo, campos, defCatalogo, definirCamadaRodovias, estiloAtivo, feicoesDe, feicoesVisiveis, moverCamada, pontoInterno,
  remover, tipoAtivo, valoresDistintos, type Camada, type Estilo,
} from "@geo-ppt/core";
import { limparCache, listarCamadasWfs } from "../camadas";
import { lerCamadas } from "./arquivos";
import { CampoCor, CampoLista, CampoNum, CampoTexto, Duas, opcoes, useCampos } from "./campos";
import type { Ctx } from "./contexto";

const useStyles = makeStyles({
  topo: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  nome: { flex: 1, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  ok: { color: "#027a48" }, erro: { color: "#b42318" }, carregando: { color: "#b54708" },
});
const TIPO = { ponto: "Pontos", linha: "Linhas", poligono: "Polígonos" } as const;
const SRC = [["", "Automático (graus)"], ...[18, 19, 20, 21, 22, 23, 24, 25].map((z) => [`utm${z}`, `UTM ${z}S`]), ["merc", "Web Mercator (3857)"]].map(([valor, texto]) => ({ valor, texto }));

export function SecaoCamadas({ c: ctx }: { c: Ctx }) {
  const s = useStyles(), k = useCampos();
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [srcSeAusente, setSrc] = useState("");
  const novo = useRef<HTMLInputElement>(null), substituto = useRef<HTMLInputElement>(null), alvo = useRef<string>("");
  const [wfs, setWfs] = useState<{ nome: string; titulo: string }[]>([]);
  useEffect(() => { listarCamadasWfs().then(setWfs).catch(() => setWfs([])); }, []);

  async function adicionar(fs: FileList | null) {
    if (!fs?.length) return;
    const r = await lerCamadas(fs, srcSeAusente);
    if (r.camadas.length) ctx.mutar((m) => r.camadas.forEach((c) => adicionarCamadaArquivo(m, c.nome, c.feicoes, c.src)));
    ctx.aviso([...r.camadas.map((c) => `${c.nome}: ${c.feicoes.length} feições.`), ...r.avisos].join(" "), !r.camadas.length);
  }
  /** Substitui os dados de uma camada do catálogo por arquivo próprio, mantendo estilo e posição. */
  async function substituir(id: string, fs: FileList | null) {
    if (!fs?.length) return;
    const r = await lerCamadas(fs, srcSeAusente);
    if (!r.camadas.length) { ctx.aviso(r.avisos.join(" "), true); return; }
    const feicoes = r.camadas.flatMap((c) => c.feicoes);
    ctx.mutar((m) => {
      const c = m.camadas.find((x) => x.id === id);
      if (!c || c.origem.tipo !== "catalogo") return;
      if (c.municipios) feicoes.forEach((f) => {
        if (f.geom.tipo === "poligono") { const p = pontoInterno(f.geom.partes); if (p) f.pt = { tipo: "ponto", partes: [[p]] }; } else f.pt = f.geom;
        f.props.nome ??= f.props.NM_MUN ?? f.props.name ?? f.props.NOME ?? "";
        f.props.capital ??= "não"; f.props.rank ??= 99999;
      });
      c.feicoes = feicoes; c.src = r.camadas[0].src; c.origem.manual = true; c.origem.arquivo = r.camadas.map((x) => x.nome).join(", ");
      if (c.origem.id === "snv") definirCamadaRodovias(m, c.id, feicoes);
    });
    ctx.aviso(`Camada substituída por ${feicoes.length} feições do arquivo.`);
  }

  const situacao = (c: Camada) => {
    if (c.origem.tipo === "arquivo") return <span className={s.ok}>arquivo próprio</span>;
    if (c.origem.manual) return <span className={s.ok}>arquivo: {c.origem.arquivo}</span>;
    const e = ctx.cargas[c.id];
    if (!e || e.estado === "ocioso") return <span>○ aguardando</span>;
    if (e.estado === "carregando") return <span className={s.carregando}>● carregando…</span>;
    if (e.estado === "erro") return <span className={s.erro}>● indisponível · {e.msg}</span>;
    return <span className={s.ok}>● carregada{e.msg ? ` · ${e.msg}` : ""}</span>;
  };

  return (
    <div className={k.coluna}>
      <Caption1 className={k.nota}>Camadas oficiais (IBGE e GeoServer do DNIT) carregam para a UF escolhida, com cache local.</Caption1>
      <div className={k.linha}>
        <Button size="small" onClick={() => ctx.recarregar(true)}>Recarregar oficiais</Button>
        <Button size="small" onClick={async () => { await limparCache(); ctx.aviso("Cache local limpo."); }}>Limpar cache</Button>
      </div>
      <div className={k.linha}>
        <Button size="small" appearance="primary" onClick={() => novo.current?.click()}>Adicionar camada…</Button>
        <Caption1 className={k.nota}>SHP (.zip ou .shp+.dbf+.prj), GeoJSON, KML, KMZ</Caption1>
      </div>
      <CampoLista rotulo="SRC se o arquivo não informar" valor={srcSeAusente} opcoes={SRC} onMudar={setSrc} />
      <input ref={novo} type="file" multiple hidden accept=".geojson,.json,.zip,.shp,.dbf,.prj,.cpg,.shx,.kml,.kmz" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
      <input ref={substituto} type="file" multiple hidden accept=".geojson,.json,.zip,.shp,.dbf,.prj,.cpg,.shx,.kml,.kmz" onChange={(e) => { substituir(alvo.current, e.target.files); e.target.value = ""; }} />

      {[...ctx.m.camadas].reverse().map((c) => {
        const aberta = abertas.has(c.id), est = estiloAtivo(c), tipo = tipoAtivo(c), fs = feicoesDe(c, ctx.dados), flds = campos(fs);
        const nVis = feicoesVisiveis(c, ctx.dados).length;
        const alternar = () => setAbertas((a) => { const n = new Set(a); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
        const mudarEst = <K extends keyof Estilo>(campo: K, v: Estilo[K]) => ctx.mutar((m) => { estiloAtivo(m.camadas.find((y) => y.id === c.id)!)[campo] = v; }, `est:${c.id}:${String(campo)}`);
        const mudar = (fn: (x: Camada) => void, chave?: string) => ctx.mutar((m) => fn(m.camadas.find((y) => y.id === c.id)!), chave);
        const wfsDef = c.origem.tipo === "catalogo" ? defCatalogo(c.origem.id)?.wfs : undefined;
        return (
          <div key={c.id} className={k.cartao}>
            <div className={s.topo}>
              <Checkbox checked={c.visivel} aria-label="Visível" onChange={(_, d) => mudar((x) => (x.visivel = !!d.checked))} />
              <Text weight="semibold" className={s.nome} onClick={alternar}>{aberta ? "▾" : "▸"} {c.nome}</Text>
              <Button size="small" appearance="subtle" title="Subir" onClick={() => ctx.mutar((m) => moverCamada(m, c.id, 1))}>▲</Button>
              <Button size="small" appearance="subtle" title="Descer" onClick={() => ctx.mutar((m) => moverCamada(m, c.id, -1))}>▼</Button>
              <Button size="small" appearance="subtle" title="Remover" onClick={() => ctx.mutar((m) => remover(m, c.id))}>✕</Button>
            </div>
            <Caption1 className={k.nota}>{TIPO[tipo]} · {nVis}{nVis !== fs.length ? ` de ${fs.length}` : ""} feições · {c.src}<br />{situacao(c)}</Caption1>
            {c.origem.tipo === "catalogo" && (
              <div className={k.linha}>
                {c.origem.manual
                  ? <Button size="small" onClick={() => { mudar((x) => { if (x.origem.tipo === "catalogo") x.origem.manual = false; delete x.feicoes; }); ctx.recarregar(true); }}>Voltar ao serviço</Button>
                  : <Button size="small" onClick={() => ctx.recarregar(true)}>Recarregar</Button>}
                <Button size="small" title="Substituir os dados desta camada por um arquivo" onClick={() => { alvo.current = c.id; substituto.current?.click(); }}>Arquivo…</Button>
              </div>
            )}
            {wfsDef && c.origem.tipo === "catalogo" && !c.origem.manual && (
              <CampoLista rotulo="Camada no GeoServer" valor={c.origem.wfs} vazio="(automático)"
                opcoes={(wfs.length ? wfs : c.origem.wfs ? [{ nome: c.origem.wfs, titulo: c.origem.wfs }] : []).map((x) => ({ valor: x.nome, texto: `${x.titulo} (${x.nome})` }))}
                onMudar={(v) => { mudar((x) => { if (x.origem.tipo === "catalogo") x.origem.wfs = v; }); ctx.recarregar(true); }} />
            )}
            {c.municipios && (
              <>
                <Duas>
                  <CampoLista rotulo="Representação" valor={c.municipios.modo} opcoes={[{ valor: "ponto", texto: "Pontos (sedes)" }, { valor: "poligono", texto: "Polígonos (limites)" }]}
                    onMudar={(v) => mudar((x) => (x.municipios!.modo = v as "ponto" | "poligono"))} />
                  <CampoNum rotulo="Principais (capital + maiores)" valor={c.municipios.principais} min={0} max={500} onMudar={(n) => mudar((x) => (x.municipios!.principais = Math.round(n)), `mun:${c.id}`)} />
                </Duas>
                <Checkbox label="Só as principais cidades" checked={c.municipios.soPrincipais} onChange={(_, d) => mudar((x) => (x.municipios!.soPrincipais = !!d.checked))} />
                <Checkbox label="Rotular só as principais" checked={c.municipios.rotularSoPrincipais} onChange={(_, d) => mudar((x) => (x.municipios!.rotularSoPrincipais = !!d.checked))} />
              </>
            )}
            {aberta && (
              <>
                <CampoTexto rotulo="Nome" valor={c.nome} onMudar={(v) => mudar((x) => (x.nome = v), `nome:${c.id}`)} />
                <Duas>
                  <CampoCor rotulo={tipo === "linha" ? "Cor da linha" : "Contorno"} valor={est.contorno} onMudar={(v) => mudarEst("contorno", v)} />
                  {tipo !== "linha" && <CampoCor rotulo="Preenchimento" valor={est.preenchimento} onMudar={(v) => mudarEst("preenchimento", v)} />}
                </Duas>
                <Duas>
                  <CampoNum rotulo="Espessura" valor={est.espessura} min={0} max={30} onMudar={(n) => mudarEst("espessura", n)} />
                  {tipo === "poligono" && <CampoNum rotulo="Opacidade" valor={est.opacidade} min={0} max={1} onMudar={(n) => mudarEst("opacidade", n)} />}
                  {tipo === "ponto" && <CampoNum rotulo="Tamanho" valor={est.tamanho} min={1} max={40} onMudar={(n) => mudarEst("tamanho", n)} />}
                </Duas>
                {tipo !== "linha" && (
                  <>
                    <CampoLista rotulo="Rótulo (campo)" valor={est.rotuloCampo} vazio="(sem rótulo)" opcoes={opcoes(flds)} onMudar={(v) => mudarEst("rotuloCampo", v)} />
                    <Duas>
                      <CampoCor rotulo="Cor do rótulo" valor={est.rotuloCor} onMudar={(v) => mudarEst("rotuloCor", v)} />
                      <CampoNum rotulo="Tamanho do rótulo" valor={est.rotuloTamanho} min={6} max={48} onMudar={(n) => mudarEst("rotuloTamanho", n)} />
                    </Duas>
                  </>
                )}
                <CampoLista rotulo="Filtro: campo" valor={c.filtro.campo} vazio="(sem filtro)" opcoes={opcoes(flds)} onMudar={(v) => mudar((x) => (x.filtro.campo = v))} />
                {c.filtro.campo && (
                  <Field label="Valores (separados por ;)" size="small" hint={valoresDistintos(fs, c.filtro.campo).slice(0, 12).join("; ")}>
                    <Textarea size="small" resize="vertical" value={c.filtro.valores} onChange={(_, d) => mudar((x) => (x.filtro.valores = d.value), `filtro:${c.id}`)} />
                  </Field>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
