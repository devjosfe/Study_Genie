import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const mongoClient = new MongoClient(process.env.MONGODB_URI!);

export const auth = betterAuth({
  database: mongodbAdapter(mongoClient.db()),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    defaultCookieAttributes: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    },
  },
  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:5173",
  ],
  user: {
    additionalFields: {
      tokenUsageDaily: {
        type: "number",
        defaultValue: 0,
      },
      tokenUsageLastReset: {
        type: "string",
        defaultValue: new Date().toISOString(),
      },
      defaultProvider: {
        type: "string",
        defaultValue: "groq",
      },
      quizDifficulty: {
        type: "string",
        defaultValue: "medium",
      },
    },
  },
});
