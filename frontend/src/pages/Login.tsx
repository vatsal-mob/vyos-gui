import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuthStore } from "../store/auth";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({
    username: "admin",
    password: "",
    vyos_host: "",
    vyos_ssh_user: "",
    vyos_ssh_password: "",
    vyos_api_key: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        username: form.username,
        password: form.password,
      };
      if (form.vyos_host) payload.vyos_host = form.vyos_host;
      if (form.vyos_ssh_user) payload.vyos_ssh_user = form.vyos_ssh_user;
      if (form.vyos_ssh_password) payload.vyos_ssh_password = form.vyos_ssh_password;
      if (form.vyos_api_key) payload.vyos_api_key = form.vyos_api_key;

      const { data } = await api.post("/auth/login", payload);
      login(data.username);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-40" />

      {/* Radial glow center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-primary/4 blur-3xl" />
      </div>

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 text-muted-foreground/20 font-mono text-xs select-none">
        <div>// VYOS NETWORK OPERATIONS</div>
        <div>// SECURE ACCESS TERMINAL</div>
      </div>
      <div className="absolute bottom-8 right-8 text-muted-foreground/15 font-mono text-xs select-none text-right">
        <div>RFC 2328 · RFC 4271</div>
        <div>RFC 4364 · RFC 7348</div>
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-sm mx-4">
        {/* Card */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
          {/* Card top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          <div className="p-8">
            {/* Logo */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-9 h-9 bg-primary/10 border border-primary/25 rounded-sm">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 3L9 15L15 3" stroke="hsl(199,95%,52%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5.5 7.5H12.5" stroke="hsl(199,95%,52%)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-xl font-semibold text-primary tracking-tight">VyOS</span>
                    <span className="font-display text-xl font-light text-muted-foreground/60 tracking-tight">GUI</span>
                  </div>
                  <p className="text-2xs font-mono text-muted-foreground/50 tracking-widest uppercase">
                    Network Operations Interface
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  Username
                </Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  className="font-mono h-9 bg-background border-border focus:border-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="font-mono h-9 bg-background border-border focus:border-primary/50"
                />
              </div>

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-2xs font-mono text-muted-foreground/60 hover:text-primary transition-colors uppercase tracking-wider"
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Advanced settings
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded border border-border/60 p-3 bg-background/50">
                  <div className="space-y-1.5">
                    <Label htmlFor="vyos_host" className="text-2xs text-muted-foreground font-mono uppercase tracking-wider">
                      VyOS Host
                    </Label>
                    <Input
                      id="vyos_host"
                      placeholder="10.10.10.1"
                      value={form.vyos_host}
                      onChange={(e) => setForm({ ...form, vyos_host: e.target.value })}
                      className="font-mono h-8 text-xs bg-background border-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="vyos_ssh_user" className="text-2xs text-muted-foreground font-mono uppercase tracking-wider">
                        SSH User
                      </Label>
                      <Input
                        id="vyos_ssh_user"
                        placeholder="vyos"
                        value={form.vyos_ssh_user}
                        onChange={(e) => setForm({ ...form, vyos_ssh_user: e.target.value })}
                        className="font-mono h-8 text-xs bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vyos_ssh_password" className="text-2xs text-muted-foreground font-mono uppercase tracking-wider">
                        SSH Pass
                      </Label>
                      <Input
                        id="vyos_ssh_password"
                        type="password"
                        value={form.vyos_ssh_password}
                        onChange={(e) => setForm({ ...form, vyos_ssh_password: e.target.value })}
                        className="font-mono h-8 text-xs bg-background border-border"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vyos_api_key" className="text-2xs text-muted-foreground font-mono uppercase tracking-wider">
                      API Key <span className="normal-case text-muted-foreground/40">(optional)</span>
                    </Label>
                    <Input
                      id="vyos_api_key"
                      value={form.vyos_api_key}
                      onChange={(e) => setForm({ ...form, vyos_api_key: e.target.value })}
                      className="font-mono h-8 text-xs bg-background border-border"
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded border border-destructive/25 bg-destructive/8 px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  <p className="text-xs font-mono text-destructive">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full h-9 rounded bg-primary text-primary-foreground text-xs font-display font-semibold tracking-wider uppercase hover:bg-primary/90 disabled:opacity-60 transition-colors overflow-hidden group"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading ? "Authenticating..." : "Sign In"}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Version tag below card */}
        <p className="mt-4 text-center text-2xs font-mono text-muted-foreground/30">
          VyOS GUI · Built with FastAPI + React
        </p>
      </div>
    </div>
  );
}
