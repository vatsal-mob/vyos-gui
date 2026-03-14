import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuthStore } from "../store/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2 } from "lucide-react";

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
      setError(msg || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        {/* Logo mark */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight text-primary">VyOS</span>
            <span className="text-2xl font-light tracking-tight text-muted-foreground">GUI</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Network Operations Interface</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs">Username</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="font-mono"
            />
          </div>

          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "Hide" : "Show"} advanced settings
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded border border-border p-3 bg-card">
              <div className="space-y-1.5">
                <Label htmlFor="vyos_host" className="text-xs">VyOS Host</Label>
                <Input
                  id="vyos_host"
                  placeholder="10.10.10.1"
                  value={form.vyos_host}
                  onChange={(e) => setForm({ ...form, vyos_host: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vyos_ssh_user" className="text-xs">SSH Username</Label>
                <Input
                  id="vyos_ssh_user"
                  placeholder="vyos"
                  value={form.vyos_ssh_user}
                  onChange={(e) => setForm({ ...form, vyos_ssh_user: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vyos_ssh_password" className="text-xs">SSH Password</Label>
                <Input
                  id="vyos_ssh_password"
                  type="password"
                  value={form.vyos_ssh_password}
                  onChange={(e) => setForm({ ...form, vyos_ssh_password: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vyos_api_key" className="text-xs">API Key <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="vyos_api_key"
                  value={form.vyos_api_key}
                  onChange={(e) => setForm({ ...form, vyos_api_key: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
