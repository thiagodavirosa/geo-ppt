import { useState } from "react";
import { Button, Caption1, Checkbox, Divider, Field, Input, Select, Text, makeStyles, tokens } from "@fluentui/react-components";
import { TEMAS, aplicarTema, contar, substituir } from "@geo-ppt/core";
import { aplicarEmTodos, type ResultadoLote } from "../powerpoint";

const useStyles = makeStyles({
  raiz: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  linha: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

const relatar = (r: ResultadoLote, verbo: string) =>
  `${r.alterados} de ${r.mapas} mapa(s) ${verbo}.${r.falhas.length ? ` Falhas: ${r.falhas.join("; ")}` : ""}`;

/** Aba Substituir: localizar/substituir em todos os mapas, tema da apresentação e atualização das camadas oficiais. */
export function Ferramentas(p: { desabilitado: boolean; onExecutar: (a: () => Promise<string>) => void }) {
  const s = useStyles();
  const [de, setDe] = useState("");
  const [para, setPara] = useState("");
  const [maiusculas, setMaiusculas] = useState(false);
  const [tema, setTema] = useState("dnit");
  const [contagem, setContagem] = useState<string>("");

  return (
    <div className={s.raiz}>
      <Text weight="semibold">Localizar e substituir</Text>
      <Caption1>Em caixas, nomes de pontos, títulos e tabelas de todos os mapas.</Caption1>
      <Field label="Localizar"><Input value={de} onChange={(_, d) => { setDe(d.value); setContagem(""); }} /></Field>
      <Field label="Substituir por"><Input value={para} onChange={(_, d) => setPara(d.value)} /></Field>
      <Checkbox label="Diferenciar maiúsculas" checked={maiusculas} onChange={(_, d) => setMaiusculas(!!d.checked)} />
      <div className={s.linha}>
        <Button disabled={p.desabilitado || !de} onClick={() => p.onExecutar(async () => {
          let total = 0;
          const r = await aplicarEmTodos((f) => { const n = contar(f, de, maiusculas); total += n; return n ? f : null; }, true);
          const msg = `${total} ocorrência(s) em ${r.alterados} de ${r.mapas} mapa(s).`;
          setContagem(msg);
          return msg;
        })}>Contar</Button>
        <Button appearance="primary" disabled={p.desabilitado || !de || !contagem} onClick={() => p.onExecutar(async () => {
          const r = await aplicarEmTodos((f) => (substituir(f, de, para, maiusculas) ? f : null));
          setContagem("");
          return relatar(r, "atualizado(s)");
        })}>Substituir em todos</Button>
      </div>
      {!contagem && de && <Caption1>Conte antes de substituir.</Caption1>}
      <Divider />
      <Text weight="semibold">Tema da apresentação</Text>
      <Field label="Tema">
        <Select value={tema} onChange={(_, d) => setTema(d.value)}>
          {Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.nome}</option>)}
        </Select>
      </Field>
      <div className={s.linha}>
        <Button disabled={p.desabilitado} onClick={() => p.onExecutar(async () => relatar(await aplicarEmTodos((f) => (aplicarTema(f, tema) ? f : null)), "com o tema aplicado"))}>
          Aplicar a todos os mapas
        </Button>
      </div>
      <Divider />
      <Text weight="semibold">Camadas oficiais</Text>
      <Caption1>Recarrega IBGE e SNV e redesenha cada mapa no mesmo lugar.</Caption1>
      <div className={s.linha}>
        <Button disabled={p.desabilitado} onClick={() => p.onExecutar(async () => relatar(await aplicarEmTodos((f) => f), "redesenhado(s)"))}>Atualizar todos os mapas</Button>
      </div>
    </div>
  );
}
