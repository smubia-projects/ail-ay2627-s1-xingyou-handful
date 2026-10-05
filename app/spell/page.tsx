import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SpellIt from "@/components/SpellIt";

export const metadata: Metadata = { title: "Spell it · Handful" };

export default function SpellPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md px-5 py-8 pb-32">
        <SpellIt />
      </main>
      <BottomNav />
    </div>
  );
}
