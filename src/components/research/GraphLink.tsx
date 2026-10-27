"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { isNativePlatform } from "@/lib/native";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { graphAppHref } from "@/lib/graphEmbed";

/** Website links keep their destination; Android opens the same graph in its app shell. */
export function GraphLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativePlatform()), []);
  const internal = native ? graphAppHref(href, getResearchGraphUrl()) : null;
  return internal ? <Link className={className} href={internal}>{children}</Link> : <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}
