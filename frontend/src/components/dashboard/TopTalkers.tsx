import { useTopTalkers } from "../../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Loader2 } from "lucide-react";

interface TalkerEntry {
  ip: string;
  connections: number;
  bytes: number;
}

export default function TopTalkers() {
  const { data, isLoading, isFetching } = useTopTalkers();
  const talkers: TalkerEntry[] = data?.talkers ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Top Talkers</CardTitle>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : talkers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conntrack data available.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">#</th>
                <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Source IP</th>
                <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Connections</th>
                <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {talkers.map((t, i) => (
                <tr key={t.ip} className="border-b hover:bg-muted/50">
                  <td className="py-1.5 px-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 px-2 font-mono text-xs">{t.ip}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-xs">{t.connections}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-xs">{t.bytes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
