import { useState } from "react";
import { Button, Caption1, MessageBar, MessageBarBody, Text, makeStyles, tokens } from "@fluentui/react-components";
import { verificar, type Alerta } from "@geo-ppt/core";
import { dadosPara } from "../camadas";
import { lerMapa, listarMapas, type MapaLido } from "../powerpoint";

const useStyles = makeStyles({ raiz: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS } });

interface Grupo { titulo: string; alertas: Alerta[] }

/** Aba Verificar: geometria dos trechos, caixas fora do elemento, contraste, camadas indisponíveis. */
export function Verificar(p: { desabilitado: boolean; lido: MapaLido | null }) {
  const s = useStyles();
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [rodando, setRodando] = useState(false);

  async function rodar(somenteSelecionado: boolean) {
    setRodando(true);
    try {
      const alvos: { titulo: string; lido: MapaLido }[] = [];
      if (somenteSelecionado && p.lido) alvos.push({ titulo: p.lido.fonte.titulo, lido: p.lido });
      else for (const d of await listarMapas()) { const l = await lerMapa(d).catch(() => null); if (l) alvos.push({ titulo: `Slide ${d.slide} · ${l.fonte.titulo}`, lido: l }); }
      const out: Grupo[] = [];
      for (const a of alvos) {
        const { dados, erros } = await dadosPara(a.lido.fonte);
        const alertas = verificar(a.lido.fonte, dados);
        erros.forEach((c) => alertas.push({ nivel: "aviso", texto: `Camada "${c.nome}" indisponível: o mapa foi verificado sem ela.` }));
        out.push({ titulo: a.titulo, alertas });
      }
      setGrupos(out);
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className={s.raiz}>
      <Button disabled={p.desabilitado || rodando || !p.lido} onClick={() => rodar(true)}>Verificar mapa selecionado</Button>
      <Button disabled={p.desabilitado || rodando} onClick={() => rodar(false)}>Verificar todos</Button>
      {rodando && <Caption1>Verificando…</Caption1>}
      {grupos?.length === 0 && <Caption1>Nenhum mapa encontrado.</Caption1>}
      {grupos?.map((g) => (
        <div key={g.titulo} className={s.raiz}>
          <Text weight="semibold">{g.titulo}</Text>
          {g.alertas.length === 0 && <MessageBar intent="success"><MessageBarBody>Nada a corrigir.</MessageBarBody></MessageBar>}
          {g.alertas.map((a, i) => (
            <MessageBar key={i} intent={a.nivel === "erro" ? "error" : "warning"}><MessageBarBody>{a.texto}</MessageBarBody></MessageBar>
          ))}
        </div>
      ))}
    </div>
  );
}
