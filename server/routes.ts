import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { analyses } from "@db/schema";
import { auth } from "./lib/firebase";
import { Anthropic } from "@anthropic-ai/sdk";
import { UploadedFile } from "express-fileupload";
import { and, eq } from "drizzle-orm";
import type { DecodedIdToken } from "firebase-admin/auth";

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

const router = Router();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required");
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware to verify Firebase auth token
const verifyAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) throw new Error("No token provided");
    
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// Upload and analyze image
router.post("/api/analysis", verifyAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.files || !req.files.image) {
      throw new Error("No image provided");
    }

    const image = req.files.image as UploadedFile;
    if (!req.user?.uid) throw new Error("User not authenticated");

    // Analyze image with Anthropic
    const response = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this oral cavity image for signs of cancer. Provide a clear assessment of whether there are any concerning signs that would warrant medical attention. Format your response as: RESULT: (Normal/Concerning) followed by a brief explanation."
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image.data.toString("base64")
              }
            }
          ]
        }]
      });

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : 'Analysis unavailable';
      const result = analysisText.includes('RESULT: Concerning') ? 'Concerning' : 'Normal';
      
      const [analysis] = await db
        .insert(analyses)
        .values({
          userId: req.user.uid,
          imageUrl: "placeholder_url", // TODO: Implement Firebase Storage
          result: result,
          confidence: "0.95", // Store as string since it's a decimal in the schema
          timestamp: new Date(),
        })
        .returning();

    res.json(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Get analysis history
router.get("/api/analysis/history", verifyAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.uid) throw new Error("User not authenticated");
    
    const history = await db.query.analyses.findMany({
      where: eq(analyses.userId, req.user.uid),
      orderBy: [analyses.timestamp],
    });
    
    res.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Delete analysis
router.delete("/api/analysis/:id", verifyAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.uid) throw new Error("User not authenticated");
    
    await db.delete(analyses).where(
      and(
        eq(analyses.id, req.params.id),
        eq(analyses.userId, req.user.uid)
      )
    );
    
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

import type { Express } from "express";
import type { Server } from "http";
import { createServer } from "http";

export function registerRoutes(app: Express): Server {
  // Apply the router middleware
  app.use(router);
  
  // Create and return the HTTP server
  const server = createServer(app);
  
  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    const protocol = request.headers['sec-websocket-protocol'];
    if (protocol === 'vite-hmr') {
      return;
    }
    // Add any additional WebSocket handling here if needed
  });
  
  return server;
}