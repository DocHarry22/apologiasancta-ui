import type { Metadata } from "next";
import AdminLoginPage from "@/components/auth/AdminLoginPage";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to continue your Apologia Sancta formation and quiz activity.",
};

export default function LoginPage() {
  return (
    <AdminLoginPage
      defaultNextPath="/"
      allowedNextPrefixes={[
        "/account",
        "/learn",
        "/library",
        "/leaderboard",
        "/mobile",
        "/research",
        "/admin",
        "/author",
      ]}
    />
  );
}
