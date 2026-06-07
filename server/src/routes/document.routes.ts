import { Router, type Request, type Response } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "../middleware/auth.js";
import { DocumentModel } from "../models/Document.js";
import { getQdrant } from "../config/qdrant.js";
import { chunkText } from "../rag/chunker.js";
import { embedMany } from "../services/embedding.service.js";

const router = Router();

// Multer config — store in memory, max 10MB, allowed file types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    const allowedExts = [".pdf", ".txt", ".md"];
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, TXT, and MD files are supported"));
    }
  },
});

// Collection name per user — isolates vectors
function collectionName(userId: string): string {
  return `user_${userId}_docs`;
}

// Ensure Qdrant collection exists for the user
async function ensureCollection(userId: string): Promise<void> {
  const qdrant = getQdrant();
  const name = collectionName(userId);

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === name);

  if (!exists) {
    await qdrant.createCollection(name, {
      vectors: { size: 3072, distance: "Cosine" },
    });
    // Index documentId for filtered search (required by Qdrant Cloud strict mode)
    await qdrant.createPayloadIndex(name, {
      field_name: "documentId",
      field_schema: "keyword",
    });
    console.log(`Created Qdrant collection: ${name}`);
  }
}

// Multer error handler wrapper
function handleUpload(req: Request, res: Response, next: () => void) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File too large. Maximum size is 10MB." });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}

// POST /api/documents/upload — Upload and process a document
router.post("/upload", authenticate, handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const userId = req.userId!;
    const file = req.file;

    // Extract text based on file extension (MIME types vary across devices)
    let textContent: string;
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    if (ext === ".pdf") {
      const pdfData = await pdfParse(file.buffer);
      textContent = pdfData.text;
    } else {
      // TXT or MD — buffer is already text
      textContent = file.buffer.toString("utf-8");
    }

    if (!textContent.trim()) {
      res.status(400).json({ error: "Could not extract text from file" });
      return;
    }

    // Save document to MongoDB (status: processing)
    const doc = await DocumentModel.create({
      userId,
      filename: `${uuidv4()}-${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      originalSize: file.size,
      textContent,
      status: "processing",
    });

    // Chunk the text
    const chunks = chunkText(textContent);

    // Embed all chunks
    const embeddings = await embedMany(chunks.map((c) => c.text));

    // Ensure Qdrant collection exists, then upsert vectors
    await ensureCollection(userId);
    const qdrant = getQdrant();

    await qdrant.upsert(collectionName(userId), {
      points: chunks.map((chunk, i) => ({
        id: chunk.id,
        vector: embeddings[i],
        payload: {
          text: chunk.text,
          documentId: doc._id!.toString(),
          filename: file.originalname,
          chunkIndex: chunk.index,
        },
      })),
    });

    // Update document status
    doc.chunkCount = chunks.length;
    doc.status = "ready";
    await doc.save();

    res.status(201).json({
      id: doc._id,
      filename: doc.originalName,
      chunkCount: chunks.length,
      size: doc.originalSize,
      status: "ready",
    });
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({ error: "Failed to process document" });
  }
});

// GET /api/documents — List user's documents
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const documents = await DocumentModel.find({ userId: req.userId })
      .select("-textContent")
      .sort({ uploadedAt: -1 });

    res.json(documents);
  } catch (error) {
    console.error("List documents error:", error);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

// DELETE /api/documents/:id — Delete a document and its vectors
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const doc = await DocumentModel.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Delete vectors from Qdrant that belong to this document
    const qdrant = getQdrant();
    const name = collectionName(req.userId!);

    try {
      await qdrant.delete(name, {
        filter: {
          must: [{ key: "documentId", match: { value: doc._id!.toString() } }],
        },
      });
    } catch {
      // Collection might not exist if upload failed midway — safe to ignore
    }

    await doc.deleteOne();

    res.json({ message: "Document deleted" });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
