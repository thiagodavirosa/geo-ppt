import { useState } from "react";
import { Caption1, Field, Select, Text, makeStyles, tokens } from "@fluentui/react-components";
import { MODELOS, TEMAS, instanciarModelo, listaUfs } from "@geo-ppt/core";
import type { Fonte } from "../fonte";

const useStyles = makeStyles({
  raiz: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  grade: { display: "grid", gridTemplateColumns: "1fr", gap: tokens.spacingVerticalS },
  item: {
    display: "grid", gridTemplateColumns: "72px 1fr", gap: tokens.spacingHorizontalM, alignItems: "center", textAlign: "left",
    padding: tokens.spacingVerticalS, background: tokens.colorNeutralBackground1, cursor: "pointer",
    border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium,
    ":hover": { border: `1px solid ${tokens.colorNeutralForeground1}` },
    ":disabled": { opacity: 0.5, cursor: "default" },
  },
  icone: { width: "72px", height: "52px", border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusSmall, background: "#fff" },
  texto: { display: "flex", flexDirection: "column", gap: "2px" },
});

/** Aba Novo: UF, tema e galeria de modelos. Ao escolher, abre o editor; "Inserir no slide" coloca o mapa. */
export function Galeria(p: { desabilitado: boolean; onEscolher: (f: Fonte) => void }) {
  const s = useStyles();
  const [uf, setUf] = useState("AM");
  const [tema, setTema] = useState("dnit");
  return (
    <div className={s.raiz}>
      <Field label="UF">
        <Select value={uf} onChange={(_, d) => setUf(d.value)}>
          {listaUfs().map((u) => <option key={u.valor} value={u.valor}>{u.texto}</option>)}
        </Select>
      </Field>
      <Field label="Tema">
        <Select value={tema} onChange={(_, d) => setTema(d.value)}>
          {Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.nome}</option>)}
        </Select>
      </Field>
      <div className={s.grade}>
        {MODELOS.map((m) => (
          <button key={m.id} type="button" className={s.item} disabled={p.desabilitado} onClick={() => p.onEscolher(instanciarModelo(m.id, uf, tema))}>
            <svg className={s.icone} viewBox="0 0 64 46" dangerouslySetInnerHTML={{ __html: m.icone }} />
            <span className={s.texto}><Text weight="semibold">{m.nome}</Text><Caption1>{m.descricao}</Caption1></span>
          </button>
        ))}
      </div>
    </div>
  );
}
