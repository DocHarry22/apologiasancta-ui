import { AuthExperience } from "@/components/auth/AuthExperience";

export default function SignupPage() {
  return (
    <AuthExperience
      initialMode="signup"
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
