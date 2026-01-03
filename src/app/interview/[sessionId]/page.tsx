import InterviewClient from "./InterviewClient";

export default async function InterviewSessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <InterviewClient sessionId={params.sessionId} />
      </div>
    </main>
  );
}

