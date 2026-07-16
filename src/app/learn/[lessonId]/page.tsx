import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { LessonProgressActions } from "@/components/learn/LessonProgressActions";
import { StatusBadge } from "@/components/ui/Primitives";
import { getLessonById, getNextLesson, learningPath } from "@/lib/learningContent";

type LessonPageProps = { params: Promise<{ lessonId: string }> };

export function generateStaticParams() { return learningPath.lessons.map((lesson) => ({ lessonId: lesson.id })); }
export async function generateMetadata({ params }: LessonPageProps) { const lesson = getLessonById((await params).lessonId); return lesson ? { title: `${lesson.title} | Apologia Sancta`, description: lesson.summary } : { title: "Lesson not found | Apologia Sancta" }; }

export default async function LessonPage({ params }: LessonPageProps) {
  const lesson = getLessonById((await params).lessonId);
  if (!lesson) notFound();
  const nextLesson = getNextLesson(lesson.id);

  return (
    <AppShell>
      <article className="page-container py-8 sm:py-11">
        <nav className="mb-6 flex items-center justify-between gap-3 text-sm" aria-label="Lesson breadcrumb"><Link href="/learn" className="font-bold text-(--gold-hover) hover:underline">← Learning path</Link><Link href="/practice" className="btn-quiet">Practice</Link></nav>
        <header className="mx-auto max-w-4xl border-b border-(--border) pb-8">
          <div className="flex flex-wrap gap-2"><StatusBadge tone="info">Lesson {lesson.order}</StatusBadge><StatusBadge>{lesson.durationMinutes} minutes</StatusBadge><StatusBadge>{lesson.difficulty}</StatusBadge></div>
          <h1 className="editorial-heading mt-5 text-4xl font-semibold leading-[1.06] sm:text-5xl">{lesson.title}</h1>
          <p className="mt-3 font-[family-name:var(--font-editorial)] text-xl text-(--gold-hover)">{lesson.subtitle}</p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-(--text-muted)">{lesson.summary}</p>
        </header>

        <div className="mx-auto mt-8 grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            <section className="surface-card p-5" aria-labelledby="objectives"><p className="eyebrow">Learning objectives</p><h2 id="objectives" className="editorial-heading mt-2 text-2xl font-semibold">By the end, you should be able to</h2><ul className="mt-4 space-y-3 text-base leading-7 text-(--text-muted)">{lesson.objectives.map((objective) => <li key={objective} className="flex gap-3"><span className="text-(--gold)" aria-hidden="true">✓</span><span>{objective}</span></li>)}</ul></section>
            <div className="mt-10 space-y-10">{lesson.sections.map((section, index) => <section key={section.heading} aria-labelledby={`section-${index}`}><p className="eyebrow">Part {index + 1}</p><h2 id={`section-${index}`} className="editorial-heading mt-2 text-3xl font-semibold">{section.heading}</h2><div className="mt-4 space-y-4 text-base leading-8 text-(--text-muted)">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>{section.keyPoint ? <aside className="mt-6 rounded-r-lg border-l-4 border-(--gold) bg-[color-mix(in_srgb,var(--gold)_9%,transparent)] px-5 py-4 text-base font-semibold leading-7"><span className="sr-only">Key point: </span>{section.keyPoint}</aside> : null}</section>)}</div>
            <section className="surface-card mt-10 border-(--gold) p-6" aria-labelledby="objection-heading"><p className="eyebrow">Objection and response</p><h2 id="objection-heading" className="editorial-heading mt-3 text-2xl font-semibold">“{lesson.objection.claim}”</h2><p className="mt-4 text-base leading-8 text-(--text-muted)">{lesson.objection.response}</p></section>
            <div className="mt-10"><LessonProgressActions lessonId={lesson.id} nextLessonId={nextLesson?.id} /></div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start" aria-labelledby="sources-heading"><section className="surface-card p-5"><p className="eyebrow">Primary sources</p><h2 id="sources-heading" className="editorial-heading mt-2 text-xl font-semibold">Verify the lesson</h2><p className="mt-2 text-sm leading-6 text-(--text-muted)">Open each cited text and test the summary against its sources.</p><div className="mt-4 space-y-2">{lesson.sources.map((source) => <a key={`${source.label}-${source.reference}`} href={source.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-(--border) bg-(--surface-elevated) p-3 hover:border-(--gold)"><span className="text-[0.7rem] font-bold uppercase tracking-wider text-(--text-muted)">{source.kind}</span><strong className="mt-1 block text-sm">{source.reference}</strong><span className="mt-1 block text-xs text-(--gold-hover)">{source.label} ↗<span className="sr-only"> (opens in a new tab)</span></span></a>)}</div></section></aside>
        </div>
      </article>
    </AppShell>
  );
}
