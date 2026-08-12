import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBillingOverview } from "@/hooks/billing/use-billing";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Landing page after returning from Stripe/PayPal.
 *
 * The redirect only tells us the user *finished the flow* — it is NOT proof of payment, and is
 * trivially forged by visiting the URL directly. Activation happens exclusively in the webhook, so
 * this page polls our own API until the subscription actually reports as active, and says so
 * honestly while it waits.
 */
export default function CheckoutResultPage() {
  const { outcome } = useParams<{ outcome: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const success = outcome === "success";

  const { data: overview } = useBillingOverview(success);
  const [waited, setWaited] = React.useState(0);

  const confirmed = !!overview?.subscription?.grantsAccess && overview.hasProductAccess;

  // Webhooks usually land within a couple of seconds, but can lag. Poll briefly, then stop
  // and reassure rather than spinning forever.
  React.useEffect(() => {
    if (!success || confirmed || waited >= 20) return;
    const t = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      setWaited(w => w + 2);
    }, 2000);
    return () => clearTimeout(t);
  }, [success, confirmed, waited, qc]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card>
          <CardContent className="p-8 text-center">
            {!success ? (
              <>
                <XCircle className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
                <h1 className="text-xl font-bold mb-1.5">Checkout cancelled</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  No payment was taken and nothing changed. You can pick a plan whenever you're ready.
                </p>
              </>
            ) : confirmed ? (
              <>
                <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500 mb-4" />
                <h1 className="text-xl font-bold mb-1.5">You're all set</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  Your <span className="font-medium text-foreground">{overview?.planLabel}</span> subscription
                  is active. A receipt is on its way to your inbox.
                </p>
              </>
            ) : (
              <>
                <Loader2 className="h-14 w-14 mx-auto text-primary mb-4 animate-spin" />
                <h1 className="text-xl font-bold mb-1.5">Confirming your payment…</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  {waited < 20
                    ? "This usually takes a few seconds."
                    : "Your payment provider is taking longer than usual to confirm. Your payment is safe — this page will update on its own, and you can also check back shortly."}
                </p>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={() => navigate("/settings/billing")} variant={success && confirmed ? "outline" : "default"}>
                Go to billing
              </Button>
              {success && confirmed && (
                <Button onClick={() => navigate("/dashboard")}>
                  Continue to dashboard <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
