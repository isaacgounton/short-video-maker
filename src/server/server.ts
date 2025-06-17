import http from "http";
import express from "express";
import session from "express-session";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import path from "path";
import fs from "fs-extra";
import os from "os";
import { ShortCreator } from "../short-creator/ShortCreator";
import { APIRouter } from "./routers/rest";
import { MCPRouter } from "./routers/mcp";
import { AuthRouter } from "./routers/auth";
import { requireAuth, redirectIfNotAuthenticated } from "./middleware/auth";
import { logger } from "../logger";
import { Config } from "../config";

// Simple file-based session store for production use
class FileSessionStore extends session.Store {
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    super();
    this.sessionsDir = sessionsDir;
    fs.ensureDirSync(this.sessionsDir);
    
    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void): void {
    const sessionPath = path.join(this.sessionsDir, `${sid}.json`);
    
    fs.readFile(sessionPath, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return callback(null, null);
        }
        return callback(err);
      }
      
      try {
        const sessionData = JSON.parse(data);
        
        // Check if session has expired
        if (sessionData.expires && new Date(sessionData.expires) < new Date()) {
          this.destroy(sid, () => {});
          return callback(null, null);
        }
        
        callback(null, sessionData.data);
      } catch (parseErr) {
        callback(parseErr);
      }
    });
  }

  set(sid: string, session: session.SessionData, callback?: (err?: any) => void): void {
    const sessionPath = path.join(this.sessionsDir, `${sid}.json`);
    const expires = session.cookie?.expires || new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const sessionFile = {
      data: session,
      expires: expires
    };

    fs.writeFile(sessionPath, JSON.stringify(sessionFile), 'utf8', (err) => {
      if (callback) callback(err);
    });
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    const sessionPath = path.join(this.sessionsDir, `${sid}.json`);
    
    fs.unlink(sessionPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        if (callback) callback(err);
        return;
      }
      if (callback) callback();
    });
  }

  private cleanupExpiredSessions(): void {
    fs.readdir(this.sessionsDir, (err, files) => {
      if (err) {
        logger.warn(err, 'Failed to read sessions directory for cleanup');
        return;
      }

      files.forEach(file => {
        if (file.endsWith('.json')) {
          const sessionPath = path.join(this.sessionsDir, file);
          
          fs.readFile(sessionPath, 'utf8', (readErr, data) => {
            if (readErr) return;
            
            try {
              const sessionData = JSON.parse(data);
              if (sessionData.expires && new Date(sessionData.expires) < new Date()) {
                fs.unlink(sessionPath, () => {});
              }
            } catch (parseErr) {
              // Invalid session file, remove it
              fs.unlink(sessionPath, () => {});
            }
          });
        }
      });
    });
  }
}

export class Server {
  private app: express.Application;
  private config: Config;

  constructor(config: Config, shortCreator: ShortCreator) {
    this.config = config;
    this.app = express();

    // Create sessions directory
    const sessionsDir = path.join(config.tempDirPath, '..', 'sessions');
    const sessionStore = new FileSessionStore(sessionsDir);

    // Configure session middleware with file-based store
    this.app.use(session({
      store: sessionStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to true if using HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // add healthcheck endpoint (no auth required)
    this.app.get("/health", (req: ExpressRequest, res: ExpressResponse) => {
      res.status(200).json({ status: "ok" });
    });

    // Authentication routes (no auth required)
    const authRouter = new AuthRouter(config);
    this.app.use("/auth", authRouter.router);

    // Protected API routes
    const apiRouter = new APIRouter(config, shortCreator);
    const mcpRouter = new MCPRouter(shortCreator);
    this.app.use("/api", requireAuth, apiRouter.router);
    this.app.use("/mcp", requireAuth, mcpRouter.router);

    // Serve static files from the UI build (no auth required for assets)
    this.app.use("/static", express.static(path.join(__dirname, "../../static")));

    // Serve temporary files without authentication (needed for transcription service)
    this.app.get("/tmp/:tmpFile", (req: ExpressRequest, res: ExpressResponse) => {
      const { tmpFile } = req.params;
      if (!tmpFile) {
        res.status(400).json({
          error: "tmpFile is required",
        });
        return;
      }
      const tmpFilePath = path.join(config.tempDirPath, tmpFile);
      if (!fs.existsSync(tmpFilePath)) {
        res.status(404).json({
          error: "tmpFile not found",
        });
        return;
      }

      if (tmpFile.endsWith(".mp3")) {
        res.setHeader("Content-Type", "audio/mpeg");
      }
      if (tmpFile.endsWith(".wav")) {
        res.setHeader("Content-Type", "audio/wav");
      }
      if (tmpFile.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
      }

      const tmpFileStream = fs.createReadStream(tmpFilePath);
      tmpFileStream.on("error", (error: Error) => {
        logger.error(error, "Error reading tmp file");
        res.status(500).json({
          error: "Error reading tmp file",
          tmpFile,
        });
      });
      tmpFileStream.pipe(res);
    });

    // Serve music files without authentication (needed for Remotion rendering)
    this.app.get("/music/:fileName", (req: ExpressRequest, res: ExpressResponse) => {
      const { fileName } = req.params;
      if (!fileName) {
        res.status(400).json({
          error: "fileName is required",
        });
        return;
      }
      const musicFilePath = path.join(config.musicDirPath, fileName);
      if (!fs.existsSync(musicFilePath)) {
        res.status(404).json({
          error: "music file not found",
        });
        return;
      }

      res.setHeader("Content-Type", "audio/mpeg");
      
      const musicFileStream = fs.createReadStream(musicFilePath);
      musicFileStream.on("error", (error: Error) => {
        logger.error(error, "Error reading music file");
        res.status(500).json({
          error: "Error reading music file",
          fileName,
        });
      });
      musicFileStream.pipe(res);
    });

    // Serve the React app for all other routes with authentication check
    this.app.use(express.static(path.join(__dirname, "../../dist/ui")));
    
    // Allow unauthenticated access to login page
    this.app.get("/login", (req: ExpressRequest, res: ExpressResponse) => {
      res.sendFile(path.join(__dirname, "../../dist/ui/index.html"));
    });
    
    // Protect all other routes
    this.app.get("*", redirectIfNotAuthenticated, (req: ExpressRequest, res: ExpressResponse) => {
      res.sendFile(path.join(__dirname, "../../dist/ui/index.html"));
    });
  }

  public start(): http.Server {
    const server = this.app.listen(this.config.port, () => {
      logger.info(
        { port: this.config.port, mcp: "/mcp", api: "/api" },
        "MCP and API server is running",
      );
      logger.info(
        `UI server is running on http://localhost:${this.config.port}`,
      );
    });

    server.on("error", (error: Error) => {
      logger.error(error, "Error starting server");
    });

    return server;
  }

  public getApp() {
    return this.app;
  }
}
