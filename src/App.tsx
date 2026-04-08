import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthPage } from "@/components/auth/auth-page";
import { useAuth } from "@/contexts/auth-context";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    );
  }

  return user ? <AppShell /> : <AuthPage />;
}

export default App;
