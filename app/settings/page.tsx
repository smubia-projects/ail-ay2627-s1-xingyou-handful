import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SettingsPanel from "@/components/SettingsPanel";

export const metadata: Metadata = { title: "Settings · Handful" };

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md px-5 py-8 pb-32">
        <SettingsPanel />
      </main>
      <BottomNav />
    </div>
  );
}
