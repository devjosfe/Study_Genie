import { Router, type Request, type Response } from "express";
import { Webhooks } from "@polar-sh/express";
import { Polar } from "@polar-sh/sdk";

const router = Router();

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_ENVIRONMENT as "sandbox" | "production") || "sandbox",
});

// POST /api/polar/checkout — Create a checkout session
router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      res.status(400).json({ error: "productId is required" });
      return;
    }

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/checkout/success`,
    });

    res.json({ checkoutUrl: checkout.url });
  } catch (error) {
    console.error("Polar checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

// POST /api/polar/webhooks — Handle Polar webhook events
router.post(
  "/webhooks",
  Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    onPayload: async (payload) => {
      console.log("[Polar webhook]", payload.type);
    },
    onCheckoutUpdated: async (payload) => {
      if (payload.data.status === "succeeded") {
        const customerEmail = payload.data.customerEmail;
        console.log(`[Polar] Checkout succeeded for ${customerEmail}`);
        // TODO: Update user subscription status in DB
      }
    },
    onSubscriptionCreated: async (payload) => {
      const customerId = payload.data.customerId;
      console.log(`[Polar] Subscription created for customer ${customerId}`);
      // TODO: Activate user's pro features
    },
    onSubscriptionUpdated: async (payload) => {
      const status = payload.data.status;
      const customerId = payload.data.customerId;
      console.log(`[Polar] Subscription ${status} for customer ${customerId}`);
      // TODO: Update user's subscription status
    },
  })
);

// GET /api/polar/products — List available products/plans
router.get("/products", async (_req: Request, res: Response) => {
  try {
    const products = await polar.products.list({
      isArchived: false,
    });

    res.json({ products: products.result.items });
  } catch (error) {
    console.error("Polar products error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

export default router;
