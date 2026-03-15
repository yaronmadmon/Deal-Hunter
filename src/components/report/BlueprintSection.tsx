import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Package, Target, Users, DollarSign, ListChecks, Lightbulb, Download, Shield, FileText, Cpu, Rocket, ShieldAlert, CheckCircle, UserCheck, BadgeDollarSign, Loader2, Clock, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBlueprintPdf, type BlueprintPdfContext } from "@/lib/generateBlueprintPdf";
import type { BlueprintData, MockReportData } from "@/data/mockReport";
import { AiExpansionPrompt } from "./AiExpansionPrompt";

interface BuildComplexityData {
  mvpTimeline?: string;
  estimatedCost?: string;
  mvpScope?: string[];
  techChallenges?: string[];
  voiceApiCosts?: string;
  onDeviceNote?: string;
}

interface Props {
  blueprint: BlueprintData;
  analysisId?: string;
  idea?: string;
  pdfContext?: BlueprintPdfContext;
  buildComplexity?: BuildComplexityData;
  report?: MockReportData;
}

const sections = [
  { key: "reportSummary", title: "Report-Linked Summary", icon: FileText, iconColor: "text-blue-500 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  { key: "productConcept", title: "Product Concept", icon: Package, iconColor: "text-purple-500 dark:text-purple-400", bgColor: "bg-purple-500/10" },
  { key: "strategicPositioning", title: "Strategic Positioning", icon: Target, iconColor: "text-teal", bgColor: "bg-teal/10" },
  { key: "competitiveEdge", title: "Competitive Edge", icon: Shield, iconColor: "text-green-500 dark:text-green-400", bgColor: "bg-green-500/10" },
  { key: "coreFeatures", title: "Sentiment-Driven Features", icon: Lightbulb, iconColor: "text-primary", bgColor: "bg-primary/10" },
  { key: "targetUsers", title: "Target Users", icon: Users, iconColor: "text-blue-500 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  { key: "primaryLaunchSegment", title: "Primary Launch Segment", icon: UserCheck, iconColor: "text-teal", bgColor: "bg-teal/10" },
  { key: "monetization", title: "Monetization Strategy", icon: DollarSign, iconColor: "text-green-500 dark:text-green-400", bgColor: "bg-green-500/10" },
  { key: "monetizationValidation", title: "Monetization Validation Plan", icon: BadgeDollarSign, iconColor: "text-purple-500 dark:text-purple-400", bgColor: "bg-purple-500/10" },
  { key: "mvpPlan", title: "MVP Timeline (Realistic)", icon: ListChecks, iconColor: "text-primary", bgColor: "bg-primary/10" },
  { key: "techStack", title: "Technical Architecture", icon: Cpu, iconColor: "text-blue-500 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  { key: "techTradeoffs", title: "Technical Tradeoffs & Honest Calls", icon: ShieldAlert, iconColor: "text-destructive", bgColor: "bg-destructive/10" },
  { key: "goToMarket", title: "Go-to-Market Plan", icon: Rocket, iconColor: "text-green-500 dark:text-green-400", bgColor: "bg-green-500/10" },
  { key: "competitiveResponse", title: "Competitive Response Scenario", icon: Shield, iconColor: "text-purple-500 dark:text-purple-400", bgColor: "bg-purple-500/10" },
  { key: "validationMilestones", title: "Validation Checkpoints", icon: CheckCircle, iconColor: "text-teal", bgColor: "bg-teal/10" },
] as const;

export const BlueprintSection = ({ blueprint: initialBlueprint, analysisId, idea = "Startup Idea", pdfContext, buildComplexity, report }: Props) => {
  // Auto-show if blueprint has real generated content (saved from a previous generation)
  const hasSavedBlueprint = !!(initialBlueprint?.reportSummary || initialBlueprint?.productConcept);
  const [isVisible, setIsVisible] = useState(hasSavedBlueprint);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<BlueprintData>(initialBlueprint);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      if (analysisId) {
        const { data, error } = await supabase.functions.invoke("generate-blueprint", {
          body: { analysisId },
        });
        if (error) throw error;
        if (data?.blueprint) {
          setBlueprint(data.blueprint);
        }
      }
      setIsVisible(true);
    } catch (err) {
      toast.error("Failed to generate blueprint. Using template.");
      setIsVisible(true);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isVisible) {
    return (
      <div className="text-center py-10">
        <Button
          variant="default"
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <Sparkles className="mr-2 w-5 h-5" />
          {isGenerating ? "Generating Blueprint…" : "Generate Blueprint"}
        </Button>
        <p className="text-[13px] text-muted-foreground mt-3">
          Uses AI to create a startup blueprint from your market analysis.
        </p>
      </div>
    );
  }

  // Render MVP phasing as a special section if present
  const renderPhasing = () => {
    if (!blueprint.mvpPhasing) return null;
    return (
      <Card className="md:col-span-2">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ListChecks className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-foreground">MVP vs Phase 2 Phasing</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" /> MVP (Launch)
              </h4>
              <ul className="space-y-1.5">
                {blueprint.mvpPhasing.mvp.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5 font-bold">{i + 1}.</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" /> Phase 2 (Post-Launch)
              </h4>
              <ul className="space-y-1.5">
                {blueprint.mvpPhasing.phase2.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-accent mt-0.5 font-bold">{i + 1}.</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div id="blueprint-content" className="mt-10">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold text-foreground">Startup Blueprint</h2>
        <p className="text-sm text-muted-foreground mt-1">Dynamically generated from your market analysis report.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sections.map(({ key, title, icon: Icon, iconColor, bgColor }) => {
          const value = (blueprint as any)[key];
          if (!value || (Array.isArray(value) && value.length === 0)) return null;

          const isFullWidth = ["reportSummary", "productConcept", "strategicPositioning", "primaryLaunchSegment", "goToMarket", "competitiveResponse"].includes(key);

          return (
            <Card key={key} className={`${isFullWidth ? "md:col-span-2" : ""} hover:shadow-md transition-shadow duration-200`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground">{title}</h3>
                </div>
                {typeof value === "string" ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{value}</p>
                ) : (
                  <ul className="space-y-2">
                    {(value as string[]).map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className={`${iconColor} mt-0.5 font-bold`}>{i + 1}.</span> {item}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
        {renderPhasing()}
      </div>

      {/* Build Complexity Cost Estimates */}
      {buildComplexity && (buildComplexity.estimatedCost || buildComplexity.mvpTimeline) && (
        <Card className="md:col-span-2 mt-5 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Banknote className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-foreground">Build Cost Estimates</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {buildComplexity.mvpTimeline && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                  <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">MVP Timeline</p>
                    <p className="text-sm font-semibold text-foreground">{buildComplexity.mvpTimeline}</p>
                  </div>
                </div>
              )}
              {buildComplexity.estimatedCost && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                  <Banknote className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Cost Range</p>
                    <p className="text-sm font-semibold text-foreground">{buildComplexity.estimatedCost}</p>
                  </div>
                </div>
              )}
              {buildComplexity.voiceApiCosts && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background border sm:col-span-2">
                  <DollarSign className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">API / Infrastructure Costs</p>
                    <p className="text-sm font-semibold text-foreground">{buildComplexity.voiceApiCosts}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center mt-8">
        <Button variant="default" size="lg" disabled={pdfGenerating} onClick={async () => {
          setPdfGenerating(true);
          try {
            toast.info("Generating Blueprint PDF...");
            await new Promise(resolve => setTimeout(resolve, 50));
            generateBlueprintPdf(blueprint, idea, pdfContext);
            toast.success("Blueprint PDF downloaded!");
          } catch (err) {
            console.error("Blueprint PDF generation failed:", err);
            toast.error("PDF generation failed. Please try again or use a desktop browser.");
          } finally {
            setPdfGenerating(false);
          }
        }}>
          {pdfGenerating ? (
            <><Loader2 className="mr-1 w-4 h-4 animate-spin" /> Generating…</>
          ) : (
            <><Download className="mr-1" /> Download Blueprint PDF</>
          )}
        </Button>
      </div>

      <p className="text-[13px] text-muted-foreground text-center mt-4 max-w-lg mx-auto">
        This blueprint is generated from market signals and competitive analysis.
        It is intended to guide product development decisions.
      </p>

      {report && <AiExpansionPrompt report={report} blueprint={blueprint} />}
    </div>
  );
};