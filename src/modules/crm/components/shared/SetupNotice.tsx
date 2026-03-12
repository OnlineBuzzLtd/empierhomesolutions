export function SetupNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">CRM Setup Required</p>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}
