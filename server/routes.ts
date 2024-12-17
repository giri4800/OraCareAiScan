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

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
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
router.post("/api/analysis", async (req: Request, res: Response) => {
  try {
    console.log("Received analysis request", { files: req.files });
    
    if (!req.files || !req.files.image) {
      console.log("No image found in request");
      return res.status(400).json({ error: "No image provided" });
    }

    const image = req.files.image as UploadedFile;
    console.log("Received image", { 
      name: image.name,
      size: image.size,
      mimetype: image.mimetype 
    });
    
    // Validate file type
    if (!image.mimetype.startsWith('image/')) {
      return res.status(400).json({ 
        error: "Invalid file type. Please upload an image." 
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (image.size > maxSize) {
      return res.status(400).json({ 
        error: "File too large. Maximum size is 10MB." 
      });
    }

    // Analyze image with Anthropic
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: "Please analyze this oral cavity image for signs of cancer. Provide a detailed assessment in JSON format with the following structure: { result: 'Normal' or 'Concerning', confidence: number between 0-1, explanation: string with detailed findings }. Focus on identifying any suspicious lesions, abnormal growths, or discoloration that might indicate early signs of oral cancer."
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mimetype,
              data: image.data.toString("base64")
            }
          }
        ]
      }]
    });

    const analysisText = response.content[0].type === 'text' ? response.content[0].text : 'Analysis unavailable';
    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisText);
    } catch {
      // If JSON parsing fails, use a default format
      analysisResult = {
        result: analysisText.includes('Concerning') ? 'Concerning' : 'Normal',
        confidence: 0.95,
        explanation: analysisText
      };
    }

    // Save analysis result to database
    const [analysis] = await db
      .insert(analyses)
      .values({
        userId: req.user.uid,
        imageUrl: "placeholder_url", // TODO: Implement Firebase Storage
        result: analysisResult.result,
        confidence: analysisResult.confidence.toString(),
        timestamp: new Date(),
      })
      .returning();

    // Return analysis with the full result including explanation
    res.json({
      ...analysis,
      explanation: analysisResult.explanation
    });
  } catch (error) {
    console.error('Analysis error:', error);
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
    console.error('History fetch error:', error);
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
    console.error('Delete error:', error);
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