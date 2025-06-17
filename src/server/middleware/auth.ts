import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";

export function requireAuth(req: ExpressRequest, res: ExpressResponse, next: NextFunction): void {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: "Authentication required" });
  }
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
