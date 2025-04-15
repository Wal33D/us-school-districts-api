// src/middleware/localOnlyMiddleware.ts

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that only allows requests coming from the local machine.
 * It checks that the incoming IP is either "127.0.0.1" or "::1". If not,
 * the middleware responds with a 403 Forbidden error.
 */
export function localOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Use a default empty string if req.ip is undefined and remove any "::ffff:" prefix.
    const clientIp: string = (req.ip || '').replace(/^::ffff:/, '');
    const allowedIPs = ['127.0.0.1', '::1'];
    if (allowedIPs.includes(clientIp)) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied: Only local requests are allowed' });
    }
}
