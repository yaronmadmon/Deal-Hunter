import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Package, Target, Users, DollarSign, ListChecks, Lightbulb, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBlueprintPdf } from "@/lib/generateBlueprintPdf";
import type { BlueprintData } from "@/data/mockReport";

interface Props {
  blueprint: BlueprintData;
  analysisId?: string;
  idea?: string;
}

const sections = [
  { key: "productConcept", title: "Product Concept", icon: Package },
  { key: "strategicPositioning", title: "Strategic Positioning", icon: Target },
  { key: "coreFeatures", title: "Core Features", icon: Lightbulb },
  { key: "targetUsers", title: "Target Users", icon: Users },
  { key: "monetization", title: "Monetization Strategy", icon: DollarSign },
  { key: "mvpPlan", title: "MVP Plan", icon: ListChecks },
] as const;

export const BlueprintSection = ({ blueprint: initialBlueprint, analysisId, idea = "Startup Idea" }: Props) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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
        <p className="text-xs text-muted-foreground mt-3">
          Uses AI to create a startup blueprint from your market analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold text-foreground">Startup Blueprint</h2>
        <p className="text-sm text-muted-foreground mt-1">Generated from your market analysis report.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sections.map(({ key, title, icon: Icon }) => {
          const value = blueprint[key];
          return (
            <Card key={key} className={key === "productConcept" || key === "strategicPositioning" ? "md:col-span-2" : ""}>
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
      </div>

      <p className="text-xs text-muted-foreground text-center mt-8 max-w-lg mx-auto">
        This blueprint is generated from market signals and competitive analysis.
        It is intended to guide product development decisions.
      </p>
    </div>
  );
};
