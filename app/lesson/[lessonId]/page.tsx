import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LessonRunner from "@/components/LessonRunner";
import { getLesson, getLessonSigns, getUnits } from "@/lib/content";

// Only lessons in data/lessons.json exist; any other address shows the 404 page.
export const dynamicParams = false;

export function generateStaticParams() {
  return getUnits().flatMap((unit) => unit.lessons.map((lesson) => ({ lessonId: lesson.id })));
}

export async function generateMetadata({
  params,
}: PageProps<"/lesson/[lessonId]">): Promise<Metadata> {
  const { lessonId } = await params;
  return { title: `${getLesson(lessonId)?.title ?? "Lesson"} · SignPath` };
}

export default async function LessonPage({ params }: PageProps<"/lesson/[lessonId]">) {
  const { lessonId } = await params;
  const lesson = getLesson(lessonId);
  if (!lesson) notFound();

  return (
    <LessonRunner
      mode="lesson"
      lessonId={lesson.id}
      title={lesson.title}
      signs={getLessonSigns(lesson)}
    />
  );
}
