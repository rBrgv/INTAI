import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/Container";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";

export default function ModePage() {
  return (
    <Container className="py-12">
      <SectionTitle title="Choose Interview Mode" className="text-center" />
      <p className="mt-3 text-center text-lg text-[var(--muted)] mb-8">
        Select the mode that matches your use case.
      </p>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="group">
          <Card className="h-full flex flex-col transition-all duration-200 group-hover:shadow-lg group-hover:border-[var(--primary)]">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Company Mode</h3>
              <p className="text-[var(--muted)] text-sm mb-4">
                Recruiter-led: Set up interview for a specific candidate with Job Description + Resume.
              </p>
              <ul className="text-xs text-[var(--muted)] space-y-1">
                <li>• One candidate per interview</li>
                <li>• Tailored questions from JD + Resume</li>
                <li>• Full recruiter report</li>
              </ul>
            </div>
            <div className="flex gap-2 mt-4">
              <Link
                href="/company"
                className="flex-1 inline-flex items-center justify-center text-[var(--primary)] font-medium text-sm gap-1 border border-[var(--primary)] rounded px-4 py-2 hover:bg-[var(--primary)] hover:text-white transition-colors"
              >
                Create Interview <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Card>
        </div>

        <div className="group">
          <Card className="h-full flex flex-col transition-all duration-200 group-hover:shadow-lg group-hover:border-[var(--primary)]">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-[var(--text)] mb-2">College Mode</h3>
              <p className="text-[var(--muted)] text-sm mb-4">
                Placement office: Create job template once, send bulk interview links to multiple candidates.
              </p>
              <ul className="text-xs text-[var(--muted)] space-y-1">
                <li>• One template, many candidates</li>
                <li>• CSV upload for bulk sending</li>
                <li>• Cohort analytics dashboard</li>
              </ul>
            </div>
            <div className="flex gap-2 mt-4">
              <Link
                href="/college"
                className="flex-1 inline-flex items-center justify-center text-[var(--primary)] font-medium text-sm gap-1 border border-[var(--primary)] rounded px-4 py-2 hover:bg-[var(--primary)] hover:text-white transition-colors"
              >
                Create Template <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Card>
        </div>

        <div className="group">
          <Card className="h-full flex flex-col transition-all duration-200 group-hover:shadow-lg group-hover:border-[var(--primary)]">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Individual Mode</h3>
              <p className="text-[var(--muted)] text-sm mb-4">
                Self-serve: Create and take your own interview for practice or job applications.
              </p>
              <ul className="text-xs text-[var(--muted)] space-y-1">
                <li>• Self-directed interview</li>
                <li>• Resume + Role/Level selection</li>
                <li>• Candidate-friendly report</li>
              </ul>
            </div>
            <div className="flex gap-2 mt-4">
              <Link
                href="/individual"
                className="flex-1 inline-flex items-center justify-center text-[var(--primary)] font-medium text-sm gap-1 border border-[var(--primary)] rounded px-4 py-2 hover:bg-[var(--primary)] hover:text-white transition-colors"
              >
                Start Interview <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}

