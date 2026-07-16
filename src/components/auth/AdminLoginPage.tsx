import { AuthExperience } from "@/components/auth/AuthExperience";

interface Props {
  defaultNextPath: string;
  allowedNextPrefixes: string[];
}

export default function AdminLoginPage({ defaultNextPath, allowedNextPrefixes }: Props) {
  return (
    <AuthExperience
      initialMode="signin"
      defaultNextPath={defaultNextPath}
      allowedNextPrefixes={allowedNextPrefixes}
    />
  );
}
