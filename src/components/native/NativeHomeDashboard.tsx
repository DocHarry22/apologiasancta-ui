"use client";

import Link from "next/link";
import { NativeHeader } from "./NativeHeader";
import { QuickJoinForm } from "@/components/home/QuickJoinForm";
import { useQuizEntryGate } from "@/hooks/useQuizEntryGate";
import type { ApologeticsVerse } from "@/lib/verses";
import { AppIcon } from "./AppIcon";
import { useNativeLearning } from "./useNativeLearning";
import styles from "./NativeHomeDashboard.module.css";

type Topic = { id: string; title: string; questionCount: number };

function ChapelWindow() {
  return <svg className={styles.chapel} viewBox="0 0 200 270" fill="none" aria-hidden="true">
    <path d="M12 268V116C12 67 53 21 100 4c47 17 88 63 88 112v152M26 268V118c0-41 33-82 74-99 41 17 74 58 74 99v150M100 101v167M26 160h148M26 230h148" />
    <circle cx="100" cy="91" r="44" /><circle cx="100" cy="91" r="30" /><circle cx="100" cy="91" r="11" />
    <path d="M100 47v33m0 22v33m-44-44h33m22 0h33m-75-31 23 23m16 16 23 23m0-62-23 23m-16 16-23 23M63 160v108m74-108v108M26 198q18-36 37 0 18-36 37 0 18-36 37 0 18-36 37 0" />
  </svg>;
}

export function NativeHomeDashboard({ userName, topics, verse }: { userName: string | null; topics: Topic[]; verse: ApologeticsVerse }) {
  const learning = useNativeLearning(userName !== null);
  const { requestQuizEntry, onboardingModals } = useQuizEntryGate();
  const learningHref = learning.resume
    ? `/learn/${encodeURIComponent(learning.resume.lessonSlug!)}`
    : learning.nextGroup ? `/learn/groups/${encodeURIComponent(learning.nextGroup.slug)}` : "/learn";
  const personalLoading = learning.progress === "loading";
  const loading = learning.catalogue === "loading" || personalLoading;
  const learningTitle = learning.resume?.lessonTitle || learning.nextGroup?.title;
  const featured = topics.filter((topic) => topic.questionCount > 0).slice(0, 6);

  return <div className={styles.app}>
    <NativeHeader />

    <main id="main-content" className={styles.content}>
      <section className={styles.welcome} aria-labelledby="native-home-title">
        <p className={styles.eyebrow}>{userName ? `Welcome back, ${userName.split(" ")[0]}` : "A moment for your faith"}</p>
        <h1 id="native-home-title">A little deeper. <em>Every day.</em></h1>
        <p>Understand your faith. Find the words to share it.</p>
      </section>

      <section className={styles.formation} aria-labelledby="native-formation-title">
        <ChapelWindow />
        <div className={styles.formationContent}>
          <span className={styles.heroLabel}><AppIcon name="book" width={15} height={15} /> YOUR FORMATION</span>
          <h2 id="native-formation-title">{learning.resume ? "Pick up where\nyou left off." : "Rooted in truth.\nGrowing in faith."}</h2>
          <p>Thoughtful lessons. Trusted sources.<br />A deeper understanding, at your pace.</p>
          <Link href={learningHref} className={styles.heroButton}>{learning.resume ? "Continue lesson" : learning.nextGroup ? "Start learning" : "Explore lessons"}<AppIcon name="arrow" width={19} height={19} /></Link>
          <div className={styles.lessonPreview} aria-live="polite" aria-busy={loading}>
            {loading ? <span>Finding your next step…</span> : learningTitle ? <><span className={styles.previewDot} /><span>{learningTitle}</span>{!learning.resume && Number(learning.nextGroup?.estimatedMinutes) > 0 ? <small>{learning.nextGroup?.estimatedMinutes} min</small> : null}</> : <span>Make space for a little learning today.</span>}
          </div>
        </div>
      </section>

      {learning.catalogue === "unavailable" || learning.progress === "unavailable" ? <div className={styles.notice} role="status"><p>{learning.catalogue === "unavailable" ? "We couldn’t load your next lesson." : "Your saved progress couldn’t load."} You can still explore.</p><button type="button" onClick={learning.retry}>Retry</button></div> : null}

      <div className={styles.activity} aria-label="Your learning activity">
        <Link href={userName !== null ? "/account?section=learning" : "/login?next=%2Fnative"}>
          <span className={styles.activityIcon}><AppIcon name="book" width={18} height={18} /></span>
          <span><strong>{learning.progress === "ready" ? learning.completedCount : "—"}</strong>{" "}<small>{learning.progress === "guest" ? "Sign in to track lessons" : "Lessons completed"}</small></span>
        </Link>
        <Link href="/library">
          <span className={styles.activityIcon}><AppIcon name="spark" width={18} height={18} /></span>
          <span><strong>{topics.length}</strong>{" "}<small>Topics to explore</small></span>
        </Link>
      </div>

      <section aria-labelledby="native-explore-title">
        <div className={styles.sectionHeading}><h2 id="native-explore-title">Make it your own</h2><span>LEARN · EXPLORE · GROW</span></div>
        <div className={styles.shortcuts}>
          <Link href="/practice"><span className={styles.shortcutIcon}><AppIcon name="spark" /></span><strong>Practice</strong>{" "}<small>Test your knowledge</small><AppIcon name="arrow" width={16} height={16} /></Link>
          <Link href="/research"><span className={styles.shortcutIcon}><AppIcon name="research" /></span><strong>Research</strong>{" "}<small>Follow the evidence</small><AppIcon name="arrow" width={16} height={16} /></Link>
          <Link href="/leaderboard"><span className={styles.shortcutIcon}><AppIcon name="trophy" /></span><strong>Rankings</strong>{" "}<small>See the community</small><AppIcon name="arrow" width={16} height={16} /></Link>
        </div>
      </section>

      <section className={styles.liveQuiz} aria-labelledby="native-live-title">
        <div className={styles.liveIcon}><AppIcon name="signal" width={24} height={24} /></div>
        <div className={styles.liveCopy}><p className={styles.eyebrow}>BETTER TOGETHER</p><h2 id="native-live-title">Faith. Friends. A little competition.</h2><p>Join a live quiz and learn with others.</p></div>
        <button type="button" onClick={requestQuizEntry} className={styles.joinButton}>Find a room<AppIcon name="arrow" width={17} height={17} /></button>
        <details className={styles.roomCode}><summary>Have a room code?</summary><div><QuickJoinForm compact /></div></details>
      </section>

      <Link href="/research/graph" className={`${styles.liveQuiz} ${styles.graphEntry}`} aria-label="Explore the 3D Galaxy"><div className={styles.liveIcon}><AppIcon name="research" width={25} height={25} /></div><div className={styles.liveCopy}><p className={styles.eyebrow}>SEE HOW IT CONNECTS</p><h2>A galaxy of understanding.</h2><p>Rotate the graph. Follow a claim. Read its sources.</p></div><AppIcon name="arrow" className="shrink-0 text-(--gold-hover)" width={19} height={19} /></Link>

      <section aria-labelledby="native-topics-title">
        <div className={styles.sectionHeading}><h2 id="native-topics-title">Follow your curiosity</h2><Link href="/library">View all <span aria-hidden="true">→</span></Link></div>
        {featured.length ? <div className={styles.topics}>
          {featured.map((topic, index) => <Link className={styles.topic} href={`/library/${encodeURIComponent(topic.id)}`} key={topic.id}>
            <span className={styles.topicArtwork} data-tone={index % 3}><AppIcon name={index % 3 === 0 ? "cross" : index % 3 === 1 ? "book" : "research"} width={32} height={32} /><span className={styles.topicNumber} aria-hidden="true">0{index + 1}</span></span>
            <strong>{topic.title}</strong><small>{topic.questionCount} sourced {topic.questionCount === 1 ? "question" : "questions"}</small>
          </Link>)}
        </div> : <Link className={styles.libraryLink} href="/library"><AppIcon name="library" /><span><strong>Explore the library</strong><small>Find topics, sources, and answers to your questions.</small></span><AppIcon name="arrow" width={18} height={18} /></Link>}
      </section>

      <section className={styles.scripture} aria-labelledby="native-scripture-title">
        <p className={styles.eyebrow} id="native-scripture-title"><AppIcon name="cross" width={14} height={14} /> A WORD FOR TODAY</p>
        <blockquote>“{verse.text}”</blockquote>
        <p className={styles.verseReference}>{verse.reference}<span aria-hidden="true">✦</span></p>
      </section>

      {userName === null ? <Link className={styles.accountPrompt} href="/login?next=%2Fnative"><span className={styles.activityIcon}><AppIcon name="account" width={20} height={20} /></span><span><strong>Your journey, wherever you go.</strong><small>Sign in to save your lesson progress.</small></span><AppIcon name="arrow" width={18} height={18} /></Link> : null}
      <p className={styles.signoff}>Seek truth. Speak with charity.</p>
    </main>
    {onboardingModals}
  </div>;
}
