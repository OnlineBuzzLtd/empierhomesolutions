"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Monitor } from "lucide-react";
import { setUiPreference } from "@/app/actions/ui-preference";
import { getSupabaseBrowserClient } from "@/modules/crm/lib/supabase-browser";

type Props = {
  fullName: string;
  email: string;
  role: string | null;
};

export function CommsoftAccountMenu({ fullName, email, role }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleSwitchToClassic() {
    startTransition(async () => {
      await setUiPreference("classic");
      router.refresh();
    });
  }

  const initials =
    fullName
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  return (
    <div ref={ref} className="fixed right-4 top-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white shadow-md hover:bg-slate-800 active:scale-95"
      >
        {initials}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
                <p className="truncate text-xs text-slate-500">{email}</p>
                {role ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{role}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={handleSwitchToClassic}
              disabled={pending}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Monitor size={16} className="text-slate-500" />
              <span>Switch to classic view</span>
            </button>
            <a
              href="/preferences"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <User size={16} className="text-slate-500" />
              <span>Preferences</span>
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
