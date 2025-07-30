# Contributing to US School Districts API

Thank you for your interest in contributing to the US School Districts API! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors. Please:

- Be respectful and constructive in all interactions
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/us-school-districts-api.git
   cd us-school-districts-api
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Set up your environment**:
   ```bash
   cp .env.example .env
   ```

## Development Process

### 1. Before You Start

- Check existing [issues](https://github.com/Wal33D/us-school-districts-api/issues) to avoid duplicating work
- For significant changes, open an issue first to discuss your proposal
- Ensure your development environment is properly configured

### 2. Making Changes

- Write clear, self-documenting code
- Follow the existing code style and conventions
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Commit Messages

Follow conventional commit format:
```
type(scope): brief description

Longer explanation if needed

Fixes #123
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

## Submitting Changes

1. **Run tests and linting**:
   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Push your changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request**:
   - Use a clear, descriptive title
   - Reference any related issues
   - Provide a detailed description of changes
   - Include screenshots if applicable

## Coding Standards

### TypeScript

- Enable strict mode when possible
- Use explicit types rather than `any`
- Prefer interfaces over type aliases for object shapes
- Use meaningful variable and function names

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Best Practices

- Keep functions small and focused
- Use async/await over callbacks
- Handle errors appropriately
- Avoid global variables
- Comment complex logic

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

- Write unit tests for all new functions
- Aim for >80% code coverage
- Test edge cases and error conditions
- Use descriptive test names

Example:
```typescript
describe('LRUCache', () => {
  test('should evict least recently used item when capacity is exceeded', () => {
    // Test implementation
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex algorithms
- Include examples for utility functions

### README Updates

Update the README when:
- Adding new features
- Changing API endpoints
- Modifying configuration options
- Updating deployment instructions

## Reporting Issues

When reporting issues, please include:

1. **Description**: Clear explanation of the problem
2. **Steps to Reproduce**: Minimal steps to recreate the issue
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: Node version, OS, etc.
6. **Logs**: Any relevant error messages

### Issue Template

```markdown
**Description**
Brief description of the issue

**Steps to Reproduce**
1. Step one
2. Step two
3. ...

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Environment**
- Node.js version: 
- OS: 
- API version: 

**Additional Context**
Any other relevant information
```

## Questions?

If you have questions about contributing:

1. Check the [README](README.md) and documentation
2. Search existing issues
3. Open a new issue with the "question" label
4. Join discussions in pull requests

Thank you for contributing to the US School Districts API!