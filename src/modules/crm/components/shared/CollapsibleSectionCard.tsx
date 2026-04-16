"use client";

import { useState, type ReactNode } from "react";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";

export function CollapsibleSectionCard({
  title,
  action,
  demoAnchor,
  defaultOpen = true,
  children,
}: {
  title: string;
  action?: ReactNode;
  demoAnchor?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);

  function toggle() {
    if (!open && !everOpened) {
      setEverOpened(true);
    }
    setOpen((prev) => !prev);
  }

  return (
    <DemoAnchor name={demoAnchor}>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
          aria-expanded={open}
        >
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <div className="flex items-center gap-3">
            {action ? <span onClick={(e) => e.stopPropagation()}>{action}</span> : null}
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-transform duration-200"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
              aria-hidden
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </button>
        {everOpened ? (
          <div className={open ? "border-t border-slate-100 p-5 pt-4" : "hidden"}>
            {children}
          </div>
        ) : null}
      </section>
    </DemoAnchor>
  );
}
