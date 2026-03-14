import { useInterfaces } from "../hooks/useVyos";
import StatusBadge from "../components/shared/StatusBadge";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Loader2 } from "lucide-react";

export default function Interfaces() {
  const { data: interfaces, isLoading, isError } = useInterfaces();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Interfaces</h1>
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {isError && <p className="text-destructive">Failed to load interfaces.</p>}
      {!isLoading && !isError && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">IP Addresses</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">MAC</th>
                  <th className="px-4 py-3">MTU</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(interfaces ?? []).map((iface: {
                  name: string;
                  type: string;
                  addresses: string[];
                  state: string;
                  mac: string;
                  mtu: number | null;
                }) => (
                  <tr key={iface.name} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono font-medium">{iface.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{iface.type}</td>
                    <td className="px-4 py-3">
                      {iface.addresses.length ? (
                        iface.addresses.map((a: string) => (
                          <span key={a} className="mr-2 font-mono text-xs">
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={iface.state} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{iface.mac || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{iface.mtu ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/interfaces/${iface.name}`}
                        className="text-primary hover:underline text-xs"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
                {!interfaces?.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No interfaces found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
