import type { Metadata } from "next";
import SignupPage from "@/components/auth/SignupPage";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Apologia Sancta account to keep learning and growing in faith.",
};

export default function SignupRoutePage() {
  return <SignupPage />;
}
