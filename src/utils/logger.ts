import winston from 'winston';
import { config } from '../config';

const levels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
};

const level = () => {
	return config.logging.level || 'info';
};

const colors = {
	error: 'red',
	warn: 'yellow',
	info: 'green',
	http: 'magenta',
	debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
	winston.format.colorize({ all: true }),
	winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

const transports = [
	new winston.transports.Console(),
	// Add file transports in production
	...(config.isProduction
		? [
				new winston.transports.File({
					filename: 'error.log',
					level: 'error',
				}),
				new winston.transports.File({ filename: 'all.log' }),
		  ]
		: []),
];

export const logger = winston.createLogger({
	level: level(),
	levels,
	format,
	transports,
});

// Create a stream object with a 'write' function that will be used by morgan
export const stream = {
	write: (message: string) => {
		// Remove newline character at the end
		logger.http(message.trim());
	},
};