import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Package, Target, Users, DollarSign, ListChecks, Lightbulb, Download, Shield, FileText, Cpu, Rocket, ShieldAlert, CheckCircle, UserCheck, BadgeDollarSign, Loader2, Clock, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBlueprintPdf, type BlueprintPdfContext } from "@/lib/generateBlueprintPdf";
import type { BlueprintData } from "@/data/mockReport";

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
}

const sections = [
  { key: "reportSummary", title: "Report-Linked Summary", icon: FileText },
  { key: "productConcept", title: "Product Concept", icon: Package },
  { key: "strategicPositioning", title: "Strategic Positioning", icon: Target },
  { key: "competitiveEdge", title: "Competitive Edge", icon: Shield },
  { key: "coreFeatures", title: "Sentiment-Driven Features", icon: Lightbulb },
  { key: "targetUsers", title: "Target Users", icon: Users },
  { key: "primaryLaunchSegment", title: "Primary Launch Segment", icon: UserCheck },
  { key: "monetization", title: "Monetization Strategy", icon: DollarSign },
  { key: "monetizationValidation", title: "Monetization Validation Plan", icon: BadgeDollarSign },
  { key: "mvpPlan", title: "MVP Timeline (Realistic)", icon: ListChecks },
  { key: "techStack", title: "Technical Architecture", icon: Cpu },
  { key: "techTradeoffs", title: "Technical Tradeoffs & Honest Calls", icon: ShieldAlert },
  { key: "goToMarket", title: "Go-to-Market Plan", icon: Rocket },
  { key: "competitiveResponse", title: "Competitive Response Scenario", icon: Shield },
  { key: "validationMilestones", title: "Validation Checkpoints", icon: CheckCircle },
] as const;

export const BlueprintSection = ({ blueprint: initialBlueprint, analysisId, idea = "Startup Idea", pdfContext, buildComplexity }: Props) => {
  const [isVisible, setIsVisible] = useState(false);
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
        {sections.map(({ key, title, icon: Icon }) => {
          const value = (blueprint as any)[key];
          if (!value || (Array.isArray(value) && value.length === 0)) return null;

          const isFullWidth = ["reportSummary", "productConcept", "strategicPositioning", "primaryLaunchSegment", "goToMarket", "competitiveResponse"].includes(key);

          return (
            <Card key={key} className={isFullWidth ? "md:col-span-2" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground">{title}</h3>
                </div>
                {typeof value === "string" ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{value}</p>
                ) : (
                  <ul className="space-y-2">
                    {(value as string[]).map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5 font-bold">{i + 1}.</span> {item}
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
    </div>
  );
};