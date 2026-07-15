import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CapacitorRedirect } from "@/components/native/CapacitorRedirect";
import { InstallActions } from "@/components/home/InstallActions";
import { QuickJoinForm } from "@/components/home/QuickJoinForm";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getRoleHomePath } from "@/lib/auth/access";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { learningPath } from "@/lib/learningContent";
import { getAndroidApkUrl } from "@/lib/publicEnv";
import { getCurrentUser } from "@/lib/server/currentUser";

const pillars = [
  {
    eyebrow: "Learn",
    title: "Doctrine with primary sources",
    copy: "Structured lessons connect Scripture, the Catechism, councils, and clear objection-response reasoning.",
    href: "/learn",
    link: "Open learning path",
  },
  {
    eyebrow: "Practice",
    title: "Train before the room opens",
    copy: "Work through sourced questions at your own pace and review the explanation after every answer.",
    href: "/practice",
    link: "Start solo practice",
  },
  {
    eyebrow: "Compete",
    title: "Live room quiz battles",
    copy: "Join on mobile or desktop, answer inside the server-enforced window, and follow room and global rankings.",
    href: "/mobile",
    link: "Enter live quiz",
  },
];

export default async function Home() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionCookie(sessionValue);
  if (session) {
    try {
      const currentUser = await getCurrentUser(session.userId);
      const homePath = getRoleHomePath(currentUser.role);
      if (homePath === "/admin") redirect(homePath);
    } catch {
      // Public learning and play remain available if the staff directory is unavailable.
    }
  }

  const authorEnabled = process.env.NEXT_PUBLIC_AUTHOR_ENABLED === "true";
  const apkUrl = getAndroidApkUrl();

  return (
    <main className="min-h-screen bg-[#100f0d] text-[#f7f1e7]">
      <CapacitorRedirect />
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#100f0d]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10 font-serif text-xl text-[#d4af37]" aria-hidden="true">✠</span>
            <span>
              <span className="block text-sm font-bold tracking-wide">Apologia Sancta</span>
              <span className="hidden text-[10px] uppercase tracking-[0.2em] text-[#8f8474] sm:block">Learn · defend · compete</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#b8ad9c] md:flex" aria-label="Primary navigation">
            <Link className="transition hover:text-[#e4c760]" href="/learn">Learn</Link>
            <Link className="transition hover:text-[#e4c760]" href="/practice">Practice</Link>
            <Link className="transition hover:text-[#e4c760]" href="/leaderboard">Leaderboard</Link>
            <Link className="transition hover:text-[#e4c760]" href="/library">Library</Link>
            {authorEnabled ? <Link className="transition hover:text-[#e4c760]" href="/author/live">Host</Link> : null}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/mobile" className="rounded-lg bg-[#d4af37] px-3 py-2 text-sm font-bold text-[#17130a] transition hover:bg-[#e2c45c] sm:px-4">Play live</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(212,175,55,0.14),transparent_34%),radial-gradient(circle_at_12%_86%,rgba(96,74,35,0.18),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d4af37]">Serious Catholic formation, built for action</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.06] tracking-[-0.035em] text-[#fbf6ed] sm:text-6xl lg:text-7xl">
              Know the Faith.<br /><span className="font-serif font-medium italic text-[#d8bd6a]">Give the reason.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#bdb2a1] sm:text-xl">
              Follow sourced apologetics lessons, train with explanations, and test your reasoning in live Catholic quiz rooms.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/learn" className="rounded-xl bg-[#d4af37] px-6 py-3.5 font-bold text-[#17130a] shadow-lg shadow-[#d4af37]/10 transition hover:-translate-y-0.5 hover:bg-[#e2c45c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Start learning
              </Link>
              <Link href="/practice" className="rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 font-bold text-[#f7f1e7] transition hover:border-[#d4af37]/60 hover:bg-white/8">
                Try solo practice
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8f8474]">
              <span>Scripture</span><span>Catechism</span><span>Councils</span><span>Church history</span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-[#d4af37]/20 bg-[#1b1814]/95 p-5 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Live competition</p>
                  <h2 className="mt-1 text-2xl font-bold">Join your room</h2>
                </div>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">Room-ready</span>
              </div>
              <div className="py-6">
                <QuickJoinForm />
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-white/8 pt-5 text-center">
                <div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xl font-bold text-[#e4c760]">4</p><p className="mt-1 text-[11px] text-[#8f8474]">answer choices</p></div>
                <div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xl font-bold text-[#e4c760]">Live</p><p className="mt-1 text-[11px] text-[#8f8474]">room scoring</p></div>
                <div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xl font-bold text-[#e4c760]">Sourced</p><p className="mt-1 text-[11px] text-[#8f8474]">explanations</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="platform-heading">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9f9586]">One formation loop</p>
          <h2 id="platform-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Learn it. Practice it. Defend it under pressure.</h2>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {pillars.map((pillar, index) => (
            <Link key={pillar.title} href={pillar.href} className="group rounded-2xl border border-white/10 bg-[#171512] p-6 transition hover:-translate-y-1 hover:border-[#d4af37]/45 hover:bg-[#1d1a16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">{pillar.eyebrow}</p>
                <span className="font-serif text-3xl text-white/12">0{index + 1}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold group-hover:text-[#e4c760]">{pillar.title}</h3>
              <p className="mt-3 min-h-18 text-sm leading-6 text-[#9f9586]">{pillar.copy}</p>
              <p className="mt-6 text-sm font-bold text-[#d8bd6a]">{pillar.link} →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#151310]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">Start with foundations</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">{learningPath.title}</h2>
            <p className="mt-4 leading-7 text-[#a99f90]">{learningPath.description}</p>
            <Link href="/learn" className="mt-6 inline-block rounded-xl border border-[#d4af37]/35 px-5 py-3 text-sm font-bold text-[#e4c760] hover:bg-[#d4af37]/8">View the complete path →</Link>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {learningPath.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/learn/${lesson.id}`} className="flex h-full gap-4 rounded-2xl border border-white/8 bg-black/15 p-4 transition hover:border-[#d4af37]/35">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/30 font-serif font-bold text-[#d4af37]">{lesson.order}</span>
                  <span><span className="block font-bold text-[#f7f1e7]">{lesson.title}</span><span className="mt-1 block text-xs text-[#8f8474]">{lesson.durationMinutes} min · {lesson.difficulty}</span></span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#171512] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9f9586]">Question bank</p>
            <h2 className="mt-2 text-2xl font-bold">Study the source behind the answer</h2>
            <p className="mt-3 text-sm leading-6 text-[#9f9586]">Browse doctrine, Scripture, Church history, moral theology, and apologetics questions with teaching notes.</p>
            <Link href="/library" className="mt-5 inline-block font-bold text-[#d8bd6a] hover:underline">Browse the library →</Link>
          </div>
          <div className="rounded-2xl border border-[#d4af37]/20 bg-[#211d17] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Rankings</p>
            <h2 className="mt-2 text-2xl font-bold">See who is sharpening the fastest</h2>
            <p className="mt-3 text-sm leading-6 text-[#b8ad9c]">Track all-time, weekly, and daily leaders, then join a room to put your own name on the board.</p>
            <Link href="/leaderboard" className="mt-5 inline-block font-bold text-[#e4c760] hover:underline">Open leaderboard →</Link>
          </div>
        </div>
        <div id="download" className="mt-8"><InstallActions /></div>
      </section>

      <footer className="border-t border-white/8 bg-[#0c0b0a]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-sm text-[#8f8474] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div><p className="font-bold text-[#c8beae]">Apologia Sancta</p><p className="mt-1 text-xs">Catholic learning and live quiz competition.</p></div>
          <div className="flex flex-wrap gap-4">
            <Link href="/learn" className="hover:text-[#d8bd6a]">Learn</Link>
            <Link href="/library" className="hover:text-[#d8bd6a]">Library</Link>
            <Link href="/leaderboard" className="hover:text-[#d8bd6a]">Leaderboard</Link>
            {authorEnabled ? <Link href="/admin" className="hover:text-[#d8bd6a]">Staff</Link> : null}
            {apkUrl ? <a href={apkUrl} className="hover:text-[#d8bd6a]">Android app</a> : null}
          </div>
        </div>
      </footer>
    </main>
  );
}
