import { Button, Caption1, Text, ToggleButton, mergeClasses } from "@fluentui/react-components";
import { remover, type Ponto } from "@geo-ppt/core";
import { CampoCor, CampoLista, CampoNum, CampoTexto, Duas, useCampos } from "./campos";
import type { Ctx } from "./contexto";

const SIMBOLOS = [{ valor: "circulo", texto: "Ponto (círculo)" }, { valor: "quadrado", texto: "Quadrado" }, { valor: "triangulo", texto: "Triângulo" }, { valor: "losango", texto: "Losango" }];

/** Pontos (pontes, obras): inserção por clique no mapa; símbolo fixo na coordenada, caixa arrastável. */
export function SecaoPontos({ c: ctx }: { c: Ctx }) {
  const k = useCampos();
  const mudar = (id: string, fn: (p: Ponto) => void, chave?: string) => ctx.mutar((x) => { const p = x.pontos.find((y) => y.id === id); if (p) fn(p); }, chave);
  return (
    <div className={k.coluna}>
      <ToggleButton size="small" checked={ctx.modoPonto} onClick={() => ctx.setModoPonto(!ctx.modoPonto)}>
        {ctx.modoPonto ? "Clique no mapa… (Esc cancela)" : "+ Ponto no mapa"}
      </ToggleButton>
      {!ctx.m.pontos.length && <Caption1 className={k.nota}>Nenhum ponto.</Caption1>}
      {ctx.m.pontos.map((p) => (
        <div key={p.id} className={mergeClasses(k.cartao, ctx.sel === p.id && k.cartaoSel)}>
          <div className={k.linha}>
            <Text weight="semibold" style={{ flex: 1, cursor: "pointer" }} onClick={() => ctx.selecionar(p.id)}>● {p.nome}</Text>
            <Button size="small" appearance="subtle" title="Remover ponto" onClick={() => ctx.mutar((x) => remover(x, p.id))}>✕</Button>
          </div>
          <CampoTexto rotulo="Nome" valor={p.nome} onMudar={(v) => mudar(p.id, (y) => (y.nome = v), `nome:${p.id}`)} />
          <Duas>
            <CampoNum rotulo="Latitude" valor={+p.lat.toFixed(5)} min={-90} max={90} onMudar={(n) => mudar(p.id, (y) => (y.lat = n), `lat:${p.id}`)} />
            <CampoNum rotulo="Longitude" valor={+p.lon.toFixed(5)} min={-180} max={180} onMudar={(n) => mudar(p.id, (y) => (y.lon = n), `lon:${p.id}`)} />
            <CampoLista rotulo="Símbolo" valor={p.simbolo} opcoes={SIMBOLOS} onMudar={(v) => mudar(p.id, (y) => (y.simbolo = v as Ponto["simbolo"]))} />
            <CampoNum rotulo="Tamanho" valor={p.tamanho} min={2} max={40} onMudar={(n) => mudar(p.id, (y) => (y.tamanho = n), `tam:${p.id}`)} />
            <CampoCor rotulo="Cor" valor={p.cor} onMudar={(v) => mudar(p.id, (y) => (y.cor = v), `cor:${p.id}`)} />
            <CampoCor rotulo="Contorno" valor={p.contorno} onMudar={(v) => mudar(p.id, (y) => (y.contorno = v), `ct:${p.id}`)} />
          </Duas>
        </div>
      ))}
    </div>
  );
}
