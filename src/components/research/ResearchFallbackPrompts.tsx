import Link from "next/link";
import { AppIcon } from "@/components/native/AppIcon";
import { StudyArtwork } from "@/components/native/StudyUI";
import study from "@/components/native/StudyUI.module.css";
import { ResearchRetryButton } from "@/components/research/ResearchRetryButton";
import styles from "@/components/research/ResearchUI.module.css";

export const RESEARCH_FALLBACK_PROMPTS = [
  { title: "Is Jesus truly God?", focus: "Christology", difficulty: "Foundation", href: "/library/christology" },
  { title: "Where is the Trinity in Scripture?", focus: "Scripture & doctrine", difficulty: "Intermediate", href: "/library/trinity" },
  { title: "Did the early Church believe in the Eucharist?", focus: "Fathers & sacraments", difficulty: "Intermediate", href: "/library/eucharist" },
  { title: "What authority did Christ give Peter?", focus: "Scripture & Church history", difficulty: "Advanced", href: "/library/ecclesiology" },
] as const;

export function ResearchFallbackPrompts({ knowledgeAvailable }: { knowledgeAvailable: boolean }) {
  return <>
    <div className={study.empty}>
      <AppIcon name="research" />
      <h3>{knowledgeAvailable ? "More paths are being prepared." : "Research is taking a moment."}</h3>
      <p>{knowledgeAvailable
        ? "Reviewed topic journeys will appear here when published. These bundled library paths are ready now."
        : "Topics are temporarily unavailable. These bundled library paths remain available while the research service recovers."}</p>
      {!knowledgeAvailable ? <ResearchRetryButton label="Retry topics" /> : null}
    </div>
    <div className={styles.cards} aria-label="Research questions available in the library">
      {RESEARCH_FALLBACK_PROMPTS.map((prompt, index) => <article key={prompt.title} className={styles.topic}>
        <StudyArtwork icon="book" tone={index} />
        <div>
          <h3>{prompt.title}</h3>
          <p>{prompt.focus} · {prompt.difficulty}</p>
          <div className={styles.topicLinks}>
            <Link href={prompt.href} aria-label={`Study ${prompt.title} in the library`}>Study this question in the library <AppIcon name="arrow" width={14} height={14} /></Link>
          </div>
        </div>
      </article>)}
    </div>
  </>;
}
