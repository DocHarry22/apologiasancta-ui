"use client";

import { useEffect, useState } from "react";
import type { PublishedQuestionRecord, TopicWithCount } from "@/lib/content";
import type { CurrentUser } from "@/lib/server/currentUser";
import AuthorDashboardClient from "./AuthorDashboardClient";

type TabId = "overview" | "live" | "rooms" | "bank" | "authoring" | "review" | "topics" | "audit" | "settings";

interface Props {
  topics: TopicWithCount[];
  publishedQuestions: PublishedQuestionRecord[];
  currentUser: CurrentUser;
  initialTab?: TabId;
}

export default function AuthorDashboardMounted({ topics, publishedQuestions, currentUser, initialTab }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <AuthorDashboardClient
      topics={topics}
      publishedQuestions={publishedQuestions}
      currentUser={currentUser}
      initialTab={initialTab}
    />
  );
}
