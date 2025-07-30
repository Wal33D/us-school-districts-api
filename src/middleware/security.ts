import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { config } from '../config';

// Helper to check if request is from a bypass IP
function isRequestFromBypassIP(req: Request): boolean {
	const clientIp = req.ip || req.socket.remoteAddress || '';
	const normalizedIp = clientIp.replace(/^::ffff:/, ''); // Remove IPv6 prefix for IPv4

	return config.security.bypassIPs.some(bypassIp => {
		// Direct IP match
		if (normalizedIp === bypassIp) return true;
		
		// Check for localhost variations
		if (bypassIp === 'localhost') {
			return normalizedIp === '127.0.0.1' || normalizedIp === '::1';
		}
		
		return false;
	});
}

// Conditional middleware wrapper
function conditionalMiddleware(middleware: RequestHandler): RequestHandler {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!config.security.enableMiddleware || isRequestFromBypassIP(req)) {
			return next();
		}
		return middleware(req, res, next);
	};
}

// Helmet security headers
export const helmetMiddleware = conditionalMiddleware(
	helmet({
		contentSecurityPolicy: config.isProduction ? undefined : false,
	})
);

// Rate limiting
const rateLimiter = rateLimit({
	windowMs: config.rateLimit.windowMs,
	max: config.rateLimit.maxRequests,
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req: Request) => isRequestFromBypassIP(req),
	message: 'Too many requests from this IP, please try again later.',
});

export const rateLimitMiddleware = conditionalMiddleware(rateLimiter);

// CORS
const corsOptions: cors.CorsOptions = {
	origin: (origin, callback) => {
		// Allow requests with no origin (like mobile apps or curl)
		if (!origin) return callback(null, true);
		
		// Allow all origins if configured
		if (config.cors.allowedOrigins.includes('*')) {
			return callback(null, true);
		}
		
		// Check against allowed origins
		if (config.cors.allowedOrigins.includes(origin)) {
			return callback(null, true);
		}
		
		// Reject
		callback(new Error('Not allowed by CORS'));
	},
	credentials: true,
	optionsSuccessStatus: 200,
};

export const corsMiddleware = conditionalMiddleware(cors(corsOptions));