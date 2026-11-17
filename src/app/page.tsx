import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ClipboardCheck,
  HeartHandshake,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { Header } from "@/components/Header";
import { SetupBanner } from "@/components/SetupBanner";
import { IPCF_SEDE_ADDRESS } from "@/lib/geocoding/recife-coords";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const ctx = await getCurrentMemberContext();

  return (
    <>
      <Header member={ctx.member} activeRoute="home" />
      <main id="main-content" className="flex-1">
        {/* Hero Institucional IPCF */}
        <section className="relative overflow-hidden border-b border-ipcf-border bg-gradient-to-b from-white to-ipcf-bg px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-ipcf-gold/50 bg-ipcf-gold-soft/30 px-3.5 py-1 text-xs font-bold text-ipcf-deep">
                <ShieldCheck className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
                <span>Portal Privado · Igreja Presbiteriana em Casa Forte</span>
              </div>

              <h1 className="font-serif text-3xl font-bold leading-tight text-ipcf-deep sm:text-5xl">
                Dados IPCF:{" "}
                <span className="text-ipcf-brand">
                  cuidando de cada membro e de cada lar.
                </span>
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-ipcf-muted sm:text-lg">
                Estamos atualizando o rol oficial de membros e congregados da nossa igreja.
                Cadastre sua ficha uma única vez com seu CPF, conecte seu núcleo familiar
                e mantenha seus contatos, dons e pedidos de oração sempre em dia.
              </p>

              {ctx.authenticated && ctx.member ? (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ipcf-brand/25 bg-white p-4 shadow-xs">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs font-bold text-ipcf-brand uppercase">
                      Sessão ativa
                    </p>
                    <p className="font-serif text-lg font-bold text-ipcf-deep">
                      Olá, {ctx.member.nome_completo.split(" ")[0]}!
                    </p>
                  </div>
                  <Link
                    href="/minha-ficha"
                    className="inline-flex items-center gap-2 rounded-xl bg-ipcf-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ipcf-deep"
                  >
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Abrir Minha Ficha</span>
                  </Link>
                  {ctx.member.role === "admin" && (
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-2 rounded-xl bg-ipcf-gold px-4 py-2.5 text-sm font-bold text-ipcf-deep transition hover:bg-ipcf-gold-soft"
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                      <span>Painel Pastoral</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/censo"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-ipcf-brand px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-ipcf-deep sm:text-base"
                  >
                    <ClipboardCheck className="h-5 w-5 text-ipcf-gold-soft" aria-hidden="true" />
                    <span>Fazer Meu Cadastro (Primeiro Acesso)</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>

                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-ipcf-border bg-white px-6 py-3.5 text-sm font-bold text-ipcf-deep shadow-xs transition hover:bg-ipcf-bg sm:text-base"
                  >
                    <span>Já tenho cadastro · Entrar</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Card institucional de destaque */}
            <aside className="rounded-3xl border border-ipcf-border bg-ipcf-deep p-6 text-white shadow-md sm:p-8">
              <div className="flex items-center gap-4 border-b border-white/15 pb-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ipcf-gold/40 sm:h-20 sm:w-20">
                  <Image
                    src="/dados-ipcf-logo.png"
                    alt="Logo Dados IPCF"
                    width={80}
                    height={80}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-white">
                    Como funciona o Dados IPCF
                  </h2>
                  <p className="text-xs text-ipcf-gold-soft">
                    Simples, rápido e 100% seguro (LGPD)
                  </p>
                </div>
              </div>

              <ul className="mt-5 space-y-4 text-sm text-white/90">
                <li className="flex items-start gap-3">
                  <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-ipcf-gold-soft" aria-hidden="true" />
                  <span>
                    <strong className="block text-white">Vínculo Conjugal Automático</strong>
                    O primeiro cônjuge preenche o lar; quando o segundo entra com o próprio CPF, endereço e filhos já aparecem preenchidos.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-ipcf-gold-soft" aria-hidden="true" />
                  <span>
                    <strong className="block text-white">Convite para Filhos Jovens e Adultos</strong>
                    Pais cadastram os filhos em segundos e podem gerar um link exclusivo pelo WhatsApp quando o filho precisar de acesso próprio.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-ipcf-gold-soft" aria-hidden="true" />
                  <span>
                    <strong className="block text-white">Sigilo no Pedido de Oração</strong>
                    Seu motivo de oração pessoal é restrito apenas a você e aos pastores da IPCF — nem mesmo o cônjuge consegue visualizar.
                  </span>
                </li>
              </ul>
            </aside>
          </div>
        </section>

        {!ctx.configured && (
          <div className="px-4 sm:px-6">
            <SetupBanner />
          </div>
        )}

        {/* Rodapé institucional simples */}
        <footer className="border-t border-ipcf-border bg-white px-4 py-6 text-center text-xs text-ipcf-muted sm:px-6">
          <p className="font-semibold text-ipcf-deep">
            Igreja Presbiteriana em Casa Forte · {IPCF_SEDE_ADDRESS}
          </p>
          <p className="mt-1">
            Ambiente privado de uso exclusivo pastoral e administrativo (indexação externa bloqueada).
          </p>
        </footer>
      </main>
    </>
  );
}
