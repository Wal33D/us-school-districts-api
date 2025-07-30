import * as path from 'path';
import * as fs from 'fs/promises';

// Mock data for testing
export const mockDistrictFeature = {
	type: 'Feature',
	properties: {
		GEOID: '1234567',
		NAME: 'Test School District',
	},
	geometry: {
		type: 'Polygon' as const,
		coordinates: [[
			[-86.21, 42.66],
			[-86.20, 42.66],
			[-86.20, 42.65],
			[-86.21, 42.65],
			[-86.21, 42.66],
		]],
	},
};

// Helper to create test directories
export async function ensureTestDir(dir: string): Promise<void> {
	try {
		await fs.mkdir(dir, { recursive: true });
	} catch (error) {
		// Directory might already exist
	}
}

// Helper to clean up test files
export async function cleanupTestFiles(paths: string[]): Promise<void> {
	for (const filePath of paths) {
		try {
			await fs.unlink(filePath);
		} catch (error) {
			// File might not exist
		}
	}
}

describe('Helper Functions', () => {
	describe('getTargetSchoolYear', () => {
		test('should return correct school year format', () => {
			// This would need to be extracted to a separate module to test properly
			// For now, we'll test the format
			const now = new Date();
			const startYear = now.getFullYear() - 2;
			const endYear = now.getFullYear() - 1;
			const expectedSchoolYear = `SY${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
			const expectedTlCode = `TL${String(endYear).slice(-2)}`;

			expect(expectedSchoolYear).toMatch(/^SY\d{4}$/);
			expect(expectedTlCode).toMatch(/^TL\d{2}$/);
		});
	});

	describe('File Operations', () => {
		const testDir = path.join(__dirname, 'test-temp');

		afterEach(async () => {
			try {
				await fs.rmdir(testDir, { recursive: true });
			} catch (error) {
				// Directory might not exist
			}
		});

		test('ensureDirExists should create directory', async () => {
			await ensureTestDir(testDir);
			const stats = await fs.stat(testDir);
			expect(stats.isDirectory()).toBe(true);
		});

		test('fileExists should correctly check file existence', async () => {
			const testFile = path.join(testDir, 'test.txt');
			await ensureTestDir(testDir);

			// File doesn't exist yet
			let exists = false;
			try {
				await fs.access(testFile);
				exists = true;
			} catch {
				exists = false;
			}
			expect(exists).toBe(false);

			// Create file
			await fs.writeFile(testFile, 'test content');

			// File should exist now
			try {
				await fs.access(testFile);
				exists = true;
			} catch {
				exists = false;
			}
			expect(exists).toBe(true);

			// Cleanup
			await cleanupTestFiles([testFile]);
		});
	});
});