import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, Clock, Zap, Phone, MessageSquare, Mail } from "lucide-react";

const ACTION_ICON: Record<string, typeof Phone> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  letter: Mail,
  pause: Clock,
};

const TONE_MAP: Record<string, string> = {
  foreclosure: "Empathetic and time-sensitive — acknowledge their stress, avoid pressure",
  tax_lien: "Helpful and educational — position yourself as a solution to their tax burden",
  divorce: "Sensitive and neutral — avoid taking sides, focus on a clean exit",
  delinquency: "Supportive and non-judgmental — many owners in this situation feel shame",
  default: "Warm and patient — build trust before discussing numbers",
};

const OBJECTION_MAP: Record<string, string> = {
  foreclosure: "If they say 'I'm not ready': Acknowledge the timeline pressure gently — 'I understand, but the clock on foreclosure can move fast. Would it help to at least know your options?'",
  tax_lien: "If they say 'I don't owe that much': Confirm the lien total and explain accumulated penalties — most owners underestimate the final amount.",
  divorce: "If they say 'my spouse won't agree': Ask if a cash offer might make the conversation easier — speed and certainty can break deadlocks.",
  delinquency: "If they say 'I'll catch up': Express understanding and ask what their plan is — most are relieved to share, and it surfaces real motivation.",
  default: "If they say 'I'm not interested': Acknowledge it — 'Totally fine, I just wanted to make sure you had options. Can I check back in a few weeks?'",
};

interface Props {
  pipelineDeal: {
    next_step_brief?: string | null;
    next_action?: string | null;
    follow_up_at?: string | null;
    urgency_flag?: boolean;
    stage?: string;
  } | null;
  reportData: Record<string, unknown>;
  distressTypes: string[];
  contactCount: number;
}

export const AISalesCoachingSection = ({ pipelineDeal, reportData, distressTypes, contactCount }: Props) => {
  const [expanded, setExpanded] = useState(true);

  if (contactCount === 0 || !pipelineDeal) return null;

  const primaryDistress = distressTypes[0] ?? "default";
  const tone = TONE_MAP[primaryDistress] ?? TONE_MAP.default;
  const objectionTip = OBJECTION_MAP[primaryDistress] ?? OBJECTION_MAP.default;
  const distressAnalysis = (reportData.distress_analysis as string) ?? null;

  const ActionIcon = ACTION_ICON[pipelineDeal.next_action ?? "call"] ?? Phone;

  const formatFollowUp = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    const diff = Math.round((d.getTime() - Date.now()) / 86400000);
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    return `in ${diff} days`;
  };

  const followUpLabel = formatFollowUp(pipelineDeal.follow_up_at);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <Brain className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">AI Sales Coach</span>
        {pipelineDeal.urgency_flag && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/20 text-destructive mr-2">
            <Zap className="h-2.5 w-2.5" />URGENT
          </span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Next best action */}
          {pipelineDeal.next_step_brief && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Next best action</p>
              <div className="flex items-start gap-2">
                <ActionIcon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">{pipelineDeal.next_step_brief}</p>
              </div>
              {followUpLabel && (
                <p className="text-xs text-muted-foreground ml-5">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Follow up {followUpLabel}
                  {pipelineDeal.next_action && ` via ${pipelineDeal.next_action}`}
                </p>
              )}
            </div>
          )}

          {/* Seller motivation */}
          {distressAnalysis && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Seller motivation</p>
              <p className="text-sm text-foreground leading-relaxed">{distressAnalysis}</p>
            </div>
          )}

          {/* Recommended tone */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recommended tone</p>
            <p className="text-sm text-foreground">{tone}</p>
          </div>

          {/* Objection handling */}
          <div className="rounded-lg bg-secondary/60 border border-border px-3 py-2.5 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Objection handling tip</p>
            <p className="text-xs text-foreground leading-relaxed">{objectionTip}</p>
          </div>
        </div>
      )}
    </div>
  );
};
