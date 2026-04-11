import { redirect } from "next/navigation";

import { AuthLanding } from "@/components/auth-landing";
import { getOptionalSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getOptionalSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  return <AuthLanding />;
}
