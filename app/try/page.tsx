// Temporary test page for the exercises. Delete once the lesson runner (step 4) exists.
import { ExerciseSequence, type Exercise } from "@/components/Exercises";
import { getAllSigns, getSign, pickOptions, shuffle } from "@/lib/content";

export default function TryPage() {
  const hello = getSign("hello")!;
  const thankYou = getSign("thank-you")!;
  const pairs = shuffle(getAllSigns()).slice(0, 4);

  const exercises: Exercise[] = [
    { type: "meaning", sign: hello, options: pickOptions(hello) },
    { type: "pick-sign", sign: thankYou, options: pickOptions(thankYou) },
    { type: "match", signs: shuffle(pairs), words: shuffle(pairs) },
  ];

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-8 pb-40">
      <ExerciseSequence exercises={exercises} />
    </main>
  );
}
