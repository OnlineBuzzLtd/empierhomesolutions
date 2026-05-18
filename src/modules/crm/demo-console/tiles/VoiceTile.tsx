// Voice tile (ticket D-3). Display-only: the prospect dials the demo
// Twilio voice number from their own phone, the AI receptionist (via
// the platform-api voice gateway) answers, and the booking lands in
// the live pane (C-4).
//
// The number is sourced from env (DEMO_VOICE_NUMBER). A click-to-call
// link lets the operator test the line from the laptop without needing
// a second device, but the intended demo flow is plumber-dials-from-
// their-own-mobile.
//
// QR codes are deliberately out of scope for the MVP — big readable
// numbers + tel: links work for in-person demos. We can add QR later
// if multiple demos surface the same "type the number" friction.

type VoiceTileProps = {
  voiceNumber: string | null;
};

export function VoiceTile({ voiceNumber }: VoiceTileProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Call our AI receptionist</h3>
        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-purple-700">
          voice
        </span>
      </header>

      {voiceNumber ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Dial from your phone</p>
          <a
            href={`tel:${voiceNumber.replace(/\s+/g, "")}`}
            className="text-3xl font-bold tabular-nums text-slate-900 hover:text-blue-700"
          >
            {voiceNumber}
          </a>
          <p className="text-center text-xs text-slate-600">
            Our AI answers, has a real conversation, and books you in.
            <br />
            The booking lands in the live CRM pane on the right.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <p className="font-semibold">Demo voice number not configured.</p>
          <p className="mt-1">
            Set <code>DEMO_VOICE_NUMBER</code> in <code>.env.local</code> after the demo Twilio
            subaccount (ticket A-2) is provisioned.
          </p>
        </div>
      )}
    </section>
  );
}
