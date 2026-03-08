import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

const plans = [
  { credits: 5, price: "$9", perCredit: "$1.80", popular: false },
  { credits: 20, price: "$29", perCredit: "$1.45", popular: true },
];

const BuyCredits = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="font-heading text-xl font-bold text-foreground cursor-pointer" onClick={() => navigate("/dashboard")}>
          ⛏️ Gold Rush
        </span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-3">Buy Credits</h1>
        <p className="text-muted-foreground mb-10">Each credit = one idea validation with full market analysis.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {plans.map((plan) => (
            <Card key={plan.credits} className={`relative ${plan.popular ? "border-primary border-2" : ""}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Best Value</span>
                </div>
              )}
              <CardContent className="p-8 pt-10">
                <div className="font-heading text-4xl font-bold text-foreground mb-1">{plan.price}</div>
                <div className="text-muted-foreground text-sm mb-4">{plan.credits} credits • {plan.perCredit}/each</div>
                <ul className="text-sm text-left space-y-2 mb-6">
                  {["Full market analysis", "Reddit + App Store + Trends", "Downloadable PDF report"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.popular ? "hero" : "outline"} className="w-full">
                  Buy {plan.credits} Credits
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default BuyCredits;
