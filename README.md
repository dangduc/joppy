# Joplin Web Clipper Chrome Extension

A simple Chrome extension that allows you to clip selected text from any webpage directly to your local Joplin instance.

## Features

- Right-click any selected text and choose "Clip to Joplin"
- Creates a new note in Joplin with the selected text
- Includes source URL and timestamp
- Configurable settings (port, API token, target Joplin notebook)
- Test connection feature to verify Joplin is running

## Prerequisites

1. **Joplin Desktop** must be running on your computer
2. **Web Clipper Service** must be enabled in Joplin:
   - Go to Tools → Options → Web Clipper
   - Enable the Web Clipper service
   - Copy the authorization token

## Installation

Load the extension in Chrome:
- Open Chrome and go to `chrome://extensions/`
- Enable "Developer mode" (toggle in top right)
- Click "Load unpacked"
- Select the folder containing the extension files

## Configuration

1. Click the extension icon in Chrome toolbar
2. Enter your settings:
   - **Port**: Usually 41184 (default)
   - **API Token**: Copy from Joplin (Settings → Web Clipper → Advanced options → Authorization token)
   - **Notebook ID**: Optional - leave empty to use default notebook

3. Click "Save Settings"
4. Click "Test Connection" to verify everything is working

## Usage

1. Select to highlight any text on a webpage
2. Right-click the selection
3. Choose "Clip to Joplin" from the context menu
4. The selected text will be saved as a new note in Joplin

## Troubleshooting

Errors will not surface if clipping fails. Go to Manage Extensions to check errors.

## Future Enhancements

Possible improvements:
- Add tags to clipped notes
- Keyboard shortcut support
- Clip entire page, article content, screenshot
