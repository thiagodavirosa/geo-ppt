import { Button, Caption1, Checkbox, Input, Select, Textarea, makeStyles, tokens } from "@fluentui/react-components";
import { preencherTabela, type Tabela } from "@geo-ppt/core";
import { CampoCor, CampoNum, Duas, useCampos } from "./campos";
import type { Ctx } from "./contexto";

const useStyles = makeStyles({
  col: { display: "grid", gridTemplateColumns: "1fr 64px 92px auto", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  grade: { overflowX: "auto", border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusSmall, padding: "4px" },
  cel: { minWidth: "120px" },
});

/** Tabela: visível, cores, bordas, colunas e linhas. Arrasta-se no elemento. */
export function SecaoTabela({ c: ctx }: { c: Ctx }) {
  const k = useCampos(), s = useStyles(), T = ctx.m.tabela, e = T.estilo;
  const est = <K extends keyof Tabela["estilo"]>(campo: K, v: Tabela["estilo"][K]) => ctx.mutar((x) => (x.tabela.estilo[campo] = v), `tb:${String(campo)}`);
  const tab = (fn: (t: Tabela) => void, chave?: string) => ctx.mutar((x) => fn(x.tabela), chave);
  return (
    <div className={k.coluna}>
      <Duas>
        <Checkbox label="Exibir tabela" checked={T.visivel} onChange={(_, d) => tab((t) => (t.visivel = !!d.checked))} />
        <Checkbox label="Sombra da tabela" checked={e.sombra} onChange={(_, d) => est("sombra", !!d.checked)} />
        <Checkbox label="Cabeçalho em negrito" checked={e.cabecalhoNegrito} onChange={(_, d) => est("cabecalhoNegrito", !!d.checked)} />
      </Duas>
      <div className={k.linha}>
        <Button size="small" onClick={() => ctx.mutar((x) => preencherTabela(x, ctx.dados))}>Preencher a partir dos trechos</Button>
        <Button size="small" onClick={() => tab((t) => { t.x = t.y = null; t.visivel = true; })}>Posição automática</Button>
      </div>
      <Caption1 className={k.nota}>"Preencher" atualiza as colunas Rodovia e Extensão; as demais ficam como estão.</Caption1>
      <Duas>
        <CampoCor rotulo="Cabeçalho: fundo" valor={e.cabecalhoFundo} onMudar={(v) => est("cabecalhoFundo", v)} />
        <CampoCor rotulo="Cabeçalho: texto" valor={e.cabecalhoTexto} onMudar={(v) => est("cabecalhoTexto", v)} />
        <CampoCor rotulo="Linhas: fundo" valor={e.fundo} onMudar={(v) => est("fundo", v)} />
        <CampoCor rotulo="Linhas alternadas" valor={e.zebra} onMudar={(v) => est("zebra", v)} />
        <CampoCor rotulo="Texto" valor={e.texto} onMudar={(v) => est("texto", v)} />
        <CampoCor rotulo="Divisórias" valor={e.divisoria} onMudar={(v) => est("divisoria", v)} />
        <CampoCor rotulo="Borda externa" valor={e.borda} onMudar={(v) => est("borda", v)} />
        <CampoNum rotulo="Espessura da borda" valor={e.espessuraBorda} min={0} max={10} onMudar={(n) => est("espessuraBorda", n)} />
        <CampoNum rotulo="Tamanho da fonte" valor={e.tamanhoFonte} min={7} max={36} onMudar={(n) => est("tamanhoFonte", n)} />
        <CampoNum rotulo="Espaçamento" valor={e.espacamento} min={0} max={30} onMudar={(n) => est("espacamento", n)} />
      </Duas>
      <Caption1 className={k.nota}><b>Colunas</b> · largura 0 = automática; com largura, o texto quebra linha.</Caption1>
      {T.colunas.map((c, i) => (
        <div key={i} className={s.col}>
          <Input size="small" aria-label="Nome da coluna" value={c.nome} onChange={(_, d) => tab((t) => (t.colunas[i].nome = d.value), `cn:${i}`)} />
          <Input size="small" aria-label="Largura" value={String(c.largura)} onChange={(_, d) => { const n = Number(d.value); if (Number.isFinite(n)) tab((t) => (t.colunas[i].largura = Math.max(0, n)), `cl:${i}`); }} />
          <Select size="small" aria-label="Alinhamento" value={c.alinhamento} onChange={(_, d) => tab((t) => (t.colunas[i].alinhamento = d.value as Tabela["colunas"][number]["alinhamento"]))}>
            <option value="centro">Centro</option><option value="esquerda">Esquerda</option><option value="direita">Direita</option>
          </Select>
          <span>
            <Button size="small" appearance="subtle" title="Para a esquerda" disabled={i === 0} onClick={() => tab((t) => { [t.colunas[i - 1], t.colunas[i]] = [t.colunas[i], t.colunas[i - 1]]; t.linhas.forEach((l) => ([l[i - 1], l[i]] = [l[i], l[i - 1]])); })}>◀</Button>
            <Button size="small" appearance="subtle" title="Excluir coluna" onClick={() => tab((t) => { t.colunas.splice(i, 1); t.linhas.forEach((l) => l.splice(i, 1)); })}>✕</Button>
          </span>
        </div>
      ))}
      <div className={k.linha}><Button size="small" onClick={() => tab((t) => { t.colunas.push({ nome: "Nova coluna", largura: 0, alinhamento: "centro" }); t.linhas.forEach((l) => l.push("")); })}>+ Coluna</Button></div>
      <Caption1 className={k.nota}><b>Linhas</b> · Enter dentro da célula quebra a linha.</Caption1>
      <div className={s.grade}>
        <table>
          <tbody>
            {T.linhas.map((l, r) => (
              <tr key={r}>
                {T.colunas.map((c, i) => (
                  <td key={i}><Textarea size="small" className={s.cel} aria-label={`${c.nome}, linha ${r + 1}`} value={l[i] ?? ""} onChange={(_, d) => tab((t) => (t.linhas[r][i] = d.value), `tr:${r}:${i}`)} /></td>
                ))}
                <td>
                  <Button size="small" appearance="subtle" title="Subir" disabled={r === 0} onClick={() => tab((t) => ([t.linhas[r - 1], t.linhas[r]] = [t.linhas[r], t.linhas[r - 1]]))}>▲</Button>
                  <Button size="small" appearance="subtle" title="Excluir linha" onClick={() => tab((t) => t.linhas.splice(r, 1))}>✕</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={k.linha}><Button size="small" onClick={() => tab((t) => { t.linhas.push(t.colunas.map(() => "")); t.visivel = true; })}>+ Linha</Button></div>
    </div>
  );
}
