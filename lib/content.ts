import type { Exercise } from "@/components/Exercises";
import type { Sign } from "@/components/SignCard";
import signsData from "@/data/signs.json";
import unitsData from "@/data/lessons.json";

export type Lesson = {
  id: string;
  title: string;
  signIds: string[];
};

export type Unit = {
  id: string;
  title: string;
  lessons: Lesson[];
};

const signs = signsData as Sign[];
const units = unitsData as Unit[];

const signsById = new Map(signs.map((sign) => [sign.id, sign]));

// Fail loudly (including at build time) if a lesson points at a sign that doesn't exist.
for (const unit of units) {
  for (const lesson of unit.lessons) {
    for (const signId of lesson.signIds) {
      if (!signsById.has(signId)) {
        throw new Error(
          `Lesson "${lesson.id}" uses sign "${signId}", which is not in data/signs.json`,
        );
      }
    }
  }
}

export function getAllSigns(): Sign[] {
  return signs;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Without videos, two signs with the same location and handshape look identical as diagrams.
function looksAlike(a: Sign, b: Sign): boolean {
  return !a.video && !b.video && a.location === b.location && a.handshape === b.handshape;
}

// The answer plus up to count - 1 wrong choices that don't look like it, in random order.
export function pickOptions(answer: Sign, count = 4): Sign[] {
  const wrong = shuffle(signs.filter((sign) => sign.id !== answer.id && !looksAlike(sign, answer)));
  return shuffle([answer, ...wrong.slice(0, count - 1)]);
}

// Two multiple-choice exercises per sign, plus match pairs for lessons with 3+ signs, in random order.
export function buildLessonExercises(lesson: Lesson): Exercise[] {
  const lessonSigns = getLessonSigns(lesson);
  const exercises: Exercise[] = lessonSigns.flatMap((sign): Exercise[] => [
    { type: "meaning", sign, options: pickOptions(sign) },
    { type: "pick-sign", sign, options: pickOptions(sign) },
  ]);
  if (lessonSigns.length >= 3) {
    exercises.push({ type: "match", signs: shuffle(lessonSigns), words: shuffle(lessonSigns) });
  }
  return shuffle(exercises);
}

// The same exercise with its choices in a new order, for when a mistake comes back.
export function reshuffleExercise(exercise: Exercise): Exercise {
  if (exercise.type === "match") {
    return { ...exercise, signs: shuffle(exercise.signs), words: shuffle(exercise.words) };
  }
  return { ...exercise, options: shuffle(exercise.options) };
}

export function getUnits(): Unit[] {
  return units;
}

export function getSign(id: string): Sign | undefined {
  return signsById.get(id);
}

export function getLesson(id: string): Lesson | undefined {
  return units.flatMap((unit) => unit.lessons).find((lesson) => lesson.id === id);
}

export function getLessonSigns(lesson: Lesson): Sign[] {
  return lesson.signIds.map((id) => signsById.get(id)!);
}
