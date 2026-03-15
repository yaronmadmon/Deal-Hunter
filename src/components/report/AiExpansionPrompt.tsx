import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Bot } from "lucide-react";
import { toast } from "sonner";
import type {
  MockReportData,
  BlueprintData,
} from "@/data/mockReport";

interface Props {
  report: MockReportData;
  blueprint: BlueprintData;
}

function extractWeaknesses(r: MockReportData): string[] {
  const items: string[] = [];

  // Kill shot risks
  r.killShotAnalysis?.risks?.forEach((risk) => {
    if (risk.risk) items.push(risk.risk);
  });

  // Review intelligence complaint clusters
  r.reviewIntelligence?.complaintClusters?.forEach((cluster) => {
    const line = cluster.exploitableGap
      ? `${cluster.theme}: ${cluster.exploitableGap}`
      : cluster.theme;
    items.push(line);
  });

  // Market exploit map competitor weaknesses
  r.marketExploitMap?.competitorWeaknesses?.forEach((w) => items.push(w));

  // Top complaints from market exploit map
  r.marketExploitMap?.topComplaints?.forEach((c) => items.push(c.complaint));

  // Build complexity tech challenges
  r.buildComplexity?.techChallenges?.forEach((t) => items.push(t));

  // Deduplicate (case-insensitive) and cap
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function extractSignals(r: MockReportData): string[] {
  const items: string[] = [];

  // Opportunity data
  r.opportunity?.featureGaps?.forEach((g) => items.push(g));
  r.opportunity?.underservedUsers?.forEach((u) => items.push(`Underserved segment: ${u}`));
  if (r.opportunity?.positioning) items.push(r.opportunity.positioning);

  // Founder insight
  if (r.founderInsight?.marketReality) items.push(r.founderInsight.marketReality);
  if (r.founderInsight?.possibleGaps) items.push(r.founderInsight.possibleGaps);

  // Market exploit map — where to win
  r.marketExploitMap?.whereToWin?.forEach((w) => items.push(w));

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function generatePrompt(report: MockReportData, blueprint: BlueprintData): string {
  const concept = blueprint.productConcept || report.idea;
  const users = blueprint.targetUsers?.length
    ? blueprint.targetUsers.map((u, i) => `${i + 1}. ${u}`).join("\n")
    : "Not specified";
  const features = blueprint.coreFeatures?.length
    ? blueprint.coreFeatures.map((f, i) => `${i + 1}. ${f}`).join("\n")
    : "Not specified";
  const signals = extractSignals(report);
  const weaknesses = extractWeaknesses(report);

  const signalsText = signals.length
    ? signals.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : "No specific signals detected";
  const weaknessesText = weaknesses.length
    ? weaknesses.map((w, i) => `${i + 1}. ${w}`).join("\n")
    : "No major weaknesses identified";

  return `You are an experienced product designer and startup strategist.

Below is a startup concept that has already been analyzed using market signals, developer activity, and user discussions.

Your task is to help refine and improve this idea.

Focus especially on addressing the weaknesses and improvement opportunities identified in the analysis.

---

## Startup Concept
${concept}

## Target Users
${users}

## Core Features
${features}

## Market Signals & Opportunities
${signalsText}

## Issues / Areas for Improvement
${weaknessesText}

---

## Instructions
• Suggest improvements to the concept
• Propose useful features that address the identified gaps
• Address the weaknesses identified in the analysis
• Suggest ways to differentiate the product from existing competitors
• Explore creative directions the product could evolve into`;
}

export const AiExpansionPrompt = ({ report, blueprint }: Props) => {
  const [copied, setCopied] = useState(false);
  const prompt = generatePrompt(report, blueprint);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please select and copy manually.");
    }
  };

  return (
    <Card className="mt-8 border-accent/20">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-foreground">AI Idea Expansion Prompt</h3>
            <p className="text-xs text-muted-foreground">
              Paste into ChatGPT, Claude, Cursor, or any AI tool to continue developing your idea.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 border p-4 max-h-64 overflow-y-auto">
          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {prompt}
          </pre>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5" /> Copied!</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy Prompt</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
