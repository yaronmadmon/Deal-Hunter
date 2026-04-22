import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const plans = [
  {
    traces: 10,
    price: "$9",
    perTrace: "$0.90",
    popular: false,
    priceId: "price_1T8vKjFDYbFzESfWQMsMJQlV",
    features: ["10 skip traces", "Phone numbers + emails", "Mailing address lookup"],
  },
  {
    traces: 25,
    price: "$19",
    perTrace: "$0.76",
    popular: true,
    priceId: "price_1T8vL9FDYbFzESfWzDj8x9HS",
    features: ["25 skip traces", "Phone numbers + emails", "Mailing address lookup", "Best value per trace"],
  },
];

const BuyCredits = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [purchasing, setPurchasing] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  const handlePurchase = async (plan: typeof plans[0]) => {
    if (!user) return;
    setPurchasing(plan.traces);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { priceId: plan.priceId, credits: plan.traces },
      });
      if (error || !data?.url) {
        toast.error("Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span
          className="font-heading text-xl font-bold text-foreground cursor-pointer flex items-center gap-2"
          onClick={() => navigate("/dashboard")}
        >
          <Phone className="w-5 h-5 text-primary" /> Deal Hunter
        </span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-3">Add Skip Trace Credits</h1>
        <p className="text-muted-foreground mb-10">
          Each credit reveals the owner's phone numbers, emails, and mailing address for one property.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {plans.map((plan) => (
            <Card key={plan.traces} className={`relative ${plan.popular ? "border-primary border-2" : ""}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Best Value
                  </span>
                </div>
              )}
              <CardContent className="p-8 pt-10">
                <div className="font-heading text-4xl font-bold text-foreground mb-1">{plan.price}</div>
                <div className="text-muted-foreground text-sm mb-4">
                  {plan.traces} skip traces • {plan.perTrace}/each
                </div>
                <ul className="text-sm text-left space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className="w-full"
                  onClick={() => handlePurchase(plan)}
                  disabled={purchasing !== null}
                >
                  {purchasing === plan.traces ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                  ) : (
                    `Buy ${plan.traces} Skip Traces`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          Credits never expire. Data powered by Tracerfy — up to 8 phone numbers and 5 emails per owner.
        </p>
      </main>
    </div>
  );
};

export default BuyCredits;
