import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatters";

type DuelFeedItem = {
  event: string;
  created_at?: string;
  payload: Record<string, unknown>;
};

export function DuelFeed({ events }: { events: DuelFeedItem[] }) {
  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <Card key={`${event.event}-${index}`} className="border-border/80 bg-white text-sm text-foreground shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm capitalize tracking-[0.08em]">{event.event.replaceAll("_", " ")}</CardTitle>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {event.created_at ? formatDateTime(event.created_at) : "live"}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="mt-2 rounded-xl bg-muted/70 p-3 text-xs text-muted-foreground">
              {Object.entries(event.payload).length ? (
                <div className="space-y-2">
                  {Object.entries(event.payload).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <span className="uppercase tracking-[0.12em] text-muted-foreground/80">
                        {key.replaceAll("_", " ")}
                      </span>
                      <span className="text-right text-foreground/85">
                        {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                          ? String(value)
                          : JSON.stringify(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span>No extra details.</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
