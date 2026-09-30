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
