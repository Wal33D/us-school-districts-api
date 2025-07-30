import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

export const errorHandler = (
	err: Error | AppError,
	_req: Request,
	res: Response,
	_next: NextFunction
): void => {
	// Log error
	logger.error(err.stack || err.message);

	// Default error values
	let statusCode = 500;
	let message = 'Internal Server Error';
	let isOperational = false;

	// Handle known errors
	if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		isOperational = err.isOperational;
	} else if (err.name === 'ValidationError') {
		statusCode = 400;
		message = err.message;
		isOperational = true;
	} else if (err.name === 'CastError') {
		statusCode = 400;
		message = 'Invalid ID format';
		isOperational = true;
	}

	// Send error response
	res.status(statusCode).json({
		status: 'error',
		statusCode,
		message: isOperational ? message : 'Something went wrong',
		...(config.isDevelopment && { stack: err.stack }),
	});
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};