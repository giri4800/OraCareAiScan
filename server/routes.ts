import { Router } from "express";
import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import { UploadedFile } from "express-fileupload";
import { createServer, type Server } from "http";
import type { Express } from "express";

const router = Router();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required");
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Upload and analyze image
router.post("/api/analysis", async (req: Request, res: Response) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log("No files were uploaded");
      return res.status(400).json({ error: "No files were uploaded" });
    }

    const image = req.files.image as UploadedFile;
    
    // Validate file type
    if (!image.mimetype.startsWith('image/')) {
      console.log("Invalid file type:", image.mimetype);
      return res.status(400).json({ error: "Invalid file type. Please upload an image." });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (image.size > maxSize) {
      console.log("File too large:", image.size);
      return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
    }

    console.log("Processing image:", {
      name: image.name,
      type: image.mimetype,
      size: image.size
    });

    // Convert image to base64
    const base64Image = image.data.toString('base64');
    
    if (!base64Image) {
      console.log("Failed to convert image to base64");
      return res.status(400).json({ error: "Failed to process image" });
    }

    console.log("Image converted to base64 successfully");

    // Send to Anthropic API
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
              data: base64Image
            }
          }
        ]
      }]
    });

    if (!response.content || response.content.length === 0) {
      console.log("Empty response from Anthropic API");
      throw new Error("Empty response from Anthropic API");
    }

    const analysisText = response.content[0].type === 'text' ? response.content[0].text : null;
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

    const result = {
      id: 'temp-' + Date.now(),
      result: analysisResult.result,
      confidence: analysisResult.confidence,
      explanation: analysisResult.explanation,
      imageUrl: `data:${image.mimetype};base64,${base64Image}`,
      timestamp: new Date()
    };

    console.log("Sending analysis result");
    res.json(result);

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