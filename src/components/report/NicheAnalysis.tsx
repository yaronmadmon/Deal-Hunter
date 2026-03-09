import { Crosshair, Search, Twitter } from "lucide-react";
import type { NicheAnalysisData } from "@/data/mockReport";
import { DataSourceBadge } from "./DataSourceBadge";

interface Props {
  data: NicheAnalysisData;
}

export const NicheAnalysis = ({ data }: Props) => {
  return (
    <div className="bg-card border rounded-2xl p-8 mb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Crosshair className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Niche Deep Dive</h2>
          <p className="text-xs text-muted-foreground italic">Your specific slice of this market</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* SAM */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Serviceable Market (SAM)</h3>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{data.samEstimate}</p>
          <p className="text-xs text-muted-foreground mb-2">{data.samPercentage} of total market</p>
          <p className="text-sm text-muted-foreground">{data.samReasoning}</p>
        </div>

        {/* Competitor Clarity */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Competitor Positioning</h3>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{data.directCompetitors} direct</p>
          <p className="text-xs text-muted-foreground mb-2">competitors in your exact niche</p>
          <p className="text-sm text-muted-foreground">{data.competitorClarity}</p>
          <p className="text-sm text-muted-foreground mt-2 italic">{data.competitorDetail}</p>
        </div>

        {/* X Signal Context */}
        <div className="bg-secondary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Twitter className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">X Signal Interpretation</h3>
          </div>
          <p className="text-sm text-foreground font-medium mb-2">{data.xSignalInterpretation}</p>
          <p className="text-sm text-muted-foreground">{data.xVolumeContext}</p>
        </div>
      </div>

      {data.dataSource && (
        <div className="mt-4">
          <DataSourceBadge dataSource={data.dataSource} sourceUrls={data.sourceUrls} />
        </div>
      )}
    </div>
  );
};
