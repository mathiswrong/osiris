import RegionalWorkspace from "@/components/intelligence/RegionalWorkspace";
export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region } = await params;
  return <RegionalWorkspace selectedId={region} />;
}
