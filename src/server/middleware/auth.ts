import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";

declare const process: any;

export function requireAuth(req: ExpressRequest, res: ExpressResponse, next: NextFunction): void {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: "Authentication required" });
  }
}

export function requireAuthOrApiKey(req: ExpressRequest, res: ExpressResponse, next: NextFunction): void {
  // Check for Bearer token
  const authHeader = req.headers.authorization;
  const apiKey = process.env.API_KEY;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === apiKey) {
      return next();
    }
  }
  // Fallback to session authentication
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}

export function redirectIfNotAuthenticated(req: ExpressRequest, res: ExpressResponse, next: NextFunction): void {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    // For API routes, return JSON error
    if (req.path.startsWith('/api')) {
      res.status(401).json({ error: "Authentication required" });
    } else {
      // For UI routes, redirect to login page
      res.redirect('/login');
    }
  }
}
