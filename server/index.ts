import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import fileUpload from "express-fileupload";

const app = express();

// First, check environment variables
function checkRequiredEnvVars() {
  const required = [
    "DATABASE_URL",
    "ANTHROPIC_API_KEY"
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  log("All required environment variables are present");
  return true;
}

// Initialize database connection
async function initializeDatabase() {
  try {
    console.log("Attempting database connection...");
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
    log("Starting server initialization...");
    
    // 1. Check environment variables
    checkRequiredEnvVars();

    // 2. Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      throw new Error("Failed to initialize database");
    }

    // 3. Configure basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 4. Configure file upload middleware
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

    // 5. Request logging middleware
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

    // 6. Create HTTP server and register routes
    const server = registerRoutes(app);

    // 7. Error handling middleware (must be after routes)
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

    // 8. Setup Vite in development mode or serve static files in production
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // 9. Start the server
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
