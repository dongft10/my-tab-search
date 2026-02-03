# Chrome Extension Packaging Guide

This project provides a set of tool scripts for compressing and packaging Chrome extensions.

## Script Overview

### 1. run-packaging.ps1
The main packaging script that performs the following operations:
- Installs project dependencies
- Calls the Node.js toolchain for building
- Compresses all JS, CSS, and HTML files in the project
- Generates an optimized build directory
- Automatically generates CRX and ZIP files

### 2. Node.js Packaging Scripts
Uses the Node.js toolchain for packaging, including:
- `scripts/clean.js` - Cleans the build output directory
- `scripts/compress.js` - Compresses JS/CSS files using terser and clean-css
- `scripts/package.js` - Creates ZIP packages and generates CRX files using archiver
- `scripts/build.js` - Comprehensive build script

## Usage

### Method 0: Using Batch Files (Recommended for Windows)

Open the path `my-tab-search-project\chrome-extension\pack` in Windows Explorer, then double-click `pack.bat` to start the packaging task. Double-click `clean.bat` to clean the build output.

### Method 1: Using npm Commands (Recommended)

Run from the project root directory:

```bash
# Install dependencies
npm install

# Production build (includes code compression)
npm run build

# Development build (skips compression, faster)
npm run build-dev

# Clean build output
npm run clean
```

### Method 2: Using PowerShell Scripts

```powershell
# Run from project root directory
.\pack\run-packaging.ps1

# Clean build output
.\pack\clean.ps1
```

## Directory Structure

- `pack/` - Packaging tools and output directory
  - `run-packaging.ps1` - Main packaging script
  - `clean.ps1` - Clean build output script
  - `scripts/` - Node.js packaging script directory
    - `build.js` - Comprehensive build script
    - `clean.js` - Clean script
    - `compress.js` - Compression script
    - `package.js` - Packaging script (generates CRX and ZIP)
  - `PACKAGING.md` - This document
  - `README.md` - Quick usage guide
  - `out/` - Output directory
    - `build/` - Build results (contains all source files)
    - `my-tab-search-v{version}.crx` - CRX extension file
    - `my-tab-search-v{version}.zip` - ZIP archive (for Chrome Web Store)

## Output Files

After the build is complete, the following files will be generated in the `pack/out` directory:

- `build/` - Contains all compressed and optimized source files
- `my-tab-search-v{version}.crx` - CRX extension file for local installation
- `my-tab-search-v{version}.zip` - ZIP archive for publishing to Chrome Web Store

Where `{version}` is the version number defined in [manifest.json](file:///d:/workspace/my-tab-search-project/chrome-extension/manifest.json#L3).

For example, if the version in manifest.json is "1.8.0", the following will be generated:
- `my-tab-search-v1.8.0.crx` (approx. 140 KB)
- `my-tab-search-v1.8.0.zip` (approx. 135 KB)

### CRX vs ZIP Format

- **CRX Format**: The standard installation format for Chrome extensions, includes digital signature, can be directly dragged to the Chrome extensions page for installation
- **ZIP Format**: Universal compression format, used for uploading to Chrome Web Store for publishing

**Note**: The packaging process generates both formats simultaneously. CRX is used for local testing and installation, ZIP is used for publishing to Chrome Web Store.

## Important Notes

1. **Private Key File** (my-tab-search.pem) is used to maintain the extension's unique identifier (ID), **must be manually placed in the project root directory or pack directory**. The packaging script will not automatically generate the PEM file; if the file does not exist, it will report an error and prompt how to obtain it.

   PEM file placement locations (in priority order):
   - Project root directory: `my-tab-search.pem` (recommended)
   - Pack directory: `pack/my-tab-search.pem`

   If you don't have a PEM file, you can obtain it through the following methods:
   - Download the ZIP package of an existing extension from the Chrome Web Store Developer Dashboard and extract it
   - Manually generate: `npx crx keygen "path/to/directory" -o my-tab-search.pem`
   - Google will automatically assign one when you first publish to Chrome Web Store
   - The PEM file should be located in the root directory of the overall project (`my-tab-search.pem`), not recommended to be placed in the chrome-extension sub-project
   - The packaging script will automatically find and use this file

2. If there is no private key file, a new extension ID will be generated each time you package
3. The compression process removes comments and extra whitespace, but preserves important comments (such as eslint, jshint, etc.)
4. It is recommended to test whether the compressed extension functions normally before releasing
5. The packaging process generates both CRX and ZIP files simultaneously; CRX is used for local installation, ZIP is used for Chrome Web Store publishing

## Installing Dependencies

If you want to use the Node.js automated packaging feature, you need to install the following tools:

- **Node.js**: For running packaging scripts and the crx tool
- **npm packages**: terser, clean-css, archiver (installed via npm install)

Run the following command to install dependencies:
```bash
npm install
```

## Cleaning Output Directory

If you need to clean old build files in the `pack/out` directory, you can run:

```bash
npm run clean
```

Or use the PowerShell script:
```powershell
.\pack\clean.ps1
```

This will delete all contents in the `pack/out` directory, providing you with a clean build environment.

## Manual Packaging

If you don't want to use automated scripts, you can also manually package through the Chrome browser:

1. Open Chrome browser
2. Visit `chrome://extensions`
3. Enable "Developer mode"
4. Click "Pack extension"
5. Enter the extension directory path (chrome-extension directory)
6. (Optional) Enter the private key path (`my-tab-search.pem` in the root directory of the overall project)
7. Click the "Pack Extension" button
