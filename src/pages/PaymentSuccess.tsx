import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [creditsAdded, setCreditsAdded] = useState(0);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }

    const sessionId = searchParams.get("session_id");
    const credits = searchParams.get("credits");

    if (!sessionId) { setVerifying(false); return; }

    supabase.functions.invoke("verify-payment", {
      body: { sessionId },
    }).then(({ data, error }) => {
      if (data?.success) {
        setSuccess(true);
        setCreditsAdded(data.credits || parseInt(credits || "0", 10));
      }
      setVerifying(false);
    });
  }, [user, loading]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {success ? (
            <>
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Payment Successful!</h1>
              <p className="text-muted-foreground mb-6">
                {creditsAdded} credits have been added to your account.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Payment Issue</h1>
              <p className="text-muted-foreground mb-6">
                We couldn't verify your payment. If you were charged, credits will be added shortly.
              </p>
            </>
          )}
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
