import { Button, Caption1, Link, Text, mergeClasses } from "@fluentui/react-components";
import { adicionarTrecho, camada, campos, chaveBr, definirCamadaRodovias, feicoesDe, fmt, geometriaTrecho, nomeBr, remover, usarTrechoCompleto, valoresDistintos, type Trecho } from "@geo-ppt/core";
import { CampoCor, CampoLista, CampoNum, Duas, opcoes, useCampos } from "./campos";
import type { Ctx } from "./contexto";

/** Camada de rodovias (campos BR/UF/km) e trechos com km inicial e final. */
export function SecaoTrechos({ c: ctx }: { c: Ctx }) {
  const k = useCampos(), m = ctx.m, r = m.rodovias;
  const RL = camada(m, r.camadaId), fs = feicoesDe(RL, ctx.dados), flds = opcoes(campos(fs));
  const linhas = m.camadas.filter((c) => c.tipo === "linha").map((c) => ({ valor: c.id, texto: c.nome }));
  const brs = r.campoBr ? valoresDistintos(fs, r.campoBr) : [];
  const mudar = (id: string, fn: (t: Trecho) => void, chave?: string) => ctx.mutar((x) => { const t = x.trechos.find((y) => y.id === id); if (t) fn(t); }, chave);
  return (
    <div className={k.coluna}>
      <CampoLista rotulo="Camada de rodovias" valor={r.camadaId} vazio="(escolha)" opcoes={linhas}
        onMudar={(v) => ctx.mutar((x) => definirCamadaRodovias(x, v, feicoesDe(camada(x, v), ctx.dados)))} />
      {RL && (
        <>
          <Duas>
            <CampoLista rotulo="Campo BR" valor={r.campoBr} vazio="(escolha)" opcoes={flds} onMudar={(v) => ctx.mutar((x) => (x.rodovias.campoBr = v))} />
            <CampoLista rotulo="Campo UF" valor={r.campoUf} vazio="(nenhum)" opcoes={flds} onMudar={(v) => ctx.mutar((x) => (x.rodovias.campoUf = v))} />
            <CampoLista rotulo="Campo km inicial" valor={r.campoKmIni} vazio="(calcular)" opcoes={flds} onMudar={(v) => ctx.mutar((x) => (x.rodovias.campoKmIni = v))} />
            <CampoLista rotulo="Campo km final" valor={r.campoKmFim} vazio="(calcular)" opcoes={flds} onMudar={(v) => ctx.mutar((x) => (x.rodovias.campoKmFim = v))} />
          </Duas>
          <Caption1 className={k.nota}>{r.campoKmIni && r.campoKmFim ? "Recorte pelos campos de km do SNV." : "Sem campos de km: quilometragem pelo comprimento acumulado (aproximada)."}</Caption1>
        </>
      )}
      {m.trechos.map((t) => {
        const g = geometriaTrecho(m, ctx.dados, t);
        const ufs = r.campoUf ? valoresDistintos(fs, r.campoUf, (f) => chaveBr(f.props[r.campoBr]) === chaveBr(t.br)) : [];
        return (
          <div key={t.id} className={mergeClasses(k.cartao, ctx.sel === t.id && k.cartaoSel)}>
            <div className={k.linha}>
              <Text weight="semibold" style={{ flex: 1, cursor: "pointer" }} onClick={() => ctx.selecionar(t.id)}>{nomeBr(t.br)}{t.uf ? `/${t.uf}` : ""}</Text>
              <Button size="small" appearance="subtle" title="Remover trecho" onClick={() => ctx.mutar((x) => remover(x, t.id))}>✕</Button>
            </div>
            <Duas>
              <CampoLista rotulo="Rodovia" valor={t.br} opcoes={(brs.length ? brs : [t.br]).map((b) => ({ valor: b, texto: nomeBr(b) }))}
                onMudar={(v) => mudar(t.id, (y) => {
                  y.br = v;
                  const u = r.campoUf ? valoresDistintos(fs, r.campoUf, (f) => chaveBr(f.props[r.campoBr]) === chaveBr(v)) : [];
                  if (!u.includes(y.uf)) y.uf = u.includes(m.enquadramento.valor) ? m.enquadramento.valor : u[0] || "";
                  usarTrechoCompleto(ctx.m, ctx.dados, y);
                  y.caixa.dx = y.caixa.dy = null;
                })} />
              <CampoLista rotulo="UF" valor={t.uf} opcoes={opcoes(ufs)} vazio={ufs.length ? undefined : "(—)"} desabilitado={!ufs.length}
                onMudar={(v) => mudar(t.id, (y) => { y.uf = v; usarTrechoCompleto(ctx.m, ctx.dados, y); y.caixa.dx = y.caixa.dy = null; })} />
              <CampoNum rotulo="Km inicial" valor={t.kmIni} onMudar={(n) => mudar(t.id, (y) => (y.kmIni = n), `kmi:${t.id}`)} />
              <CampoNum rotulo="Km final" valor={t.kmFim} onMudar={(n) => mudar(t.id, (y) => (y.kmFim = n), `kmf:${t.id}`)} />
            </Duas>
            <Caption1 className={k.nota}>
              {g.faixa ? `Disponível: km ${fmt(g.faixa[0])} – ${fmt(g.faixa[1])} · exibido: ${fmt(g.extensao)} km · ` : "Sem geometria para esta rodovia/UF. "}
              <Link as="button" onClick={() => mudar(t.id, (y) => usarTrechoCompleto(ctx.m, ctx.dados, y))}>usar trecho completo</Link>
            </Caption1>
            <Duas>
              <CampoCor rotulo="Cor do trecho" valor={t.cor} onMudar={(v) => mudar(t.id, (y) => (y.cor = v), `cor:${t.id}`)} />
              <CampoNum rotulo="Espessura" valor={t.espessura} min={1} max={30} onMudar={(n) => mudar(t.id, (y) => (y.espessura = n), `esp:${t.id}`)} />
            </Duas>
          </div>
        );
      })}
      <div className={k.linha}>
        <Button size="small" appearance="primary" disabled={!RL || !r.campoBr}
          onClick={() => { let id = ""; ctx.mutar((x) => { id = adicionarTrecho(x, ctx.dados)?.id ?? ""; }); if (id) ctx.selecionar(id); else ctx.aviso("Não há rodovias nessa camada/campo.", true); }}>
          + Trecho
        </Button>
      </div>
    </div>
  );
}
