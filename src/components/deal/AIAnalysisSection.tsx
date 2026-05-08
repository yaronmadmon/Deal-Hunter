import { CheckCircle2, Clock3, Radar, ShieldAlert } from "lucide-react";

import {
  buildDerivedNextStep,
  buildDerivedOpportunitySummary,
  buildDerivedUrgencySummary,
  type HistoryBundle,
} from "@/lib/property-history";

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
  history_summary?: string | null;
  urgency_summary?: string | null;
  next_step?: string | null;
  intelligence?: {
    dealKillers?: {
      killSignals?: { type: string; evidence: string }[];
    };
  };
}

const toStr = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.text ?? record.content ?? record.snippet ?? record.evidence ?? JSON.stringify(value));
  }
  return String(value ?? "");
};

interface Props {
  reportData?: ReportData | null;
  history?: HistoryBundle | null;
  property?: { equity_pct?: number | null } | null;
  distressDetails?: Record<string, any> | null;
}

const HIGH_RISK_FLOOD_PATTERNS = [
  /\bzone (?:a|ae|ah|ao|ar|a99|ve|v|a\d{1,2}|v\d{1,2})\b/i,
  /special flood hazard area/i,
  /\bsfha\b/i,
  /mandatory flood insurance/i,
  /1% annual chance flood/i,
  /coastal high hazard/i,
];

const shouldDisplayKillSignal = (signal: { type: string; evidence: string }) => {
  if (signal.type !== "flood_zone") return true;
  return HIGH_RISK_FLOOD_PATTERNS.some((pattern) => pattern.test(signal.evidence ?? ""));
};

const InsightCard = ({
  label,
  icon: Icon,
  text,
}: {
  label: string;
  icon: typeof Clock3;
  text: string;
}) => (
  <div className="rounded-2xl border border-border bg-background px-4 py-3">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
    <p className="mt-2 text-sm leading-relaxed text-foreground">{text}</p>
  </div>
);

export const AIAnalysisSection = ({ reportData, history, property, distressDetails }: Props) => {
  if (!reportData) return <p className="text-sm text-muted-foreground">Opportunity brief not yet available.</p>;

  const killSignals = (reportData.intelligence?.dealKillers?.killSignals ?? []).filter(shouldDisplayKillSignal);
  const opportunities = (reportData.opportunities ?? []).map(toStr).filter(Boolean);
  const risks = (reportData.risks ?? []).map(toStr).filter(Boolean);
  const opportunitySummary = buildDerivedOpportunitySummary({ reportData, history, property, distressDetails });
  const urgencySummary = buildDerivedUrgencySummary({ reportData, distressDetails, history });
  const nextStep = buildDerivedNextStep({ reportData, distressDetails, history });
  const marketContext = reportData.market_heat_assessment || reportData.opportunity_analysis || reportData.equity_assessment || "";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <InsightCard label="History" icon={Radar} text={opportunitySummary} />
        <InsightCard label="Urgency" icon={Clock3} text={urgencySummary} />
        <InsightCard label="Next Move" icon={CheckCircle2} text={nextStep} />
      </div>

      {(opportunities.length > 0 || risks.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.length > 0 ? (
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Opportunity Signals</p>
              <ul className="mt-3 space-y-2">
                {opportunities.slice(0, 4).map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {risks.length > 0 ? (
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Watchouts</p>
              <ul className="mt-3 space-y-2">
                {risks.slice(0, 4).map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {killSignals.length > 0 && (
        <div className="rounded-2xl border border-border bg-background px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Recorded Deal Killers</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {killSignals.map((signal, index) => (
              <DealKillerBadge key={index} type={signal.type} evidence={signal.evidence} />
            ))}
          </div>
        </div>
      )}

      {marketContext ? (
        <div className="rounded-2xl border border-border bg-background px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Market Context</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{marketContext}</p>
        </div>
      ) : null}
    </div>
  );
};
