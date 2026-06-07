import { QdrantClient } from "@qdrant/js-client-rest";

let client: QdrantClient | null = null;

export function getQdrant(): QdrantClient {
  if (client) return client;

  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url) throw new Error("QDRANT_URL is not defined in environment");

  client = new QdrantClient({
    url,
    apiKey: apiKey || undefined,
  });

  console.log("Qdrant client initialized");
  return client;
}

export async function verifyQdrant(): Promise<void> {
  try {
    const qdrant = getQdrant();
    await qdrant.getCollections();
    console.log("Qdrant connected successfully");
  } catch (error) {
    console.error("Qdrant connection failed:", error);
  }
}
