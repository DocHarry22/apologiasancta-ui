"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getAndroidApkUrl, isEngineConfigured } from "@/lib/publicEnv";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function getPlatformState() {
  if (typeof window === "undefined") {
    return {
      isAndroid: false,
      isIOS: false,
      isStandalone: false,
    };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(userAgent);
  const isIOS = /iphone|ipad|ipod/.test(userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return { isAndroid, isIOS, isStandalone };
}

function InstallCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-(--border) bg-(--card)/85 p-5 shadow-sm backdrop-blur-sm">
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-(--text-secondary)">{description}</p>
        </div>
        {children}
      </div>
    </article>
  );
}

export function InstallActions() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<"idle" | "installing" | "installed">("idle");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallState("installed");
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const platform = useMemo(() => getPlatformState(), []);
  const apkUrl = getAndroidApkUrl();
  const engineConfigured = isEngineConfigured();
  const canPromptInstall = installPrompt !== null && !platform.isStandalone;

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    setInstallState("installing");
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallState(outcome === "accepted" ? "installed" : "idle");
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-(--muted)">
            Install &amp; Download
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-(--text-secondary)">
            Install the web app for the fastest launch path, download the Android wrapper when it is published,
            or use Safari Add to Home Screen on iPhone.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--card)/80 px-3 py-1 text-xs text-(--muted)">
          <span className={`h-2 w-2 rounded-full ${engineConfigured && isOnline ? "bg-(--correct)" : "bg-(--wrong)"}`} />
          {engineConfigured
            ? isOnline
              ? "Engine URL configured for production clients"
              : "Offline: shell install still works, live engine access waits for reconnect"
            : "Set NEXT_PUBLIC_ENGINE_URL before release"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <InstallCard
          title="Install Web App"
          description="Use the browser install prompt when available to run Apologia Sancta in standalone mode."
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleInstall()}
              disabled={!canPromptInstall || installState === "installing" || installState === "installed"}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {installState === "installed"
                ? "Installed"
                : installState === "installing"
                  ? "Opening Prompt..."
                  : "Install App"}
            </button>
            {!canPromptInstall && !platform.isStandalone && (
              <span className="text-xs text-(--muted)">
                Use your browser menu if the prompt does not appear yet.
              </span>
            )}
            {platform.isStandalone && (
              <span className="text-xs text-(--correct)">Already running in app mode.</span>
            )}
            {!isOnline && (
              <span className="text-xs text-(--muted)">Offline now. Cached shell pages still open while the engine reconnects later.</span>
            )}
          </div>
          <Link
            href="/mobile"
            className="inline-flex items-center gap-2 text-sm font-medium text-(--accent)"
          >
            Open Live Quiz
            <span aria-hidden="true">&gt;</span>
          </Link>
        </InstallCard>

        <InstallCard
          title="Android APK"
          description="Download the Android wrapper if you want a native launcher around the hosted live app."
        >
          {apkUrl ? (
            <a
              href={apkUrl}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-(--accent) px-4 py-2 text-sm font-semibold text-(--accent)"
            >
              Download APK
            </a>
          ) : (
            <div className="rounded-xl border border-dashed border-(--border) px-4 py-3 text-sm text-(--muted)">
              APK publishing path is wired. Set NEXT_PUBLIC_ANDROID_APK_URL to expose the download.
            </div>
          )}
          <p className="text-xs leading-relaxed text-(--muted)">
            Lowest-friction first release: hosted-site wrapper, not a fully offline native build.
          </p>
        </InstallCard>

        <InstallCard
          title="iPhone"
          description="Safari does not expose the same install prompt, so iPhone uses Add to Home Screen."
        >
          <ol className="space-y-2 text-sm text-(--text-secondary)">
            <li>1. Open this site in Safari.</li>
            <li>2. Tap the Share button.</li>
            <li>3. Choose Add to Home Screen.</li>
          </ol>
          {platform.isIOS && !platform.isStandalone && (
            <span className="text-xs text-(--accent)">You are on iPhone or iPad. Safari is required for install.</span>
          )}
        </InstallCard>

        <InstallCard
          title="Browser Fallback"
          description="Use this route when your browser does not expose an install prompt or you need a plain web fallback."
        >
          <ul className="space-y-2 text-sm text-(--text-secondary)">
            <li>{canPromptInstall ? "This browser supports the install prompt." : "This browser may require a manual bookmark or menu install flow."}</li>
            <li>{platform.isAndroid ? "Android can use either the install prompt or the APK wrapper." : platform.isIOS ? "iPhone and iPad should use Safari Add to Home Screen." : "Desktop browsers can use Install App or open the live UI directly."}</li>
            <li>{engineConfigured ? "The live app is wired to a production engine URL." : "A production engine URL still needs to be configured before release."}</li>
          </ul>
          <Link href="/mobile" className="inline-flex items-center gap-2 text-sm font-medium text-(--accent)">
            Continue in Browser
            <span aria-hidden="true">&gt;</span>
          </Link>
        </InstallCard>
      </div>
    </section>
  );
}
