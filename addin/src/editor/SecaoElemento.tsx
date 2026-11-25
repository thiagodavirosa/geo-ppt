import { Button, Caption1, Checkbox } from "@fluentui/react-components";
import { TAMANHOS, UFS, camada, campos, definirAjuste, feicoesDe, listaUfs, recentralizar, valoresDistintos } from "@geo-ppt/core";
import { CampoCor, CampoLista, CampoNum, CampoTexto, Duas, opcoes, useCampos } from "./campos";
import type { Ctx } from "./contexto";

/** Título, tamanho do elemento, enquadramento (UF), zoom, sombra do mapa e fundo. */
export function SecaoElemento({ c: ctx }: { c: Ctx }) {
  const k = useCampos(), m = ctx.m, e = m.enquadramento, t = m.tela;
  const FL = camada(m, e.camadaId), fs = feicoesDe(FL, ctx.dados);
  const ufOficial = FL?.origem.tipo === "catalogo" && FL.origem.id === "ibge-uf";
  const valores = ufOficial ? listaUfs() : opcoes(valoresDistintos(fs, e.campo));
  const polis = m.camadas.filter((c) => c.tipo === "poligono").map((c) => ({ valor: c.id, texto: c.nome }));
  return (
    <div className={k.coluna}>
      <CampoTexto rotulo="Título do mapa" dica="Aparece na lista de mapas e no texto alternativo." valor={m.titulo} onMudar={(v) => ctx.mutar((x) => (x.titulo = v), "titulo")} />
      <CampoLista rotulo="Tamanho do elemento" valor={TAMANHOS[t.predefinicao] ? t.predefinicao : ""} vazio="Personalizado"
        opcoes={Object.entries(TAMANHOS).map(([valor, x]) => ({ valor, texto: x.texto }))}
        onMudar={(v) => { const p = TAMANHOS[v]; if (p) ctx.mutar((x) => { x.tela.largura = p.largura; x.tela.altura = p.altura; x.tela.predefinicao = v; x.tabela.x = x.tabela.y = null; }); }} />
      <Duas>
        <CampoNum rotulo="Largura (px)" valor={t.largura} min={200} max={4000} onMudar={(n) => ctx.mutar((x) => { x.tela.largura = Math.round(n); x.tela.predefinicao = "personalizado"; }, "largura")} />
        <CampoNum rotulo="Altura (px)" valor={t.altura} min={150} max={4000} onMudar={(n) => ctx.mutar((x) => { x.tela.altura = Math.round(n); x.tela.predefinicao = "personalizado"; }, "altura")} />
      </Duas>
      <CampoLista rotulo="Ao redimensionar" valor={e.ajuste} opcoes={[{ valor: "auto", texto: "Ajustar o mapa ao tamanho" }, { valor: "fixo", texto: "Manter a escala do mapa" }]}
        onMudar={(v) => ctx.mutar((x) => definirAjuste(x, ctx.dados, v as "auto" | "fixo"))} />
      <Caption1 className={k.nota}>Arraste as alças do elemento para redimensionar e o fundo do mapa para deslocá-lo.</Caption1>
      <Duas>
        <Checkbox label="Fundo transparente" checked={t.transparente} onChange={(_, d) => ctx.mutar((x) => (x.tela.transparente = !!d.checked))} />
        <CampoCor rotulo="Cor de fundo" valor={t.fundo} onMudar={(v) => ctx.mutar((x) => (x.tela.fundo = v), "fundo")} />
      </Duas>
      <CampoLista rotulo="Camada de limites" valor={e.camadaId} vazio="(todas as camadas)" opcoes={polis}
        onMudar={(v) => ctx.mutar((x) => {
          const L = camada(x, v), cs = campos(feicoesDe(L, ctx.dados));
          x.enquadramento.camadaId = v;
          x.enquadramento.campo = L?.origem.tipo === "catalogo" ? "sigla" : cs.find((c) => /sigla|sg_uf|^uf$/i.test(c)) || cs[0] || "";
          if (L?.origem.tipo !== "catalogo") x.enquadramento.valor = valoresDistintos(feicoesDe(L, ctx.dados), x.enquadramento.campo)[0] || "";
          recentralizar(x);
        })} />
      {FL && !ufOficial && <CampoLista rotulo="Campo" valor={e.campo} opcoes={opcoes(campos(fs))} onMudar={(v) => ctx.mutar((x) => { x.enquadramento.campo = v; x.enquadramento.valor = valoresDistintos(fs, v)[0] || ""; recentralizar(x); })} />}
      <CampoLista rotulo={ufOficial ? "UF" : "Feição"} valor={e.valor} opcoes={valores}
        onMudar={(v) => { ctx.mutar((x) => { x.enquadramento.valor = v; recentralizar(x); }); ctx.recarregar(); }} />
      {ufOficial && !UFS[e.valor] && <Caption1 className={k.nota}>Escolha uma UF.</Caption1>}
      <Duas>
        <Checkbox label="Recortar pela UF" checked={e.recortar} onChange={(_, d) => ctx.mutar((x) => (x.enquadramento.recortar = !!d.checked))} />
        <Checkbox label="Mostrar vizinhas" checked={e.vizinhas} onChange={(_, d) => ctx.mutar((x) => (x.enquadramento.vizinhas = !!d.checked))} />
      </Duas>
      <Duas>
        <CampoCor rotulo="Cor das vizinhas" valor={e.corVizinhas} onMudar={(v) => ctx.mutar((x) => (x.enquadramento.corVizinhas = v), "vizinhas")} />
        <CampoNum rotulo="Margem (%)" valor={e.margem} min={0} max={30} onMudar={(n) => ctx.mutar((x) => (x.enquadramento.margem = n), "margem")} />
      </Duas>
      <Duas>
        <CampoNum rotulo="Zoom (%)" valor={Math.round(e.zoom)} min={10} max={1000} onMudar={(n) => ctx.mutar((x) => (x.enquadramento.zoom = n), "zoom")} />
        <div className={k.linha} style={{ alignItems: "flex-end" }}><Button size="small" onClick={() => ctx.mutar((x) => recentralizar(x))}>Recentralizar</Button></div>
      </Duas>
      <Checkbox label="Sombra do mapa" checked={e.sombra.ativa} onChange={(_, d) => ctx.mutar((x) => (x.enquadramento.sombra.ativa = !!d.checked))} />
      {e.sombra.ativa && (
        <Duas>
          <CampoNum rotulo="Distância" valor={e.sombra.distancia} min={0} max={60} onMudar={(n) => ctx.mutar((x) => (x.enquadramento.sombra.distancia = n), "sd")} />
          <CampoNum rotulo="Desfoque" valor={e.sombra.desfoque} min={0} max={40} onMudar={(n) => ctx.mutar((x) => (x.enquadramento.sombra.desfoque = n), "sf")} />
          <CampoNum rotulo="Opacidade" valor={e.sombra.opacidade} min={0} max={1} onMudar={(n) => ctx.mutar((x) => (x.enquadramento.sombra.opacidade = n), "so")} />
        </Duas>
      )}
      <Caption1 className={k.nota}>Sombras das caixas e da tabela ficam nas respectivas seções.</Caption1>
    </div>
  );
}
