import type { Exercise } from "@/components/Exercises";
import { MOTIONS, type Sign } from "@/components/SignCard";
import signsData from "@/data/signs.json";
import unitsData from "@/data/lessons.json";
import spellingWordsData from "@/data/spelling-words.json";

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

const spellingWords = spellingWordsData as string[];

const signsById = new Map(signs.map((sign) => [sign.id, sign]));

// Fail loudly (including at build time) on content mistakes: bad motions or handshape pictures,
// or a lesson pointing at a sign that doesn't exist.
for (const sign of signs) {
  if (sign.motion && !(MOTIONS as readonly string[]).includes(sign.motion)) {
    throw new Error(`Sign "${sign.id}" has unknown motion "${sign.motion}" (see MOTIONS in SignCard)`);
  }
  if (sign.video && !(sign.video.startsWith("/videos/") && sign.videoCredit)) {
    throw new Error(`Sign "${sign.id}": a video must be in /videos/ and have a videoCredit`);
  }
  if (sign.handshapeImage && !/^[A-Z1-9]$/.test(sign.handshapeImage)) {
    throw new Error(`Sign "${sign.id}" has handshapeImage "${sign.handshapeImage}"; use A-Z or 1-9`);
  }
}
for (const word of spellingWords) {
  if (!/^[A-Z]{2,8}$/.test(word)) {
    throw new Error(`Spelling word "${word}" must be 2-8 capital letters (data/spelling-words.json)`);
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
const signItExercise = (sign: Sign): Exercise => ({ type: "sign-it", sign });

// Match pairs only for 3+ signs that all look different, or two pairs could be swapped.
function matchExercise(matchSigns: Sign[]): Exercise | null {
  const allDistinct = matchSigns.every((a, i) =>
    matchSigns.slice(i + 1).every((b) => !looksAlike(a, b)),
  );
  if (matchSigns.length < 3 || !allDistinct) return null;
  return { type: "match", signs: shuffle(matchSigns), words: shuffle(matchSigns) };
}

// Practice and review: for each sign, recognize it (one multiple-choice question) and produce it
// ("sign it yourself"), plus match pairs, in random order.
export function buildExercises(practiceSigns: Sign[]): Exercise[] {
  const exercises = practiceSigns.flatMap((sign) => [
    Math.random() < 0.5 ? meaningExercise(sign) : pickSignExercise(sign),
    signItExercise(sign),
  ]);
  const match = matchExercise(practiceSigns);
  return shuffle(match ? [...exercises, match] : exercises);
}

const letterSign = (letter: string) => signsById.get(`letter-${letter.toLowerCase()}`);
const SPELL_QUESTIONS = 2;

// For a lesson of letters: every letter taught up to and including that lesson, in path order.
// Null for lessons that aren't all letters.
function lettersKnownThrough(lessonSigns: Sign[]): Set<string> | null {
  if (lessonSigns.length === 0 || !lessonSigns.every(isLetter)) return null;
  const known = new Set<string>();
  for (const lesson of units.flatMap((unit) => unit.lessons)) {
    const lessonLetters = getLessonSigns(lesson).filter(isLetter);
    lessonLetters.forEach((sign) => known.add(sign.word));
    if (lesson.signIds.includes(lessonSigns[0].id)) break;
  }
  return known;
}

// Words for a letters lesson: spelled only with known letters, using at least one new letter.
// "pool" is every word readable so far, for wrong choices.
function spellingWordsFor(lessonSigns: Sign[]): { fresh: string[]; pool: string[] } {
  const known = lettersKnownThrough(lessonSigns);
  if (!known) return { fresh: [], pool: [] };
  const newLetters = new Set(lessonSigns.map((sign) => sign.word));
  const pool = spellingWords.filter((word) => [...word].every((letter) => known.has(letter)));
  const fresh = pool.filter((word) => [...word].some((letter) => newLetters.has(letter)));
  return { fresh, pool };
}

// How many "read the fingerspelling" questions a lesson gets (needs 3 other words as choices).
function spellCount(lessonSigns: Sign[]): number {
  const { fresh, pool } = spellingWordsFor(lessonSigns);
  return pool.length >= 4 ? Math.min(SPELL_QUESTIONS, fresh.length) : 0;
}

function spellExercises(lessonSigns: Sign[]): Exercise[] {
  const { fresh, pool } = spellingWordsFor(lessonSigns);
  return shuffle(fresh)
    .slice(0, spellCount(lessonSigns))
    .map((word): Exercise => {
      // Wrong choices: other readable words, closest in length first so length isn't a giveaway.
      const others = shuffle(pool.filter((other) => other !== word)).sort(
        (a, b) => Math.abs(a.length - word.length) - Math.abs(b.length - word.length),
      );
      return {
        type: "spell",
        word,
        letters: [...word].map((letter) => letterSign(letter)!),
        options: shuffle([word, ...others.slice(0, 3)]),
      };
    });
}

export type LessonStep =
  | { kind: "intro"; sign: Sign; index: number }
  | { kind: "exercise"; exercise: Exercise; review?: boolean };

// Short lessons are topped up with quick reviews of earlier signs, up to this many questions.
export const TARGET_QUESTIONS = 8;
export const MAX_REVIEWS = 3;

export function questionCount(lessonSigns: Sign[]): number {
  return lessonSigns.length * 3 + (matchExercise(lessonSigns) ? 1 : 0) + spellCount(lessonSigns);
}

// A lesson teaches each sign and practices it straight away (intro card, then "what does this
// mean?"), then mixes the rest: "which is the sign?" and "sign it yourself" for each, match
// pairs, quick reviews, and (in letter lessons) reading fingerspelled words.
export function buildLessonSteps(lessonSigns: Sign[], reviewSigns: Sign[]): LessonStep[] {
  const taught = lessonSigns.flatMap((sign, index): LessonStep[] => [
    { kind: "intro", sign, index },
    { kind: "exercise", exercise: meaningExercise(sign) },
  ]);
  const match = matchExercise(lessonSigns);
  const mixed: LessonStep[] = [
    ...lessonSigns.map((sign): LessonStep => ({ kind: "exercise", exercise: pickSignExercise(sign) })),
    ...lessonSigns.map((sign): LessonStep => ({ kind: "exercise", exercise: signItExercise(sign) })),
    ...(match ? [{ kind: "exercise", exercise: match } as LessonStep] : []),
    ...spellExercises(lessonSigns).map((exercise): LessonStep => ({ kind: "exercise", exercise })),
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
  if (exercise.type === "sign-it") return exercise;
  if (exercise.type === "spell") return { ...exercise, options: shuffle(exercise.options) };
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
