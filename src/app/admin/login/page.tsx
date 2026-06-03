import AdminLoginPage from "@/components/auth/AdminLoginPage";

export default function AdminLoginRoute() {
  return <AdminLoginPage defaultNextPath="/admin" allowedNextPrefixes={["/admin"]} />;
}
