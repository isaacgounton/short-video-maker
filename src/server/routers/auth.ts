import express from "express";
import bcrypt from "bcryptjs";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { Config } from "../../config";

declare module "express-session" {
  interface SessionData {
    isAuthenticated?: boolean;
    userId?: string;
  }
}

export class AuthRouter {
  public router: express.Router;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.router = express.Router();
    this.router.use(express.json());
    this.router.use(express.urlencoded({ extended: true }));

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Login endpoint
    this.router.post("/login", this.login.bind(this));
    
    // Logout endpoint
    this.router.post("/logout", this.logout.bind(this));
    
    // Check authentication status
    this.router.get("/status", this.checkAuthStatus.bind(this));
  }

  private async login(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      // Check username and password
      if (username === this.config.authUsername && 
          await bcrypt.compare(password, this.config.authPasswordHash)) {
        
        req.session.isAuthenticated = true;
        req.session.userId = username;
        
        res.json({ success: true, message: "Login successful" });
      } else {
        res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  private logout(req: ExpressRequest, res: ExpressResponse): void {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        res.status(500).json({ error: "Failed to logout" });
        return;
      }
      
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Logout successful" });
    });
  }

  private checkAuthStatus(req: ExpressRequest, res: ExpressResponse): void {
    res.json({ 
      isAuthenticated: req.session.isAuthenticated === true,
      userId: req.session.userId || null
    });
  }
}
