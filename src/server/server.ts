import http from "http";
import express from "express";
import session from "express-session";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import path from "path";
import { ShortCreator } from "../short-creator/ShortCreator";
import { APIRouter } from "./routers/rest";
import { MCPRouter } from "./routers/mcp";
import { AuthRouter } from "./routers/auth";
import { requireAuth, redirectIfNotAuthenticated } from "./middleware/auth";
import { logger } from "../logger";
import { Config } from "../config";

export class Server {
  private app: express.Application;
  private config: Config;

  constructor(config: Config, shortCreator: ShortCreator) {
    this.config = config;
    this.app = express();

    // Configure session middleware
    this.app.use(session({
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
