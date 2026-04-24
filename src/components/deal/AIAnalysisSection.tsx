import { CheckCircle2, XCircle } from "lucide-react";
import { DealKillerBadge } from "./DealKillerBadge";

interface ReportData {
  score_rationale?: string;
  distress_analysis?: string;
  equity_assessment?: string;
  market_heat_assessment?: string;
  opportunities?: Array<string | unknown>;
  risks?: Array<string | unknown>;
  opportunity_type?: string | null;
  opportunity_analysis?: string | null;
  intelligence?: {
    dealKillers?: {
      killSignals?: { type: string; evidence: string }[];
    };
  };
}

const toStr = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.text ?? o.content ?? o.snippet ?? o.evidence ?? JSON.stringify(v));
  }
  return String(v ?? "");
};

interface Props {
  reportData?: ReportData | null;
}

const AnalysisBlock = ({ label, text }: { label: string; text?: string }) => {
  if (!text) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
};

export const AIAnalysisSection = ({ reportData }: Props) => {
  if (!reportData) return <p className="text-sm text-muted-foreground">Analysis not yet available.</p>;

  const killSignals = reportData.intelligence?.dealKillers?.killSignals ?? [];
  const opps = reportData.opportunities ?? [];
  const risks = reportData.risks ?? [];

  return (
    <div className="space-y-6">
      {killSignals.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Deal Kill Signals</p>
          <div className="flex flex-wrap gap-3">
            {killSignals.map((s, i) => (
              <DealKillerBadge key={i} type={s.type} evidence={s.evidence} />
            ))}
          </div>
        </div>
      )}

      <AnalysisBlock label="Score Rationale" text={reportData.score_rationale} />
      <AnalysisBlock label="Distress Analysis" text={reportData.distress_analysis} />
      <AnalysisBlock label="Equity Assessment" text={reportData.equity_assessment} />
      <AnalysisBlock label="Market Heat" text={reportData.market_heat_assessment} />
      {reportData.opportunity_analysis && (
        <AnalysisBlock label="Opportunity Analysis" text={reportData.opportunity_analysis} />
      )}

      {(opps.length > 0 || risks.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {opps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Opportunities</p>
              <ul className="space-y-1.5">
                {opps.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    {toStr(o)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {risks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Risks</p>
              <ul className="space-y-1.5">
                {risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    {toStr(r)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!reportData.score_rationale && killSignals.length === 0 && (
        <p className="text-sm text-muted-foreground">AI analysis is being generated...</p>
      )}
    </div>
  );
};
