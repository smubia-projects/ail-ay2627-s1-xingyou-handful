import SignCard, { type Sign } from "@/components/SignCard";
import signsData from "@/data/signs.json";

const signs = signsData as Sign[];

export default function Home() {
  const hello = signs.find((sign) => sign.id === "hello")!;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-6">
      <SignCard sign={hello} />
    </main>
  );
}
