import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Login administrativo", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card relative w-full max-w-sm animate-fade-up px-7 pb-7 pt-10">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="ribbon">Painel Reino</span>
        </div>
        <div className="text-center">
          <LogoMark size={60} className="mx-auto drop-shadow-[0_0_18px_rgba(212,175,55,0.4)]" />
          <h1 className="heading text-gold-gradient mt-4 text-xl">Reino Cobblemon</h1>
          <p className="mt-1 text-sm text-stone-400">Acesso restrito à organização</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
