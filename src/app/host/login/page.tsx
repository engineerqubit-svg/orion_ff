import { redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/host/login-form";

export default async function HostLoginPage() {
  if (await getHostSession()) redirect("/host");
  return <LoginForm />;
}
