# Packaging Guide

This directory contains the tools and files for packaging the Chrome extension.

## Quick Start

To package the Chrome extension, follow these steps:

1. Ensure Node.js is installed
2. (Optional) If you need to generate CRX format, install the crx tool:

```bash
npm install -g crx
```

3. Run the following commands in the project root directory:

```bash
npm install
npm run build
```

4. After the build is complete, you will find the packaged files in the `pack/out` directory:
   - If crx tool is installed: `my-tab-search-v{version}.crx` file (where {version} is the version number defined in manifest.json)
   - If crx tool is not installed: `my-tab-search-v{version}.zip` file (as a fallback option, where {version} is the version number defined in manifest.json)

## Directory Structure

- `run-packaging.ps1` - Main packaging script for compressing and packaging the extension via Node.js toolchain
- `PACKAGING.md` - Detailed packaging documentation
- `out/` - Packaging output directory
- `my-tab-search.pem` - Private key file used to maintain the extension's unique identifier (**must be manually placed** in the project root directory or pack directory, will not be auto-generated)

## Usage

Run the convenience script for packaging (recommended):

```powershell
# Run from project root directory
.\pack\run-packaging.ps1
```

Or use Node.js commands directly:

```bash
npm install
npm run build
```

### Cleaning Output Directory

If you need to clean old build files in the `pack/out` directory, you can run:

```bash
npm run clean
```

This will delete all contents in the `pack/out` directory, providing you with a clean build environment.
