export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">How did we do?</h1>
        <form action={`/api/feedback/${encodeURIComponent(token)}`} method="post" className="mt-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">Rate the job</legend>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <label
                  key={score}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  <input className="sr-only" type="radio" name="score" value={score} required />
                  {score}
                </label>
              ))}
            </div>
          </fieldset>
          <textarea
            name="comment"
            placeholder="Anything we should know?"
            className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Submit feedback
          </button>
        </form>
      </div>
    </main>
  );
}
