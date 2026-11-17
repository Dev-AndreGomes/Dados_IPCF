import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { SetupBanner } from "@/components/SetupBanner";
import { LoginClient } from "@/components/auth/LoginClient";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ctx = await getCurrentMemberContext();

  if (ctx.configured && ctx.authenticated && ctx.member) {
    redirect(ctx.member.role === "admin" ? "/admin" : "/minha-ficha");
  }

  return (
    <>
      <Header activeRoute="login" />
      <main
        id="main-content"
        className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-6"
      >
        {!ctx.configured ? <SetupBanner /> : <LoginClient />}
      </main>
    </>
  );
}
