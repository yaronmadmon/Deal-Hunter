import { TrendingUp, Users, AlertTriangle, FileText } from "lucide-react";

interface Intelligence {
  marketHeat?: {
    motivatedSellerVolume?: number;
    investorCompetitionCpc?: number;
    signal?: string;
  };
  neighborhoodSentiment?: {
    snippets?: string[];
    sentiment?: "Positive" | "Mixed" | "Negative";
  };
  ownerResearch?: {
    courtRecords?: string[];
    distressConfirmed?: boolean;
  };
  publicRecordsConfirm?: {
    lisPendensConfirmed?: boolean;
    taxLienConfirmed?: boolean;
  };
  marketNarrative?: string;
  dealKillers?: {
    floodZone?: boolean;
    environmental?: boolean;
    killSignals?: { type: string; evidence: string }[];
  };
}

interface Props {
  intelligence?: Intelligence | null;
}

const sentimentColor = {
  Positive: "text-green-400",
  Mixed: "text-yellow-400",
  Negative: "text-red-400",
};

export const IntelligenceSection = ({ intelligence }: Props) => {
  if (!intelligence) return <p className="text-sm text-muted-foreground">Intelligence data not available.</p>;

  const { marketHeat, neighborhoodSentiment, ownerResearch, publicRecordsConfirm, marketNarrative } = intelligence;

  return (
    <div className="space-y-5">
      {marketHeat && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" /> Market Heat
            {marketHeat.signal && (
              <span className="ml-auto text-xs rounded-full border border-border bg-secondary px-2.5 py-0.5 text-muted-foreground">
                {marketHeat.signal}
              </span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            {marketHeat.motivatedSellerVolume !== undefined && (
              <span>Motivated seller searches: <span className="text-foreground font-medium">{marketHeat.motivatedSellerVolume.toLocaleString()}/mo</span></span>
            )}
            {marketHeat.investorCompetitionCpc !== undefined && (
              <span>Investor CPC: <span className="text-foreground font-medium">${marketHeat.investorCompetitionCpc.toFixed(2)}</span></span>
            )}
          </div>
        </div>
      )}

      {neighborhoodSentiment && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-primary" /> Neighborhood Sentiment
            {neighborhoodSentiment.sentiment && (
              <span className={`ml-auto text-xs font-semibold ${sentimentColor[neighborhoodSentiment.sentiment] ?? ""}`}>
                {neighborhoodSentiment.sentiment}
              </span>
            )}
          </div>
          {neighborhoodSentiment.snippets && neighborhoodSentiment.snippets.length > 0 && (
            <ul className="space-y-1">
              {neighborhoodSentiment.snippets.slice(0, 3).map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-3">{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ownerResearch && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-primary" /> Owner Research
            {ownerResearch.distressConfirmed !== undefined && (
              <span className={`ml-auto text-xs font-semibold ${ownerResearch.distressConfirmed ? "text-red-400" : "text-muted-foreground"}`}>
                {ownerResearch.distressConfirmed ? "Distress Confirmed" : "Not Confirmed"}
              </span>
            )}
          </div>
          {ownerResearch.courtRecords && ownerResearch.courtRecords.length > 0 && (
            <ul className="space-y-1">
              {ownerResearch.courtRecords.slice(0, 3).map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-3">{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {publicRecordsConfirm && (
        <div className="flex gap-3 text-xs">
          <span className={`rounded-full border px-3 py-1 font-medium ${publicRecordsConfirm.taxLienConfirmed ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-border text-muted-foreground"}`}>
            Tax Lien {publicRecordsConfirm.taxLienConfirmed ? "✓" : "—"}
          </span>
          <span className={`rounded-full border px-3 py-1 font-medium ${publicRecordsConfirm.lisPendensConfirmed ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-border text-muted-foreground"}`}>
            Lis Pendens {publicRecordsConfirm.lisPendensConfirmed ? "✓" : "—"}
          </span>
        </div>
      )}

      {marketNarrative && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileText className="h-4 w-4 text-primary" /> Market Narrative
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{marketNarrative}</p>
        </div>
      )}
    </div>
  );
};
