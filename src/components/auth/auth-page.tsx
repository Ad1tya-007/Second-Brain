import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup";

export function AuthPage() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loading, error, clearError } =
    useAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError ?? error;

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setLocalError(null);
    clearError();
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (tab === "signup" && password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    try {
      if (tab === "signin") {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch {
      // error is already set in context
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    clearError();
    try {
      await loginWithGoogle();
    } catch {
      // error is already set in context
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background px-4">
      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        {/* App name / logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <span className="text-lg font-bold text-primary">N</span>
          </div>
          <h1 className="text-base font-semibold tracking-tight">Notes</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Your local AI-powered notebook</p>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex rounded-lg border border-border p-0.5">
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={tab === "signin" ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9 pr-9 text-sm"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-3.5" strokeWidth={1.75} />
                ) : (
                  <Eye className="size-3.5" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          {tab === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs">
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* Error */}
          {displayError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {displayError}
            </p>
          )}

          <Button type="submit" className="mt-1 w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : tab === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google button */}
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2.5"
          onClick={handleGoogle}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google "G" icon (inline SVG — no external dep needed)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
