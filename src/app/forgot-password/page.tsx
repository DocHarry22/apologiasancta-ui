import type { Metadata } from "next";
import { AccountRecovery } from "@/components/auth/AccountRecovery";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function ForgotPasswordPage() { return <AccountRecovery mode="forgot" />; }
