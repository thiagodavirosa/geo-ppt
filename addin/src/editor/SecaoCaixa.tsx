import { Button, Caption1, Checkbox, Field, Textarea } from "@fluentui/react-components";
import { ehTrecho, item, nomeBr, type Caixa } from "@geo-ppt/core";
import { CampoCor, CampoNum, CampoTexto, Duas, useCampos } from "./campos";
import type { Ctx } from "./contexto";

/** Caixa do trecho/ponto selecionado: conteúdo, aparência e posição. A âncora fica presa na geometria. */
export function SecaoCaixa({ c: ctx }: { c: Ctx }) {
  const k = useCampos(), it = item(ctx.m, ctx.sel);
  if (!it) return <Caption1 className={k.nota}>Clique numa caixa no mapa (ou no nome de um trecho/ponto) para editá-la.</Caption1>;
  const cx = it.caixa, trecho = ehTrecho(it), id = it.id;
  const mudar = <K extends keyof Caixa>(campo: K, v: Caixa[K]) => ctx.mutar((x) => { const y = item(x, id); if (y) y.caixa[campo] = v; }, `cx:${id}:${String(campo)}`);
  const mostrar = (campo: keyof Caixa["mostrar"], v: boolean) => ctx.mutar((x) => { const y = item(x, id); if (y) y.caixa.mostrar[campo] = v; });
  return (
    <div className={k.coluna}>
      <Caption1>Editando: <b>{trecho ? `${nomeBr(it.br)}${it.uf ? "/" + it.uf : ""}` : it.nome}</b></Caption1>
      <Duas>
        <Checkbox label={trecho ? "Rodovia" : "Nome"} checked={cx.mostrar.nome} onChange={(_, d) => mostrar("nome", !!d.checked)} />
        {trecho ? (
          <>
            <Checkbox label="UF" checked={cx.mostrar.uf} onChange={(_, d) => mostrar("uf", !!d.checked)} />
            <Checkbox label="Km inicial–final" checked={cx.mostrar.km} onChange={(_, d) => mostrar("km", !!d.checked)} />
            <Checkbox label="Extensão" checked={cx.mostrar.extensao} onChange={(_, d) => mostrar("extensao", !!d.checked)} />
          </>
        ) : <Checkbox label="Coordenadas" checked={cx.mostrar.coordenadas} onChange={(_, d) => mostrar("coordenadas", !!d.checked)} />}
      </Duas>
      <CampoTexto rotulo="Prefixo" valor={cx.prefixo} onMudar={(v) => mudar("prefixo", v)} />
      <Field label="Texto adicional" size="small" hint="Uma linha por item (ex.: Contrato 00 00738/2023).">
        <Textarea size="small" resize="vertical" value={cx.extra} onChange={(_, d) => mudar("extra", d.value)} />
      </Field>
      <Duas>
        <CampoCor rotulo="Fundo" valor={cx.fundo} onMudar={(v) => mudar("fundo", v)} />
        <CampoCor rotulo="Texto" valor={cx.texto} onMudar={(v) => mudar("texto", v)} />
        <CampoCor rotulo="Linha indicativa" valor={cx.linha} onMudar={(v) => mudar("linha", v)} />
        <CampoNum rotulo="Tamanho da fonte" valor={cx.tamanhoFonte} min={8} max={48} onMudar={(n) => mudar("tamanhoFonte", n)} />
      </Duas>
      <Duas>
        <Checkbox label="1ª linha em negrito" checked={cx.negrito} onChange={(_, d) => mudar("negrito", !!d.checked)} />
        <Checkbox label="Sombra da caixa" checked={cx.sombra} onChange={(_, d) => mudar("sombra", !!d.checked)} />
      </Duas>
      <div className={k.linha}>
        <Button size="small" onClick={() => ctx.mutar((x) => { const y = item(x, id); if (y) y.caixa.dx = y.caixa.dy = null; })}>Posição automática</Button>
        <Button size="small" onClick={() => ctx.mutar((x) => {
          const { fundo, texto, linha, tamanhoFonte, negrito, sombra } = cx;
          [...x.trechos, ...x.pontos].forEach((y) => Object.assign(y.caixa, { fundo, texto, linha, tamanhoFonte, negrito, sombra }));
        })}>Aplicar estilo a todas</Button>
      </div>
      <Caption1 className={k.nota}>Arraste a caixa no mapa; setas movem 1 px (Shift: 8 px).</Caption1>
    </div>
  );
}
