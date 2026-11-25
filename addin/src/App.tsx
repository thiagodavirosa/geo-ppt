import { useEffect, useState } from "react";
import { Tab, TabList, Text, makeStyles, tokens } from "@fluentui/react-components";
import type { Fonte } from "./fonte";
import { abrirEditor, aoMudarSelecao, atualizarMapa, inserirMapa, lerSelecao, temApiFormas, type MapaLido } from "./powerpoint";
import { Galeria } from "./painel/Galeria";
import { Mapas } from "./painel/Mapas";
import { Ferramentas } from "./painel/Ferramentas";
import { Verificar } from "./painel/Verificar";
import { MapaSelecionado } from "./painel/MapaSelecionado";

const useStyles = makeStyles({
  raiz: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL },
});

type Aba = "galeria" | "mapas" | "ferramentas" | "verificar";

export function App() {
  const s = useStyles();
  const [status, setStatus] = useState(temApiFormas() ? "" : "Esta versão do PowerPoint não tem PowerPointApi 1.5: editar e atualizar mapas já inseridos fica indisponível.");
  const [lido, setLido] = useState<MapaLido | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<Aba>("galeria");

  useEffect(() => {
    let lendo = false;
    const verificar = async () => {
      if (lendo) return;
      lendo = true;
      try {
        setLido(await lerSelecao());
      } catch (e) {
        setStatus(`Erro ao ler seleção: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        lendo = false;
      }
    };
    verificar();
    return aoMudarSelecao(verificar);
  }, []);

  async function executar(acao: () => Promise<string>) {
    setOcupado(true);
    try {
      setStatus(await acao());
    } catch (e) {
      setStatus(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  const criar = (fonte: Fonte) =>
    executar(async () => {
      const editado = await abrirEditor(fonte, "Inserir no slide");
      if (!editado) return "Cancelado.";
      setStatus("Inserindo…");
      await inserirMapa(editado);
      return "Mapa inserido. A fonte editável ficou guardada na apresentação.";
    });

  const editar = (m: MapaLido) =>
    executar(async () => {
      const editado = await abrirEditor(m.fonte, "Atualizar mapa");
      if (!editado) return "Cancelado.";
      setStatus("Atualizando…");
      const r = await atualizarMapa(editado, m.fonte.revisao, m.forma);
      setLido({ fonte: r.fonte, origem: "xml", forma: r.forma });
      return `Mapa atualizado (revisão ${r.fonte.revisao}).`;
    });

  return (
    <div className={s.raiz}>
      <Text size={500} weight="semibold">Mapas</Text>
      <MapaSelecionado
        lido={lido}
        desabilitado={ocupado}
        onEditar={() => lido && editar(lido)}
        onTamanho={(nova) =>
          lido &&
          executar(async () => {
            const r = await atualizarMapa(nova, lido.fonte.revisao, lido.forma);
            setLido({ fonte: r.fonte, origem: "xml", forma: r.forma });
            return `Elemento alterado para ${r.fonte.tela.largura} × ${r.fonte.tela.altura} (revisão ${r.fonte.revisao}).`;
          })
        }
      />
      <TabList selectedValue={aba} onTabSelect={(_, d) => setAba(d.value as Aba)} size="small">
        <Tab value="galeria">Novo</Tab>
        <Tab value="mapas">Mapas</Tab>
        <Tab value="ferramentas">Substituir</Tab>
        <Tab value="verificar">Verificar</Tab>
      </TabList>
      {aba === "galeria" && <Galeria desabilitado={ocupado} onEscolher={criar} />}
      {aba === "mapas" && <Mapas desabilitado={ocupado} onExecutar={executar} onEditar={editar} />}
      {aba === "ferramentas" && <Ferramentas desabilitado={ocupado} onExecutar={executar} />}
      {aba === "verificar" && <Verificar desabilitado={ocupado} lido={lido} />}
      {status && <Text role="status">{status}</Text>}
    </div>
  );
}
