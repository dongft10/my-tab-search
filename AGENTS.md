# AGENTS.md - Chrome Extension Guidelines

This is the Chrome extension frontend for MyTabSearch project.

## Build, Lint, and Test Commands

```bash
cd chrome-extension

# Install dependencies
npm install

# Build for production (minified)
npm run build

# Build for development (no compression)
npm run build-dev

# Create zip package
npm run package

# Clean build artifacts
npm run clean

# Sync version with manifest
npm run sync-version
```

## Code Style Guidelines

### JavaScript Code Style

#### Import Organization
- Use ES6 modules with `import/export` syntax
- No strict grouping requirements
- Named imports for specific exports: `import { CONFIG } from './config.js'`

#### Naming Conventions
- **Variables/functions**: camelCase (`selectedIndex`, `updateTabs`)
- **Classes**: PascalCase (`I18nManager`, `ApiClient`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_PINNED_TABS`, `STORAGE_KEYS`)
- **Private methods**: Leading underscore convention (`_getMessage`)
- **Files**: kebab-case (`auth.service.js`, `user-device-uuid.js`)

#### Error Handling
- Use try-catch with async/await
- Log errors with `console.error()`
- Provide graceful degradation

#### Comments
- Use JSDoc-style for functions
- Use Chinese for comments (existing convention)

## Project Structure

```
chrome-extension/
├── js/
│   ├── api/           # API clients
│   ├── services/      # Business logic
│   └── utils/         # Utilities
├── _locales/          # i18n files
├── css/               # Stylesheets
├── html/              # HTML pages
├── images/            # Image assets
└── manifest.json
```

## Key Technologies

- Vanilla JavaScript (ES6+)
- Chrome Extension APIs
- Node.js build tools

## Notes

- No ESLint/Prettier config - follow manual style guidelines
- During the development and testing phase, after each front-end code adjustment is executed, remember to execute "npm run build-dev"