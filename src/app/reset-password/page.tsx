import type { Metadata } from "next";
import { AccountRecovery } from "@/components/auth/AccountRecovery";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function ResetPasswordPage() { return <AccountRecovery mode="reset" />; }
