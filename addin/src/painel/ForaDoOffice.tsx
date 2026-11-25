import { Link, Text, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({ raiz: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalL } });

/** Página aberta fora do PowerPoint (navegador comum). */
export function ForaDoOffice() {
  const s = useStyles();
  return (
    <div className={s.raiz}>
      <Text size={500} weight="semibold">Mapas</Text>
      <Text>Este painel funciona dentro do PowerPoint: Página Inicial → Mapas.</Text>
      <Text>Para pré-visualizar o editor no navegador:</Text>
      <Link href={`${import.meta.env.BASE_URL}editor.html?demo=demo`}>editor com dados de demonstração (offline)</Link>
      <Link href={`${import.meta.env.BASE_URL}editor.html?demo=projetos`}>editor com o modelo "Projetos por rodovia" (camadas oficiais)</Link>
    </div>
  );
}
