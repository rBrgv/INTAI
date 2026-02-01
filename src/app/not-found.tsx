import Link from "next/link";
import Container from "@/components/Container";
import Card from "@/components/Card";

export default function NotFound() {
  return (
    <Container className="py-12">
      <Card className="app-card max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[var(--text)] mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-[var(--text)] mb-4">
            Page Not Found
          </h2>
          <p className="text-[var(--muted)] mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="app-btn-primary px-6 py-2.5">
              Go home
            </Link>
            <Link href="/college/dashboard" className="app-btn-secondary px-6 py-2.5">
              Dashboard
            </Link>
          </div>
        </div>
      </Card>
    </Container>
  );
}

