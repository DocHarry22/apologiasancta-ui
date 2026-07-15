import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonProgressActions } from "@/components/learn/LessonProgressActions";
import { getLessonById, getNextLesson, learningPath } from "@/lib/learningContent";

type LessonPageProps = { params: Promise<{ lessonId: string }> };

export function generateStaticParams() {
  return learningPath.lessons.map((lesson) => ({ lessonId: lesson.id }));
}

export async function generateMetadata({ params }: LessonPageProps) {
  const lesson = getLessonById((await params).lessonId);
  return lesson
    ? { title: `${lesson.title} | Apologia Sancta`, description: lesson.summary }
    : { title: "Lesson not found | Apologia Sancta" };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const lesson = getLessonById((await params).lessonId);
  if (!lesson) notFound();
  const nextLesson = getNextLesson(lesson.id);

  return (
    <main className="min-h-screen bg-[#100f0d] text-[#f7f1e7]">
      <header className="border-b border-white/8">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/learn" className="text-sm font-bold text-[#d8bd6a] hover:underline">← Learning path</Link>
          <Link href="/practice" className="rounded-lg border border-white/12 px-3 py-2 text-sm font-bold text-[#f7f1e7] hover:border-[#d4af37]/55">Practice</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">Lesson {lesson.order} · {lesson.durationMinutes} min · {lesson.difficulty}</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{lesson.title}</h1>
        <p className="mt-3 text-xl font-medium text-[#b8ad9c]">{lesson.subtitle}</p>
        <p className="mt-6 text-lg leading-8 text-[#a99f90]">{lesson.summary}</p>

        <section className="mt-10 rounded-2xl border border-white/10 bg-[#171512] p-5" aria-labelledby="objectives">
          <h2 id="objectives" className="font-bold text-[#e4c760]">By the end, you should be able to</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#b8ad9c]">
            {lesson.objectives.map((objective) => <li key={objective} className="flex gap-3"><span className="text-[#d4af37]">•</span><span>{objective}</span></li>)}
          </ul>
        </section>

        <div className="mt-12 space-y-12">
          {lesson.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-[#c8beae]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.keyPoint ? (
                <aside className="mt-6 border-l-2 border-[#d4af37] bg-[#d4af37]/7 px-5 py-4 text-base font-semibold leading-7 text-[#eadba9]">
                  {section.keyPoint}
                </aside>
              ) : null}
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-[#d4af37]/25 bg-[#211d17] p-6" aria-labelledby="objection-heading">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Objection and response</p>
          <h2 id="objection-heading" className="mt-3 text-xl font-bold">“{lesson.objection.claim}”</h2>
          <p className="mt-4 leading-7 text-[#c8beae]">{lesson.objection.response}</p>
        </section>

        <section className="mt-12" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="text-2xl font-bold">Primary sources</h2>
          <p className="mt-2 text-sm text-[#9f9586]">Open the cited texts and test the summary against the sources.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {lesson.sources.map((source) => (
              <a key={`${source.label}-${source.reference}`} href={source.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/10 bg-[#171512] p-4 transition hover:border-[#d4af37]/45">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9f9586]">{source.kind}</span>
                <span className="mt-1 block font-bold text-[#f7f1e7]">{source.reference}</span>
                <span className="mt-1 block text-xs text-[#b8ad9c]">{source.label} ↗</span>
              </a>
            ))}
          </div>
        </section>

        <div className="mt-12"><LessonProgressActions lessonId={lesson.id} nextLessonId={nextLesson?.id} /></div>
      </article>
    </main>
  );
}
