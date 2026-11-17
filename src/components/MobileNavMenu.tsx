"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";
import type { Role } from "@/types/database.types";

interface MobileNavMenuProps {
  isAuthenticated: boolean;
  role?: Role;
  activeRoute?: "home" | "login" | "censo" | "minha-ficha" | "admin" | "convite";
}

export function MobileNavMenu({
  isAuthenticated,
  role,
  activeRoute,
}: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="sm:hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Fechar menu" : "Abrir menu de navegação"}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white transition hover:bg-white/15"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full z-50 border-b border-white/15 bg-ipcf-deep px-4 py-4 shadow-lg"
        >
          <div className="flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                    activeRoute === "home"
                      ? "bg-white/15 text-ipcf-gold-soft"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span>Início</span>
                </Link>

                <Link
                  href="/minha-ficha"
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                    activeRoute === "minha-ficha"
                      ? "bg-white/15 text-ipcf-gold-soft"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Minha Ficha</span>
                </Link>

                {role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                      activeRoute === "admin"
                        ? "bg-ipcf-gold text-ipcf-deep"
                        : "bg-ipcf-gold/15 text-ipcf-gold-soft hover:bg-ipcf-gold/25"
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    <span>Painel Pastoral</span>
                  </Link>
                )}

                <form action={logoutAction} className="pt-1">
                  <button
                    type="submit"
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/20 px-3.5 py-2.5 text-sm font-semibold text-white/95 transition hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Sair da Conta</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                {activeRoute !== "home" && (
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"
                  >
                    <Home className="h-4 w-4" aria-hidden="true" />
                    <span>Início</span>
                  </Link>
                )}

                {activeRoute !== "censo" && (
                  <Link
                    href="/censo"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl bg-ipcf-gold px-3.5 py-2.5 text-sm font-bold text-ipcf-deep hover:bg-ipcf-gold-soft"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Fazer Meu Cadastro</span>
                  </Link>
                )}

                {activeRoute !== "login" && (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Já tenho cadastro · Entrar
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
