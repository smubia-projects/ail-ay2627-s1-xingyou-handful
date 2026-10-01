import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SignsList from "@/components/SignsList";

export const metadata: Metadata = { title: "My signs · Handful" };

export default function SignsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md px-5 py-8 pb-32">
        <SignsList />
      </main>
      <BottomNav />
    </div>
  );
}
