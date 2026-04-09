import { NextFunction, Request, Response } from "express";

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
    if (request.session.user?.id) {
        next();
    } else {
        response.status(401).json({ error: "Authentication required" });
    }
}