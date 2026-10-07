import IntelligenceDesk from "@/components/intelligence/IntelligenceDesk";
export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  return <IntelligenceDesk mode={view === "sources" || view === "space" ? view : "global"} />;
}
