"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, Building2, User, Phone, MapPin, Loader2 } from "lucide-react";
import Card from "@/components/Card";
import Container from "@/components/Container";

function CollegeAuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  // Login State
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Register State
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    contactPerson: "",
    phone: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/college/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || data.message || "Login failed");
        return;
      }

      // Redirect to dashboard
      const redirect = searchParams.get("redirect") || "/college/dashboard";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (registerData.password !== registerData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (registerData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/college/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerData.name,
          email: registerData.email,
          password: registerData.password,
          contactPerson: registerData.contactPerson,
          phone: registerData.phone,
          address: registerData.address,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || data.message || "Registration failed");
        return;
      }

      // Redirect to dashboard
      router.push("/college/dashboard");
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  };

  return (
    <Container className="py-8">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)] mb-2">College Portal</h1>
          <p className="text-[var(--muted)]">
            {mode === "login"
              ? "Sign in to manage your college's interviews and students"
              : "Register your college to start managing interviews"}
          </p>
        </div>

        <Card className="app-card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${mode === "login"
                ? "text-[var(--primary)] text-[var(--primary)]"
                : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
            >
              Sign In
              {mode === "login" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${mode === "register"
                ? "text-[var(--primary)] text-[var(--primary)]"
                : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
            >
              New Registration
              {mode === "register" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-3">
                <p className="text-sm text-[var(--danger)]">{error}</p>
              </div>
            )}

            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  College Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type="text"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    required
                    className="w-full pl-10 app-input"
                    placeholder="ABC College"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <input
                  type="email"
                  value={mode === "login" ? loginData.email : registerData.email}
                  onChange={(e) => {
                    if (mode === "login") setLoginData({ ...loginData, email: e.target.value });
                    else setRegisterData({ ...registerData, email: e.target.value });
                  }}
                  required
                  className="w-full pl-10 app-input"
                  placeholder="admin@college.edu"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <input
                  type="password"
                  value={mode === "login" ? loginData.password : registerData.password}
                  onChange={(e) => {
                    if (mode === "login") setLoginData({ ...loginData, password: e.target.value });
                    else setRegisterData({ ...registerData, password: e.target.value });
                  }}
                  required
                  minLength={mode === "register" ? 8 : undefined}
                  className="w-full pl-10 app-input"
                  placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                />
              </div>
            </div>

            {mode === "register" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                    <input
                      type="password"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      required
                      className="w-full pl-10 app-input"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Contact Person
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                    <input
                      type="text"
                      value={registerData.contactPerson}
                      onChange={(e) => setRegisterData({ ...registerData, contactPerson: e.target.value })}
                      className="w-full pl-10 app-input"
                      placeholder="Placement Officer Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                    <input
                      type="tel"
                      value={registerData.phone}
                      onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                      className="w-full pl-10 app-input"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                    <input
                      type="text"
                      value={registerData.address}
                      onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                      className="w-full pl-10 app-input"
                      placeholder="College Address"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="app-btn-primary w-full px-6 py-3 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login"
                ? (loading ? "Signing in..." : "Sign In")
                : (loading ? "Registering..." : "Register College")}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <p className="text-sm text-center text-[var(--muted)]">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-[var(--primary)] hover:underline font-medium text-[var(--primary)]"
              >
                {mode === "login" ? "Register your college" : "Sign in"}
              </button>
            </p>
          </div>
        </Card>
      </div>
    </Container>
  );
}

export default function CollegeAuthPage() {
  return (
    <Suspense fallback={
      <Container className="py-8">
        <div className="max-w-md mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Container>
    }>
      <CollegeAuthPageContent />
    </Suspense>
  );
}


