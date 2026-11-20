"use client";

import { signIn, useSession } from "next-auth/react";
import { logout } from "@/lib/logout";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setIsSigningIn(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || null }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? "Could not create your account");
          setIsSigningIn(false);
          return;
        }
      }

      // Both flows end in a credentials sign-in.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          mode === "signup"
            ? "Account created, but sign-in failed. Try logging in."
            : "Invalid email or password"
        );
        setIsSigningIn(false);
      } else if (result?.ok) {
        // The useEffect will handle the redirect based on role
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
      setIsSigningIn(false);
    }
  };

  // If already authenticated, redirect based on role
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = ((session.user as { role?: string })?.role ?? "participant").toLowerCase();
      switch (role) {
        case "admin":
          router.push("/admin");
          break;
        case "steward":
          router.push("/steward");
          break;
        case "analyst":
          router.push("/analyst");
          break;
        case "participant": {
          // Google sign-in never reaches this effect (it redirects server-side
          // straight to /dashboard) — ParticipantShell's own gate catches that
          // path. This covers the credentials sign-in flow, which does render
          // this component.
          const locale = (session.user as { locale?: string | null }).locale;
          router.push(locale ? "/dashboard" : "/choose-language");
          break;
        }
        default:
          // Unknown role - sign out to break the infinite redirect loop
          logout();
      }
    }
  }, [status, session, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0F0C16] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-brand-gold)] animate-spin" />
      </div>
    );
  }

  // If authenticated, show loading while redirect happens
  if (status === "authenticated") {
    return (
      <div className="min-h-screen bg-[#0F0C16] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-brand-gold)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0C16] flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-brand-purple)] rounded-full blur-[120px] opacity-20"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-brand-gold)] rounded-full blur-[120px] opacity-10"></div>
      </div>

      <div className="z-10 w-full max-w-md p-8 border border-[#2A1F36] rounded-3xl bg-[var(--color-surface)] shadow-2xl relative">
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#1C1525] border border-[var(--color-brand-gold)] overflow-hidden flex items-center justify-center">
           <Image src="/assets/logo-mark.png" alt="Womb Atlas" width={56} height={56} className="object-cover" />
        </div>

        <div className="text-center mt-6 mb-10">
          <h1 className="text-3xl font-serif text-white mb-2">Womb Atlas</h1>
          <p className="text-sm text-gray-400">
            {mode === "signup" ? "Create your account" : "Secure Observatory MVP"}
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1C1525] border border-[#2A1F36] rounded-xl p-4 flex items-start space-x-3">
            <ShieldCheck className="text-[var(--color-brand-green)] flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-xs font-medium text-white mb-1">Secure &amp; Encrypted</p>
              <p className="text-[10px] text-gray-400">Your health data is stored securely. Womb Atlas acts as a neutral observatory, never sharing data without consent.</p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center space-x-3 bg-white text-black py-3 px-4 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningIn ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{isSigningIn ? "Signing in..." : "Continue with Google"}</span>
            </button>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#2A1F36]"></div>
              <span className="flex-shrink-0 mx-4 text-xs text-gray-500">OR</span>
              <div className="flex-grow border-t border-[#2A1F36]"></div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}

              {mode === "signup" && (
                <input
                  type="text"
                  placeholder="Full name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-brand-gold)] transition-colors"
                />
              )}

              <input
                type="email" 
                placeholder="Email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-brand-gold)] transition-colors"
              />
              
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-brand-gold)] transition-colors"
              />

              {mode === "signup" && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-brand-gold)] transition-colors"
                />
              )}

              <button
                type="submit"
                disabled={isSigningIn}
                className="w-full bg-[var(--color-brand-purple)] hover:bg-opacity-80 text-white py-3 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex justify-center"
              >
                {isSigningIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : mode === "signup" ? (
                  "Create Account"
                ) : (
                  "Log In"
                )}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                disabled={isSigningIn}
                className="text-[var(--color-brand-gold)] hover:underline disabled:opacity-50"
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-gray-500 z-10">Womb Atlas Observatory MVP • Pre-release Candidate</p>
    </div>
  );
}
