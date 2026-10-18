import { MemoryConsole } from "@/components/memory-console";

export default function Home() {
  return (
    <main className="ownmemory-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 ownmemory-grid opacity-40" />
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-teal-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="relative z-10">
        <MemoryConsole />
      </div>
    </main>
  );
}
