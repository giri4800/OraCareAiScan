import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import fileUpload from "express-fileupload";

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure file upload middleware
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  useTempFiles: true,
  tempFileDir: '/tmp/',
  createParentPath: true,
  debug: process.env.NODE_ENV === 'development',
  safeFileNames: true,
  preserveExtension: 4,
  abortOnLimit: true,
  uploadTimeout: 30000
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

async function startServer() {
  try {
    // Check environment variables
    if (!process.env.DATABASE_URL || !process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing required environment variables: DATABASE_URL or ANTHROPIC_API_KEY");
    }

    log("Starting server initialization...");

    // Test database connection
    try {
      await db.query.analyses.findMany({ limit: 1 });
      log("Database connection successful");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("relation \"analyses\" does not exist")) {
        throw new Error("Failed to connect to database: " + errorMessage);
      }
      log("Database tables not found, this is expected on first run");
    }

    // Create HTTP server and register routes
    const server = registerRoutes(app);

    // Error handling middleware (must be last)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', {
        message: err.message,
        stack: err.stack,
        status: err.status || err.statusCode
      });

      // Handle file upload errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File size limit exceeded (max: 5MB)'
        });
      }
      
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Unexpected file upload'
        });
      }

      // Handle other errors
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      res.status(status).json({ 
        error: message,
        timestamp: new Date().toISOString()
      });
    });

    // Setup Vite in development mode or serve static files in production
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Set development mode for Replit environment
process.env.NODE_ENV = "development";

// Start the server
startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});