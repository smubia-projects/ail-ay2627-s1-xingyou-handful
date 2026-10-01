import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import ProgressPanel from "@/components/ProgressPanel";

export const metadata: Metadata = { title: "Progress · Handful" };

export default function ProgressPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md px-5 py-8 pb-32">
        <ProgressPanel />
      </main>
      <BottomNav />
    </div>
  );
}
