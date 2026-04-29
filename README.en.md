# MyTabSearch - Chrome Extension

![MyTabSearch](images/image.png)

## Project Overview

MyTabSearch is an efficient Chrome browser tab management extension designed to help users quickly search, switch, and manage browser tabs, improving productivity in multi-tab browsing environments. Features include user account system, cross-device sync for pinned tabs, and multiple search modes.

## Online Demo

Visit our [GitHub Pages](https://dongft10.github.io/my-tab-search/) for detailed introduction and feature demonstration.

## Features

### Core Features

- 🔍 **Quick Search**: Search and filter tabs by title with multiple search modes
- ⌨️ **Keyboard Navigation**: Use arrow keys to select target tabs
- ⚡ **Fast Switching**: Press Enter to quickly switch to target tab
- 🗑️ **Direct Closing**: Press Delete to close selected tab
- 🔄 **History**: Support for quickly switching to previous tab (Alt+W)
- 📌 **Long-term Pinned**: Save frequently used tabs to pinned list (Alt+E) for quick access and management, persisted even after browser restart

### Pinned Tabs Management

- 🟠 **Pin Tabs**: Save frequently used tabs for quick access
- ☁️ **Cloud Sync**: Promotion period, trial period or VIP users can sync pinned tabs across devices
- 🔢 **Limits**:
  - Anonymous users: 5 tabs
  - Registered users (trial/VIP): 100 tabs

### User Account System

- 🔐 **Multiple Login Methods**:
  - Google OAuth login
  - Microsoft OAuth login
  - Email verification code login
- 👤 **Account Management**: View account status, VIP info, device list
- 💎 **VIP Membership**: Unlock more advanced features

### Search Modes

| Mode | Description |
|------|-------------|
| Mode 1 | Title keyword quick match |
| Mode 2 | Title subsequence match |
| Mode 3 | Title keyword quick match + page content match |
| Mode 4 | Title subsequence match + page content match |

### Other Features

- 🌐 **Internationalization**: Bilingual support for English and Chinese
- 🎨 **Theme Switching**: Light and dark theme support
- 🏷️ **Icon Display**: Display website icons for quick identification
- 💾 **State Memory**: Remember's last active tab state

## Installation

### Method 1: Install from Chrome Web Store (Recommended)

1. Visit [Chrome Web Store](https://chromewebstore.google.com/detail/mytabsearch-extension/adfbidbchmbodidfjmimbkfndnenljjp)
2. Click "Add to Chrome" button
3. Complete installation

### Method 2: Manual CRX Installation

1. Download the latest CRX file from the [Releases](../../releases) page
2. Open Chrome browser and visit `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Drag and drop the CRX file into the browser
5. Click "Add extension" to complete installation

### Method 3: Developer Mode Loading

1. Clone this repository to your local machine
2. Open Chrome browser and visit `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select this directory (chrome-extension) or `pack/out/build/` directory
6. Complete loading

## Usage

### Basic Usage

1. **Open Extension**: Click the extension icon in the Chrome toolbar, or use the shortcut `Alt+Q`
2. **Search Tabs**: Enter keywords in the input box to filter tabs
3. **Select Tab**: Use arrow keys or mouse click to select the target tab
4. **Switch Tab**: Press Enter to switch to the selected tab
5. **Close Tab**: Press Delete to close the selected tab

### Keyboard Shortcuts

| Shortcut | Function | Description |
|----------|----------|-------------|
| `Alt+Q` | Open Search Popup | Quickly bring up the tab search interface |
| `Alt+W` | Switch to Previous Tab | Quickly return to the last visited tab |
| `Alt+E` | Open Pinned Tabs List | Open the list of pinned tabs |
| `↑` / `↓` | Navigate Results | Move up and down in search results |
| `Enter` | Switch to Selected Tab | Jump to the currently selected tab |
| `Delete` | Close Selected Tab | Directly close the currently selected tab |

### Tips

1. **Pin Extension**: After installation, it's recommended to pin the extension to the browser toolbar for quick access

   ![Pin Icon](images/pin-extension.png)

2. **Shortcut Conflicts**: If default shortcuts don't work, there might be a key conflict. You can adjust them in `chrome://extensions/shortcuts`
3. **Icon Recognition**: Each tab displays the corresponding website icon for quick identification

## Development Guide

### Requirements

- Node.js 16.x or higher
- npm or yarn
- Chrome browser (developer mode)

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
# Development build (no compression, with env badge)
npm run build:dev

# QA environment build
npm run build:qa

# Production build (compressed)
npm run build
```

After building, load the `pack/out/build/` directory in `chrome://extensions/`.

### Project Structure

```
chrome-extension/
├── _locales/             # Internationalization language files
│   ├── en/               # English
│   └── zh_CN/            # Simplified Chinese
├── css/                  # Style files
│   ├── popup.css         # Main popup styles
│   ├── settings.css      # Settings page styles
│   ├── auth.css          # Auth page styles
│   └── pinned-list.css   # Pinned tabs styles
├── html/                 # HTML pages
│   ├── popup.html        # Main popup page
│   ├── settings.html     # Settings page
│   ├── auth.html         # Auth page
│   ├── pinned-list.html  # Pinned tabs list
│   └── about.html        # About page
├── images/               # Icons and image resources
├── js/                   # JavaScript source code
│   ├── api/              # API clients
│   │   ├── client.js           # Base API client
│   │   ├── client-enhanced.js  # Enhanced API client
│   │   └── auth.js             # Auth API
│   ├── services/         # Business services
│   │   ├── auth.service.js          # Auth service
│   │   ├── vip.service.js           # VIP status service
│   │   ├── trial.service.js         # Trial service
│   │   ├── device.service.js        # Device management service
│   │   ├── pinned-tabs.service.js   # Pinned tabs service
│   │   ├── pinned-tabs-sync.service.js # Pinned tabs sync service
│   │   ├── sync-queue.service.js    # Sync queue service
│   │   ├── feature-limit.service.js # Feature limit service
│   │   └── search-match.service.js  # Search match service
│   ├── utils/            # Utilities
│   │   ├── theme.js            # Theme management
│   │   ├── theme-early.js      # Theme early loading
│   │   ├── theme-init.js       # Theme initialization
│   │   ├── theme-settings.js   # Theme settings
│   │   └── version-manager.js  # Version manager
│   ├── background.js     # Background service (Service Worker)
│   ├── popup.js          # Main popup logic
│   ├── settings.js       # Settings page logic
│   ├── auth.js           # Auth page logic
│   ├── pinned-list.js    # Pinned tabs list logic
│   ├── about.js          # About page logic
│   ├── i18n.js           # Internationalization support
│   ├── popup-icons.js    # Icon handling
│   └── config.js         # Configuration
├── pack/                 # Packaging tools and scripts
│   ├── scripts/          # Node.js packaging scripts
│   └── *.bat/*.ps1       # Windows packaging scripts
├── manifest.json         # Extension configuration file
├── package.json          # Node.js dependency configuration
└── README.md             # This file
```

### Packaging and Publishing

```bash
# Windows
cd pack
.\pack.bat    # Package extension
.\clean.bat   # Clean build output

# macOS/Linux
npm run build    # Production build
npm run clean    # Clean build output
```

After packaging, the following files will be generated in the `pack/out` directory:
- `my-tab-search-v{version}.crx` - For local installation
- `my-tab-search-v{version}.zip` - For Chrome Web Store publishing

For detailed packaging instructions, please refer to [pack/PACKAGING.md](pack/PACKAGING.md)

### Environment Configuration

The project supports three environments:

| Environment | API URL | Build Command |
|-------------|---------|---------------|
| Development | http://localhost:41532 | `npm run build:dev` |
| QA | / | `npm run build:qa` |
| Production | / | `npm run build` |

Development and QA environments display an environment badge (green DEV or yellow QA) in the bottom left corner of the popup.

## Internationalization

The project supports multiple languages, with language files located in the `_locales/` directory:

- `en/` - English
- `zh_CN/` - Simplified Chinese

To add a new language:
1. Create a new language directory under `_locales/` (e.g., `ja/`)
2. Copy the `messages.json` file and translate the content
3. Add the corresponding language code in `manifest.json`

## Privacy Policy

This extension takes user privacy seriously:

- **Local Data**: All local data is stored only in the user's browser
- **Minimal Permissions**: Only requests permissions necessary for functionality
- **No Tracking**: Does not collect user browsing history or any personal data
- **Secure Authentication**: Uses OAuth 2.0 standard for third-party login

For the complete privacy policy, please see the [PRIVACY_POLICY.html](PRIVACY_POLICY.html).

## Contributing

Contributions are welcome! Feel free to submit code, report issues, or make suggestions.

### Contribution Workflow

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style Guidelines

- Follow existing code style
- Add necessary comments
- Ensure code passes tests
- Update relevant documentation

## FAQ

### Q: Keyboard shortcuts are not working?

A: There might be a shortcut conflict. Please visit `chrome://extensions/shortcuts` to check and adjust shortcut settings.

### Q: How to uninstall the extension?

A: Visit `chrome://extensions/`, find the MyTabSearch extension, and click the "Remove" button.

### Q: Does the extension collect my browsing data?

A: The extension does not collect your browsing history or any personal data. However, to enable cross-device sync, your actively saved long-term pinned tabs data will be stored on cloud servers, used solely for sync functionality and not for any other purposes.

### Q: What are the limits for pinned tabs?

A: Anonymous users can have up to 5 pinned tabs. Registered users (trial or VIP) can have up to 100 pinned tabs.

### Q: How to upgrade to VIP?

A: Please contact the developer or check the upgrade method on the About page.

## Changelog

### v2.0.0 (2025-04-17)

**Major Update**

- 🎉 New user account system
  - Google OAuth login support
  - Microsoft OAuth login support
  - Email verification code login support
- 💎 VIP membership system
  - Trial period feature support
  - VIP feature unlocking
  - Multi-device support
- ☁️ Pinned tabs cloud sync
  - Cross-device sync of long-term-pinned tabs
  - Automatic conflict handling
- 🔍 Multiple search modes
  - Title keyword matching
  - Title subsequence matching
  - Page content matching (pending implementation)
- 🎨 Theme system optimization
  - Light/dark theme switching
- 🏗️ Architecture refactoring
  - Modular code structure
  - Service layer separation
  - API client encapsulation

### v1.8.0 (2025-01-31)

- Removed notification functionality, changed to logging only
- Removed fuzzy search feature description
- Optimized packaging process, generating both CRX and ZIP files
- Updated privacy policy and permission descriptions

### v1.6.0

- Added quick switch to previous tab feature (Alt+W)
- Support for tab history

For more version history, please visit the [Releases](../../releases) page.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Icons from [www.pngsucai.com](https://www.pngsucai.com)
- Thanks to all contributors for their support

## Contact

- **GitHub Issues**: [Submit Issues](https://github.com/dongft10/my-tab-search/issues)
- **Email**: [dongft10@gmail.com](dongft10@gmail.com)

---

**Made with ❤️ for better browsing experience**
