import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import LessonPath from "@/components/LessonPath";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md px-5 py-8 pb-32">
        <LessonPath />
      </main>
      <BottomNav />
    </div>
  );
}
