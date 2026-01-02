import InterviewClient from "./InterviewClient";

export default async function InterviewSessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h2 className="text-2xl font-semibold">Interview Session</h2>
      <p className="mt-2 text-slate-600">
        Generate questions and step through them. (No scoring yet.)
      </p>
      <InterviewClient sessionId={params.sessionId} />
    </main>
  );
}

