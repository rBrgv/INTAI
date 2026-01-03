"use client";

import { useEffect } from "react";
import Container from "@/components/Container";
import Card from "@/components/Card";
import { clientLogger } from "@/lib/clientLogger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLogger.error("Application error", error, { digest: error.digest });
  }, [error]);

  return (
    <Container className="py-12">
      <Card className="app-card max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--text)] mb-4">
            Something went wrong!
          </h1>
          <p className="text-[var(--muted)] mb-6">
            {error.message || "An unexpected error occurred"}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="app-btn-primary px-6 py-2.5"
            >
              Try again
            </button>
            <a
              href="/"
              className="app-btn-secondary px-6 py-2.5"
            >
              Go home
            </a>
          </div>
        </div>
      </Card>
    </Container>
  );
}

