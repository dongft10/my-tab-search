# MyTabSearch - Chrome Extension

![MyTabSearch](images/image.png)

## Project Overview

MyTabSearch is an efficient Chrome browser tab management extension designed to help users quickly search, switch, and manage browser tabs, improving productivity in multi-tab browsing environments.

## Features

- 🔍 **Quick Search**: Search and filter tabs by title
- ⌨️ **Keyboard Navigation**: Use arrow keys to select target tabs
- ⚡ **Fast Switching**: Press Enter to quickly switch to target tab
- 🗑️ **Direct Closing**: Press Delete to close selected tab
- 🔄 **History**: Support for quickly switching to previous tab (Ctrl+Shift+S)
- 🌐 **Internationalization**: Bilingual support for English and Chinese
- 🎨 **Icon Display**: Display website icons for quick identification
- 💾 **State Memory**: Remember's last active tab state

## Installation

### Method 1: Install from Chrome Web Store (Recommended)

1. Visit Chrome Web Store (coming soon)
2. Search for "MyTabSearch"
3. Click "Add to Chrome" button
4. Complete installation

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
5. Select this directory (chrome-extension)
6. Complete loading

## Usage

### Basic Usage

1. **Open Extension**: Click the extension icon in the Chrome toolbar, or use the shortcut `Ctrl+Shift+A` (Mac: `Cmd+Shift+A`)
2. **Search Tabs**: Enter keywords in the input box to filter tabs
3. **Select Tab**: Use arrow keys or mouse click to select the target tab
4. **Switch Tab**: Press Enter to switch to the selected tab
5. **Close Tab**: Press Delete to close the selected tab

### Keyboard Shortcuts

| Shortcut | Function | Description |
|----------|-----------|-------------|
| `Ctrl+Shift+A` / `Cmd+Shift+A` | Open Search Popup | Quickly bring up the tab search interface |
| `Ctrl+Shift+S` / `Cmd+Shift+S` | Switch to Previous Tab | Quickly return to the last visited tab |
| `↑` / `↓` | Navigate Results | Move up and down in search results |
| `Enter` | Switch to Selected Tab | Jump to the currently selected tab |
| `Delete` | Close Selected Tab | Directly close the currently selected tab |

### Tips

1. **Pin Extension**: After installation, it's recommended to pin the extension to the browser toolbar for quick access

   ![Pin Icon](images/fix-icon.png)

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

1. Enable developer mode in `chrome://extensions/`
2. Click "Load unpacked"
3. Select this directory (chrome-extension)
4. After modifying code, click the refresh button on the extension card to reload

### Packaging and Publishing

#### Windows Users

```bash
cd pack
.\pack.bat    # Package extension
.\clean.bat   # Clean build output
```

#### macOS/Linux Users

```bash
npm run build    # Production build (with code compression)
npm run build-dev # Development build (skip compression)
npm run clean    # Clean build output
```

After packaging, the following files will be generated in the `pack/out` directory:
- `my-tab-search-v{version}.crx` - For local installation
- `my-tab-search-v{version}.zip` - For Chrome Web Store publishing

For detailed packaging instructions, please refer to [pack/PACKAGING.md](pack/PACKAGING.md)

## Project Structure

```
chrome-extension/
├── _locales/             # Internationalization language files
│   ├── en/               # English
│   └── zh_CN/            # Simplified Chinese
├── css/                  # Style files
├── docs/                 # Documentation
├── html/                 # HTML pages
│   ├── about.html         # About page
│   ├── popup.html         # Main popup page
│   └── settings.html      # Settings page
├── images/               # Icons and image resources
├── js/                   # JavaScript source code
│   ├── about.js          # About page logic
│   ├── background.js      # Background service
│   ├── i18n.js          # Internationalization support
│   ├── popup-icons.js    # Icon handling
│   ├── popup.js          # Main popup logic
│   └── settings.js       # Settings page logic
├── pack/                 # Packaging tools and scripts
│   ├── scripts/          # Node.js packaging scripts
│   ├── PACKAGING.md      # Packaging documentation
│   ├── README.md         # Packaging quick guide
│   ├── SETUP_INSTRUCTIONS.md # Setup instructions
│   ├── pack.bat          # Windows packaging script
│   ├── clean.bat         # Windows cleanup script
│   ├── run-packaging.ps1 # PowerShell packaging script
│   └── clean.ps1        # PowerShell cleanup script
├── manifest.json          # Extension configuration file
├── package.json          # Node.js dependency configuration
└── README.md             # This file
```

## Internationalization

The project supports multiple languages, with language files located in the `_locales/` directory:

- `en/` - English
- `zh_CN/` - Simplified Chinese

To add a new language:
1. Create a new language directory under `_locales/` (e.g., `ja/`)
2. Copy the `messages.json` file and translate the content
3. Add the corresponding language code in `manifest.json`

## Privacy Policy

This extension takes user privacy seriously and does not collect, store, or transmit any personal data to external servers.

- **Local Data**: All data is stored only in the user's local browser
- **Minimal Permissions**: Only requests permissions necessary for functionality
- **No Tracking**: Does not collect user browsing history or any personal data

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

A: No. This extension runs entirely locally and does not collect, store, or transmit any personal data.

## Changelog

### v1.8.0 (2025-01-31)
- Removed notification functionality, changed to logging only
- Removed fuzzy search feature description
- Optimized packaging process, generating both CRX and ZIP files
- Updated privacy policy and permission descriptions

### v1.6.0
- Added quick switch to previous tab feature (Ctrl+Shift+S)
- Support for tab history

For more version history, please visit the [Releases](../../releases) page.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Icons from [www.pngsucai.com](https://www.pngsucai.com)
- Thanks to all contributors for their support

## Contact

- **GitHub Issues**: [Submit Issues](https://github.com/dongft10-dev/my-tab-search/issues)
- **Email**: [dongft10@gmail.com](dongft10@gmail.com)

---

**Made with ❤️ for better browsing experience**
