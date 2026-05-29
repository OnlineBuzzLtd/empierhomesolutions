export default function FeedbackThanksPage({ searchParams }: { searchParams?: { status?: string } }) {
  const invalid = searchParams?.status === "invalid";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold">{invalid ? "Feedback link unavailable" : "Thanks for your feedback"}</h1>
        <p className="mt-3 text-sm text-slate-600">
          {invalid
            ? "This link may have expired or already been used."
            : "Your response has been received."}
        </p>
      </div>
    </main>
  );
}
