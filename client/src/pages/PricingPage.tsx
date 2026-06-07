import { useState } from "react";
import { motion } from "motion/react";
import { Check, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with the basics",
    features: [
      "5 document uploads",
      "20 AI chat queries / day",
      "Basic quiz generation",
      "1 mock interview / day",
      "Community support",
    ],
    cta: "Current Plan",
    disabled: true,
    gradient: "from-gray-500 to-gray-600",
  },
  {
    name: "Pro",
    price: "$9",
    period: "/ month",
    description: "Unlimited learning, unlimited growth",
    features: [
      "Unlimited document uploads",
      "Unlimited AI chat queries",
      "Advanced quiz with LLM-as-judge",
      "Unlimited mock interviews",
      "Priority streaming (faster responses)",
      "Detailed analytics dashboard",
      "Export quiz results as PDF",
    ],
    cta: "Upgrade to Pro",
    disabled: false,
    popular: true,
    gradient: "from-chart-3 to-chart-1",
    productId: import.meta.env.VITE_POLAR_PRO_PRODUCT_ID,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(productId?: string) {
    if (!productId) return;
    setLoading(productId);
    try {
      const data = await api<{ checkoutUrl: string }>("/polar/checkout", {
        method: "POST",
        body: JSON.stringify({ productId }),
      });
      window.location.href = data.checkoutUrl;
    } catch (error) {
      toast.error("Checkout failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Simple, transparent{" "}
            <span className="bg-gradient-to-r from-chart-3 to-chart-1 bg-clip-text text-transparent">
              pricing
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Start free, upgrade when you need more. No hidden fees, cancel anytime.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card
                className={`relative h-full ${
                  plan.popular
                    ? "border-chart-3/50 shadow-lg shadow-chart-3/5"
                    : "border-border/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-chart-3 to-chart-1 px-3 py-1 text-xs font-medium text-white">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-chart-3 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${plan.popular ? "bg-gradient-to-r from-chart-3 to-chart-1 text-white hover:opacity-90" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    disabled={plan.disabled || loading === plan.productId}
                    onClick={() => handleCheckout(plan.productId)}
                  >
                    {loading === plan.productId ? (
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4 animate-pulse" />
                        Redirecting...
                      </span>
                    ) : (
                      plan.cta
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-sm text-muted-foreground/60 mt-8"
        >
          Payments processed securely by Polar. Cancel anytime from your account settings.
        </motion.p>
      </div>
    </div>
  );
}
