# Claude Chat History Viewer

A dynamic Node.js website to browse and view your Claude Code conversation history with a clean, Claude-inspired interface.

## Overview

This web application provides a local interface to browse and view your Claude Code chat histories. It reads the JSONL files stored by Claude Code and presents them in a familiar sidebar format similar to the Claude web app, with each chat showing the date and first message as a one-liner.

## Features

- 📋 **Homepage**: Lists all chat histories sorted by date (newest first)
- 🎨 **Claude-inspired UI**: Clean sidebar design matching the Claude app aesthetic
- 📱 **Date-Message Format**: Each chat shows "YYYY-MM-DD - first message preview"
- 🔍 **Chat Viewer**: Click any chat to view the full conversation with formatted messages
- 🎯 **Markdown Support**: Automatically converts markdown to HTML in chat view
- 🛠️ **Tool Call Display**: Shows tool usage with syntax highlighting
- ⚡ **Real-time Parsing**: Dynamically reads from Claude Code's storage location

## Installation

1. Clone or navigate to the claude folder:
```bash
cd /Users/jeffk/Developement/provider-search/claude
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser to: http://localhost:3000

## Development

For auto-reload during development:
```bash
npm run dev
```

## File Structure

```
claude/
├── server.js                    # Express server and JSONL parser
├── package.json                 # Node dependencies
├── views/                      # EJS templates
│   ├── index.ejs              # Homepage with chat list
│   └── chat.ejs               # Individual chat viewer
├── public/                     # Static assets
│   └── css/
│       ├── claude-sidebar.css  # Main Claude-inspired styling
│       ├── claude-chat.css     # Chat conversation styling
│       ├── style.css          # Additional base styles
│       └── style-dark.css     # Dark theme styles
└── README.md                   # This file
```

## How It Works

### Chat History Location
The app reads Claude Code conversation histories from:
```
~/.claude/projects/-Users-jeffk-Developement-provider-search-provider-search-flutter/
```

### JSONL Parsing
1. **File Discovery**: Scans for `.jsonl` files in the Claude history directory
2. **Message Extraction**: Parses each JSONL file to extract user and assistant messages
3. **Preview Generation**: Extracts the first user message from each chat for the preview
4. **Sorting**: Orders chats by modification time (newest first)

### Message Processing
- **User Messages**: Extracts content from `entry.message.content`
- **Assistant Messages**: Handles both text and tool_use content types
- **Tool Calls**: Displays tool usage with formatted JSON input
- **Markdown Rendering**: Uses `marked` library for HTML conversion

### Routing
- **`/`**: Homepage showing all chats in sidebar format
- **`/chat/:id`**: Individual chat viewer with full conversation

## Technologies Used

- **Express.js**: Web framework for server and routing
- **EJS**: Template engine for dynamic HTML generation
- **Marked**: Markdown to HTML conversion
- **Moment.js**: Date formatting and relative time display
- **Nodemon**: Development auto-reload

## Configuration

The Claude history path is configured in `server.js`:
```javascript
const CLAUDE_HISTORY_PATH = path.join(
  process.env.HOME,
  '.claude/projects/-Users-jeffk-Developement-provider-search-provider-search-flutter'
);
```

## Future Enhancements

- 🔍 Search functionality across all chats
- 📤 Export conversations to different formats (PDF, HTML, etc.)
- 🏷️ Tag and categorize conversations
- ⭐ Favorite important discoveries
- 📊 Analytics dashboard with usage statistics
- 🔄 Auto-refresh for new chats
- 🎨 Theme customization options
- 📱 Mobile-responsive improvements

## Part of Provider Search Ecosystem

This Claude Chat History Viewer is part of the larger Provider Search project ecosystem, providing a way to review and reference past Claude Code conversations during development work.

## License

MIT License - Feel free to modify and use for your own Claude Code chat browsing needs.