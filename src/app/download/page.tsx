import type { Metadata } from "next";
import Link from "next/link";
import { InstallActions } from "@/components/home/InstallActions";
import { getAndroidApkUrl } from "@/lib/publicEnv";

export const metadata: Metadata = {
  title: "Download the App",
  description: "Download or install Apologia Sancta for Android, iPhone, or the web.",
};

export default function DownloadPage() {
  const apkUrl = getAndroidApkUrl();

  return (
    <main id="main-content" className="page-container py-10 sm:py-14">
      <section className="surface-card-elevated overflow-hidden p-6 sm:p-10" aria-labelledby="download-heading">
        <p className="eyebrow">Apologia Sancta</p>
        <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h1 id="download-heading" className="editorial-heading max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Take the faith with you.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-(--text-muted)">
              Install Apologia Sancta on Android, add it to your iPhone home screen, or install the web app for a fast standalone experience.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {apkUrl ? (
                <a
                  href={apkUrl}
                  download
                  className="btn-primary"
                >
                  Download Android App <span aria-hidden="true">↓</span>
                </a>
              ) : null}
              <Link href="/mobile" className="btn-secondary">Open Live Quiz</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-(--border) bg-(--surface-muted) p-5 text-sm text-(--text-muted) lg:max-w-xs">
            <p className="font-bold text-(--text)">One app identity</p>
            <p className="mt-2 leading-6">Android releases use the same application identity, so future signed updates upgrade the existing installation instead of creating duplicate apps.</p>
          </div>
        </div>
      </section>

      <InstallActions />
    </main>
  );
}
