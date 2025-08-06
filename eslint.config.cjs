const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
	{
		// Global ignores
		ignores: [
			'dist/**',
			'node_modules/**',
			'coverage/**',
			'school_district_data/**',
			'*.js',
			'*.d.ts',
			'jest.config.js',
			'ecosystem.config.js',
			'eslint.config.cjs',
		],
	},
	{
		files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: 'module',
				project: './tsconfig.eslint.json',
			},
			globals: {
				console: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				exports: 'writable',
				module: 'writable',
				require: 'readonly',
				global: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				Promise: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			prettier: prettierPlugin,
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			...prettierConfig.rules,
			'prettier/prettier': 'error',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
	{
		// Test file and CLI overrides
		files: ['__tests__/**/*.{ts,tsx}', '**/*.test.ts', '**/*.spec.ts', 'src/cli.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
		},
	},
	{
		files: ['*.js', '*.cjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
		},
		plugins: {
			prettier: prettierPlugin,
		},
		rules: {
			...prettierConfig.rules,
			'prettier/prettier': 'error',
		},
	},
];