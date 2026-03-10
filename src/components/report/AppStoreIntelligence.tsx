import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Smartphone, ExternalLink, Star } from "lucide-react";
import type { AppStoreIntelligenceData } from "@/data/mockReport";
import { ConfidenceLabel } from "./ConfidenceLabel";

interface Props {
  data: AppStoreIntelligenceData;
}

export const AppStoreIntelligence = ({ data }: Props) => {
  if (!data.apps || data.apps.length === 0) return null;

  return (
    <div className="bg-card border rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">App Market Signals</h2>
            <p className="text-xs text-muted-foreground">Apps already solving this problem — proof the market is real</p>
          </div>
        </div>
        <ConfidenceLabel level={data.confidence || "Medium"} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="h-9 text-[11px] font-semibold">App Name</TableHead>
              <TableHead className="h-9 text-[11px] font-semibold text-center">Platform</TableHead>
              <TableHead className="h-9 text-[11px] font-semibold text-center">Rating</TableHead>
              <TableHead className="h-9 text-[11px] font-semibold text-right">Reviews</TableHead>
              <TableHead className="h-9 text-[11px] font-semibold text-right">Est. Downloads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.apps.map((app) => (
              <TableRow key={app.name}>
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{app.name}</span>
                    {app.url && (
                      <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2.5 text-center">
                  <Badge variant="secondary" className="text-[10px] px-2 py-0">{app.platform}</Badge>
                </TableCell>
                <TableCell className="py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-warning fill-warning" />
                    <span className="text-sm font-medium">{app.rating}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 text-sm text-right text-muted-foreground">{app.reviews}</TableCell>
                <TableCell className="py-2.5 text-sm text-right font-medium text-foreground">{app.downloads}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.insight && (
        <p className="text-sm text-muted-foreground mt-4 bg-secondary/30 rounded-lg px-4 py-3">{data.insight}</p>
      )}

      {data.source && (
        <p className="text-[10px] text-muted-foreground mt-3">Source: {data.source}</p>
      )}
    </div>
  );
};
