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
    console.log("Received analysis request");
    
    if (!req.files || !req.files.image) {
      console.log("No image found in request");
      return res.status(400).json({ error: "No image provided" });
    }

    const image = req.files.image as UploadedFile;
    console.log("Processing image:", { 
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

    // Convert image to base64
    const base64Image = Buffer.from(image.data).toString('base64');
    console.log("Image converted to base64, length:", base64Image.length);
      
    if (!base64Image || base64Image.length === 0) {
      console.error("Base64 conversion failed - empty result");
      return res.status(400).json({ error: "Failed to process image" });
    }
      
    // Validate mime type more strictly
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validMimeTypes.includes(image.mimetype)) {
      console.error("Invalid mime type:", image.mimetype);
      return res.status(400).json({ 
        error: "Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image." 
      });
    }

    // Analyze image with Anthropic
    console.log("Sending request to Anthropic API...");
    console.log("Preparing Anthropic API request with image type:", image.mimetype);
    
    const message = {
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
    };
    
    console.log("Sending request to Anthropic API with content types:", 
      message.messages[0].content.map(c => c.type));
    
    const response = await anthropic.messages.create(message);

    console.log("Received response from Anthropic API");

    if (!response.content || response.content.length === 0) {
      throw new Error("Empty response from Anthropic API");
    }

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

    res.json({
      id: 'temp-' + Date.now(),
      result: analysisResult.result,
      confidence: analysisResult.confidence,
      explanation: analysisResult.explanation,
      imageUrl: `data:${image.mimetype};base64,${base64Image}`,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Check if it's an Anthropic API error
    if ((error as any)?.status === 400) {
      return res.status(400).json({ 
        error: "Invalid image format or content. Please try a different image."
      });
    }
    
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

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