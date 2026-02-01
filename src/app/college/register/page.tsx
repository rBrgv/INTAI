"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Container from "@/components/Container";

export default function CollegeRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/college/login?mode=register");
  }, [router]);

  return (
    <Container className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        <p className="text-[var(--muted)]">Redirecting to registration...</p>
      </div>
    </Container>
  );
}

