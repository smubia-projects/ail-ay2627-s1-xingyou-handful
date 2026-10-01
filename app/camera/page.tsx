import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CameraPractice from "@/components/CameraPractice";

export const metadata: Metadata = { title: "Camera practice · Handful" };

export default function CameraPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md px-5 py-8 pb-32">
        <CameraPractice />
      </main>
      <BottomNav />
    </div>
  );
}
