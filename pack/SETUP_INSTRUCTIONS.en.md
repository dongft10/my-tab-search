# Node.js Packaging Environment Setup Guide

## Installing Node.js

1. Visit the [Node.js official website](https://nodejs.org/)
2. Download and install the LTS version
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

## Installing Project Dependencies

Run in the project root directory:

```bash
npm install
```

## Installing Global Tools (Optional)

If you need to generate CRX files, it is recommended to install crx (because crx3 may have compatibility issues with newer versions of Node.js):

```bash
npm install -g crx
```

If crx doesn't work, you can try crx3:

```bash
npm install -g crx3
```

## Preparing the PEM Private Key File

Before packaging, you need to prepare the PEM private key file:

1. **Place the PEM file** (required):
   - Place the `my-tab-search.pem` file in the project root directory (recommended)
   - Or place it in the `pack/` directory

2. **How to obtain the PEM file**:
   - For existing extensions: Download the ZIP package from the Chrome Web Store Developer Dashboard and extract it
   - For new extensions: Manually generate `npx crx keygen "path/to/directory" -o my-tab-search.pem`
   - Google will automatically assign one when you first publish

**Note**: The PEM file is used to maintain the extension's unique identifier (ID). The same PEM file must be used for each release.

## Start Packaging

After installation is complete, you can package using the following methods:

```bash
# Using the convenience script (recommended)
.\run-packaging.ps1

# Or use npm command
npm run build
```

## Troubleshooting

If you encounter permission issues, run PowerShell as administrator:

```bash
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
