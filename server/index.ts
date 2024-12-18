import express, { type Request, Response, NextFunction } from "express";
import fileUpload from "express-fileupload";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";

// Initialize express app
const app = express();

// Basic express configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure file upload middleware
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  useTempFiles: false,
  createParentPath: true,
  debug: process.env.NODE_ENV === 'development',
  safeFileNames: true,
  preserveExtension: true,
  abortOnLimit: true,
  responseOnLimit: "File size limit has been reached (5MB)",
  uploadTimeout: 30000,
}));

// Function to verify required environment variables
function checkRequiredEnvVars() {
  const required = [
    "DATABASE_URL",
    "ANTHROPIC_API_KEY"
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Environment variables missing:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  log("All required environment variables are present");
  return true;
}

async function initializeDatabase() {
  try {
    console.log("Attempting database connection...");
    // Test database connection with a simple query
    const result = await db.query.analyses.findMany({
      limit: 1
    });
    log("Database connection successful");
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Database initialization error:", errorMessage);
    if (errorMessage.includes("relation \"analyses\" does not exist")) {
      console.log("Database tables not found, this is expected on first run");
      return true;
    }
    return false;
  }
}

async function startServer() {
  try {
    // Verify environment variables before starting the server
    checkRequiredEnvVars();

    // Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      throw new Error("Failed to initialize database");
    }

    // Initialize Firebase only if we have the service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      await import("./lib/firebase.js");
      log("Firebase Admin initialized successfully");
    }

    // Essential middleware setup
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Configure file upload middleware with proper error handling
    app.use(fileUpload({
      limits: { 
        fileSize: 5 * 1024 * 1024 // 5MB max file size
      },
      useTempFiles: false,
      createParentPath: true,
      debug: process.env.NODE_ENV === 'development',
      safeFileNames: true,
      preserveExtension: true,
      abortOnLimit: true,
      responseOnLimit: "File size limit has been reached (5MB)",
      uploadTimeout: 30000,
    }));

    // Add error handler specifically for file upload errors
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File is too large. Maximum size is 5MB'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Unexpected file upload'
        });
      }
      next(err);
    });
    
    // Add error handler specifically for file upload errors
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File is too large. Maximum size is 5MB'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Unexpected file upload'
        });
      }
      next(err);
    });

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

    // Create the HTTP server and register routes
    const server = registerRoutes(app);

    // Error handling middleware should be last
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      // Log the full error for debugging
      console.error('Error:', {
        message: err.message,
        stack: err.stack,
        status: err.status || err.statusCode
      });

      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      // Send a sanitized error response
      res.status(status).json({ 
        message,
        status,
        timestamp: new Date().toISOString()
      });
    });

    // Setup Vite in development mode
    if (process.env.NODE_ENV === "development") {
      log("Starting in development mode");
      await setupVite(app, server);
    } else {
      log("Starting in production mode");
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
