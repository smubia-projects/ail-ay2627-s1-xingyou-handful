import type { Exercise } from "@/components/Exercises";
import { MOTIONS, type Sign } from "@/components/SignCard";
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

// Fail loudly (including at build time) on content mistakes: bad motions or handshape pictures,
// or a lesson pointing at a sign that doesn't exist.
for (const sign of signs) {
  if (sign.motion && !(MOTIONS as readonly string[]).includes(sign.motion)) {
    throw new Error(`Sign "${sign.id}" has unknown motion "${sign.motion}" (see MOTIONS in SignCard)`);
  }
  if (sign.handshapeImage && !/^[A-Z1-9]$/.test(sign.handshapeImage)) {
    throw new Error(`Sign "${sign.id}" has handshapeImage "${sign.handshapeImage}"; use A-Z or 1-9`);
  }
}
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

// Fingerspelled letters and whole-word signs are different kinds of answer.
function isLetter(sign: Sign): boolean {
  return sign.id.startsWith("letter-");
}

// The answer plus up to count - 1 wrong choices that don't look like it, in random order.
// Wrong choices come from the same kind (letters for letters, words for words) so the odd
// one out doesn't give the answer away.
export function pickOptions(answer: Sign, count = 4): Sign[] {
  const candidates = signs.filter((sign) => sign.id !== answer.id && !looksAlike(sign, answer));
  const sameKind = shuffle(candidates.filter((sign) => isLetter(sign) === isLetter(answer)));
  const otherKind = shuffle(candidates.filter((sign) => isLetter(sign) !== isLetter(answer)));
  const wrong = [...sameKind, ...otherKind].slice(0, count - 1);
  return shuffle([answer, ...wrong]);
}

const meaningExercise = (sign: Sign): Exercise => ({ type: "meaning", sign, options: pickOptions(sign) });
const pickSignExercise = (sign: Sign): Exercise => ({ type: "pick-sign", sign, options: pickOptions(sign) });

// Match pairs only for 3+ signs that all look different, or two pairs could be swapped.
function matchExercise(matchSigns: Sign[]): Exercise | null {
  const allDistinct = matchSigns.every((a, i) =>
    matchSigns.slice(i + 1).every((b) => !looksAlike(a, b)),
  );
  if (matchSigns.length < 3 || !allDistinct) return null;
  return { type: "match", signs: shuffle(matchSigns), words: shuffle(matchSigns) };
}

// Two multiple-choice exercises per sign, plus match pairs, in random order (practice and review).
export function buildExercises(practiceSigns: Sign[]): Exercise[] {
  const exercises = practiceSigns.flatMap((sign) => [meaningExercise(sign), pickSignExercise(sign)]);
  const match = matchExercise(practiceSigns);
  return shuffle(match ? [...exercises, match] : exercises);
}

export type LessonStep =
  | { kind: "intro"; sign: Sign; index: number }
  | { kind: "exercise"; exercise: Exercise; review?: boolean };

// Short lessons are topped up with quick reviews of earlier signs, up to this many questions.
export const TARGET_QUESTIONS = 8;
export const MAX_REVIEWS = 3;

export function questionCount(lessonSigns: Sign[]): number {
  return lessonSigns.length * 2 + (matchExercise(lessonSigns) ? 1 : 0);
}

// A lesson teaches each sign and practices it straight away (intro card, then "what does this
// mean?"), then mixes the rest: "which is the sign?" for each, match pairs, and quick reviews.
export function buildLessonSteps(lessonSigns: Sign[], reviewSigns: Sign[]): LessonStep[] {
  const taught = lessonSigns.flatMap((sign, index): LessonStep[] => [
    { kind: "intro", sign, index },
    { kind: "exercise", exercise: meaningExercise(sign) },
  ]);
  const match = matchExercise(lessonSigns);
  const mixed: LessonStep[] = [
    ...lessonSigns.map((sign): LessonStep => ({ kind: "exercise", exercise: pickSignExercise(sign) })),
    ...(match ? [{ kind: "exercise", exercise: match } as LessonStep] : []),
    ...reviewSigns.map((sign): LessonStep => ({
      kind: "exercise",
      exercise: Math.random() < 0.5 ? meaningExercise(sign) : pickSignExercise(sign),
      review: true,
    })),
  ];
  return [...taught, ...shuffle(mixed)];
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

// Signs from finished lessons, in path order, without duplicates.
export function getLearnedSignIds(completedLessons: string[]): string[] {
  const ids = units
    .flatMap((unit) => unit.lessons)
    .filter((lesson) => completedLessons.includes(lesson.id))
    .flatMap((lesson) => lesson.signIds);
  return [...new Set(ids)];
}

export function getLessonSigns(lesson: Lesson): Sign[] {
  return lesson.signIds.map((id) => signsById.get(id)!);
}
