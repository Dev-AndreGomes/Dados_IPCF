import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, UserCheck, LogOut, LayoutDashboard, Home } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";
import { MobileNavMenu } from "@/components/MobileNavMenu";
import type { Member } from "@/types/database.types";

interface HeaderProps {
  member?: Member | null;
  activeRoute?: "home" | "login" | "censo" | "minha-ficha" | "admin" | "convite";
}

export function Header({ member, activeRoute }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ipcf-deep text-white shadow-sm">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-ipcf-gold sm:gap-3.5"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-ipcf-gold/40 sm:h-14 sm:w-14">
            <Image
              src="/dados-ipcf-logo.png"
              alt="Logo do Dados IPCF"
              width={56}
              height={56}
              unoptimized
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block truncate font-serif text-base font-bold tracking-tight text-white sm:text-lg">
              Dados IPCF
            </span>
            <span className="block truncate text-[10px] font-medium tracking-wide text-ipcf-gold-soft/90 uppercase sm:text-[11px]">
              Casa Forte · Recife
            </span>
          </div>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-2 sm:flex sm:gap-3">
          {member ? (
            <>
              <Link
                href="/minha-ficha"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  activeRoute === "minha-ficha"
                    ? "bg-white/15 text-ipcf-gold-soft"
                    : "text-white/90 hover:bg-white/10"
                }`}
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                <span>Minha Ficha</span>
              </Link>

              {member.role === "admin" && (
                <Link
                  href="/admin"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                    activeRoute === "admin"
                      ? "bg-ipcf-gold text-ipcf-deep"
                      : "bg-ipcf-gold/15 text-ipcf-gold-soft hover:bg-ipcf-gold/25"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  <span>Painel Pastoral</span>
                </Link>
              )}

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10 sm:text-sm"
                  aria-label="Sair da sua conta"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </form>
            </>
          ) : (
            <>
              {activeRoute !== "home" && (
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 sm:text-sm"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Início</span>
                </Link>
              )}
              {activeRoute !== "censo" && (
                <Link
                  href="/censo"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ipcf-gold px-3.5 py-2 text-xs font-bold text-ipcf-deep transition hover:bg-ipcf-gold-soft sm:text-sm"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Fazer Meu Cadastro</span>
                </Link>
              )}
              {activeRoute !== "login" && (
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 sm:text-sm"
                >
                  Entrar
                </Link>
              )}
            </>
          )}
        </nav>

        <MobileNavMenu
          isAuthenticated={Boolean(member)}
          role={member?.role}
          activeRoute={activeRoute}
        />
      </div>
    </header>
  );
}
