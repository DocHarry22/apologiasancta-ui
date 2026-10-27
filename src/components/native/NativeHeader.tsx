import Link from "next/link";
import { Crest } from "@/components/shell/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AppIcon } from "./AppIcon";
import styles from "./NativeHeader.module.css";

export function NativeHeader({ className = "" }: { className?: string }) {
  return <header className={`${styles.header} ${className}`}>
    <Link href="/native" className={styles.brand} aria-label="Apologia Sancta home">
      <Crest className={styles.crest} />
      <span>Apologia Sancta<small>FAITH SEEKING UNDERSTANDING</small></span>
    </Link>
    <div className={styles.actions}>
      <ThemeToggle />
      <Link href="/library#library-search" className={styles.search} aria-label="Search the library"><AppIcon name="search" width={19} height={19} /></Link>
    </div>
  </header>;
}
