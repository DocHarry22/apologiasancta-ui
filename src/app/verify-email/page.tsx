import type { Metadata } from "next";
import { AccountRecovery } from "@/components/auth/AccountRecovery";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function VerifyEmailPage() { return <AccountRecovery mode="verify" />; }
