import { Router } from "express";
import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import { UploadedFile } from "express-fileupload";
import { createServer, type Server } from "http";
import type { Express } from "express";
import * as fs from 'fs';
import { promisify } from 'util';
import { db } from "@db";
import { analyses } from "@db/schema";
import { eq } from "drizzle-orm";


const router = Router();
const readFile = promisify(fs.readFile);

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required");
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create database tables if they don't exist
db.query.analyses.findMany().catch(() => {
  console.log("Initializing database tables...");
});

// Get analysis history
router.get("/api/analysis/history", async (req: Request, res: Response) => {
  try {
    const results = await db.query.analyses.findMany({
      orderBy: (analyses, { desc }) => [desc(analyses.timestamp)]
    });
    
    res.json(results);
  } catch (error) {
    console.error('Failed to fetch analysis history:', error);
    res.status(500).json({ error: "Failed to fetch analysis history" });
  }
});

router.post("/api/analysis", async (req: Request, res: Response) => {
  try {
    console.log("Received analysis request");
    
    if (!req.files || !req.files.image) {
      console.log("No image file received");
      return res.status(400).json({ error: "No image file received" });
    }

    const image = req.files.image as UploadedFile;
    console.log("Received file:", {
      name: image.name,
      type: image.mimetype,
      size: image.size
    });

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(image.mimetype)) {
      console.log("Invalid file type:", image.mimetype);
      return res.status(400).json({ 
        error: `Invalid file type. Supported types: ${validTypes.join(", ")}` 
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (image.size > maxSize) {
      console.log("File too large:", image.size);
      return res.status(400).json({ 
        error: "File too large. Maximum size is 5MB" 
      });
    }

    // Convert image to base64
    let base64Image: string;
    try {
      if (image.tempFilePath) {
        const imageBuffer = await readFile(image.tempFilePath);
        base64Image = imageBuffer.toString('base64');
      } else if (Buffer.isBuffer(image.data)) {
        base64Image = image.data.toString('base64');
      } else {
        throw new Error("Invalid image data format");
      }

      console.log("Image converted to base64, length:", base64Image.length);

      // the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
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
                media_type: image.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64Image
              }
            }
          ]
        }]
      });

      console.log("Anthropic API response received");

      if (!response.content || response.content.length === 0) {
        throw new Error("Empty response from Anthropic API");
      }

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
      if (!analysisText) {
        throw new Error("Invalid response format from API");
      }

      console.log("Raw analysis response:", analysisText);

      let analysisResult;
      try {
        analysisResult = JSON.parse(analysisText);
      } catch (error) {
        console.log("Failed to parse API response:", error);
        analysisResult = {
          result: analysisText.includes('Concerning') ? 'Concerning' : 'Normal',
          confidence: 0.95,
          explanation: analysisText
        };
      }

      // Save analysis result to database
      const [savedAnalysis] = await db.insert(analyses)
        .values({
          userId: req.body.userId || 'anonymous', // Handle anonymous users
          imageUrl: `data:${image.mimetype};base64,${base64Image}`,
          result: analysisResult.result,
          confidence: analysisResult.confidence,
          explanation: analysisResult.explanation,
        })
        .returning();

      console.log("Analysis saved to database");
      res.json(savedAnalysis);

    } catch (error) {
      console.error('Image processing error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Analysis error:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ 
        error: error.message || "Failed to process image"
      });
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

export function registerRoutes(app: Express): Server {
  app.use(router);
  return createServer(app);
}
