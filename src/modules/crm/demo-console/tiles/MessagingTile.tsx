// Messaging tile (ticket D-4). SMS + WhatsApp inbound numbers in a
// single tile because they share UX: prospect texts a number from
// their phone, the AI replies, booking lands in the live pane.
//
// Numbers sourced from env (DEMO_SMS_NUMBER, DEMO_WHATSAPP_NUMBER).
// WhatsApp deep link uses wa.me; SMS uses sms: which works on iOS and
// most Android dialers.
//
// The "yours must be allowlisted" copy is deliberately visible so the
// operator doesn't accidentally invite a prospect to text whose number
// isn't on DEMO_CONSOLE_ALLOWLIST (the guard would reject the outbound
// confirmation, ruining the demo).

type MessagingTileProps = {
  smsNumber: string | null;
  whatsappNumber: string | null;
};

export function MessagingTile({ smsNumber, whatsappNumber }: MessagingTileProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Text us or WhatsApp us</h3>
        <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
          sms · whatsapp
        </span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <MessagingCard
          label="SMS"
          number={smsNumber}
          href={smsNumber ? `sms:${smsNumber.replace(/\s+/g, "")}` : null}
          envVar="DEMO_SMS_NUMBER"
          accent="cyan"
        />
        <MessagingCard
          label="WhatsApp"
          number={whatsappNumber}
          href={whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}` : null}
          envVar="DEMO_WHATSAPP_NUMBER"
          accent="emerald"
        />
      </div>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
        You'll get a real text back after the booking confirms. Make sure your number is on
        <code className="mx-1">DEMO_CONSOLE_ALLOWLIST</code>or the outbound is blocked.
      </p>
    </section>
  );
}

function MessagingCard({
  label,
  number,
  href,
  envVar,
  accent,
}: {
  label: string;
  number: string | null;
  href: string | null;
  envVar: string;
  accent: "cyan" | "emerald";
}) {
  const accentBg = accent === "cyan" ? "bg-cyan-50" : "bg-emerald-50";
  const accentText = accent === "cyan" ? "text-cyan-700" : "text-emerald-700";

  if (!number) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
        <p className="font-semibold">{label} number not configured.</p>
        <p className="mt-1">
          Set <code>{envVar}</code> after ticket A-2.
        </p>
      </div>
    );
  }

  return (
    <a
      href={href ?? "#"}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 ${accentBg} p-4 hover:border-slate-300`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${accentText}`}>
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums text-slate-900">{number}</p>
    </a>
  );
}
