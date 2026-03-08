import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Coins } from "lucide-react";

const mockHistory = [
  { id: "1", idea: "AI Note Taking App for Students", status: "complete", verdict: "PIVOT", score: 71, created_at: "2026-03-06" },
  { id: "2", idea: "Meal Prep Subscription for Busy Parents", status: "complete", verdict: "GO", score: 82, created_at: "2026-03-04" },
];

const Dashboard = () => {
  const [idea, setIdea] = useState("");
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (idea.length < 20) return;
    // TODO: create analysis row and call pipeline
    navigate("/processing/demo");
  };

  const verdictVariant = (v: string) => {
    if (v === "GO") return "go" as const;
    if (v === "PIVOT") return "pivot" as const;
    return "nogo" as const;
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="font-heading text-xl font-bold text-foreground">⛏️ Gold Rush</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-card border rounded-full px-3 py-1.5 text-sm">
            <Coins className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">2</span>
            <span className="text-muted-foreground">credits</span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Validate an Idea</h1>
        <p className="text-muted-foreground mb-8">Describe your startup idea and we'll analyze real market data.</p>

        <Card className="mb-10">
          <CardContent className="p-6">
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe your startup or app idea (20–500 characters)..."
              className="min-h-[120px] resize-none mb-4"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{idea.length}/500</span>
              <Button variant="hero" onClick={handleSubmit} disabled={idea.length < 20}>
                Validate Idea
                <ArrowRight className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {mockHistory.length > 0 && (
          <>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Previous Analyses</h2>
            <div className="space-y-3">
              {mockHistory.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => navigate(`/report/${item.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.idea}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.created_at}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-heading text-lg font-bold text-foreground">{item.score}</span>
                      <Badge variant={verdictVariant(item.verdict)}>{item.verdict}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
