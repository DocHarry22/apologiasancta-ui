import AdminLoginPage from "@/components/auth/AdminLoginPage";

export default function AuthorLoginPage() {
  return <AdminLoginPage defaultNextPath="/author" allowedNextPrefixes={["/author", "/admin"]} />;
}
