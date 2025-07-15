# Claude Chat History Viewer

A sophisticated web application for browsing, searching, and analyzing Claude Code chat histories with automatic AI-powered summarization.

## Overview

This web application provides a powerful interface to browse, search, and analyze your Claude Code chat histories across all projects. It automatically analyzes conversations using AI to generate summaries, bullet points, and make your chat history searchable and organized.

## Features

- 📊 **Automatic Analysis**: Conversations are automatically analyzed on page load with AI-generated summaries
- 🔍 **Full-Text Search**: Search across all conversations with real-time highlighting and navigation
- 📁 **Multi-Project Support**: Browse conversations organized by project, not just a single project
- 💡 **Smart Summaries**: Each conversation includes:
  - One-line summary for quick understanding
  - Detailed paragraph summary (2-5 sentences)
  - Up to 8 bullet points of key accomplishments
- 📥 **Export to Markdown**: Download any conversation as a formatted Markdown file
- 🎨 **Dark Theme**: Comfortable viewing with VS Code-inspired dark theme
- ⚡ **Real-time Updates**: Automatically detects and analyzes new messages
- 🔄 **Incremental Analysis**: Only analyzes changed conversations for efficiency

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

4. Open your browser to: http://localhost:3101

## Auto-Start on macOS

To have the Claude History Viewer start automatically on system boot:

1. Copy the launch daemon configuration:
```bash
cp com.dataintegrities.claude-history.plist ~/Library/LaunchAgents/
```

2. Load the launch daemon:
```bash
launchctl load ~/Library/LaunchAgents/com.dataintegrities.claude-history.plist
```

3. To stop the service:
```bash
launchctl unload ~/Library/LaunchAgents/com.dataintegrities.claude-history.plist
```

4. To check service status:
```bash
launchctl list | grep claude-history
```

Logs are stored in `./logs/` when running as a service.

## Development

For auto-reload during development:
```bash
npm run dev
```

## File Structure

```
claude/
├── server.js                    # Express server with AI analysis
├── package.json                 # Node dependencies
├── history-index.json          # Cached analysis data
├── com.dataintegrities.claude-history.plist  # macOS launch daemon
├── logs/                       # Service logs (when running as daemon)
├── views/                      # EJS templates
│   ├── index.ejs              # Homepage with project grouping
│   └── chat.ejs               # Individual chat viewer
├── public/                     # Static assets
│   ├── css/
│   │   ├── claude-sidebar.css  # Main styling
│   │   └── claude-chat.css     # Chat conversation styling
│   └── js/
│       ├── search.js          # Search functionality
│       └── chat-search.js     # In-chat search navigation
└── README.md                   # This file
```

## How It Works

### Chat History Location
The app reads Claude Code conversation histories from ALL projects:
```
~/.claude/projects/
```

Each project has its own subdirectory with encoded path names.

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

### API Endpoints

- **`GET /`**: Homepage with all conversations grouped by project
- **`GET /chat/:project/:id`**: View individual chat
- **`GET /download/:project/:id`**: Download chat as Markdown
- **`GET /history-index.json`**: View analysis cache data
- **`GET /analyze-chats`**: Manually trigger analysis (usually automatic)

### Configuration

- **Port**: Server runs on port 3101 (configurable in `server.js`)
- **Chat History**: Reads from `~/.claude/projects/`
- **Cache**: Analysis results stored in `history-index.json`
- **Logs**: Service logs in `./logs/` directory

## Technologies Used

- **Express.js**: Web framework for server and routing
- **EJS**: Template engine for dynamic HTML generation  
- **Marked**: Markdown to HTML conversion
- **Moment.js**: Date formatting and relative time display
- **AI Analysis**: Built-in Claude analysis for summarization
- **Nodemon**: Development auto-reload

## Usage Tips

### Search Functionality
- Use the 🔍 Find link to search across all conversations
- Search highlights appear in yellow with navigation
- Use Ctrl+N/P or Alt+↓/↑ to navigate between search results

### Auto-Analysis
- New conversations are analyzed automatically when you load the page
- A subtle notification shows "X conversations updated" if changes were detected
- Click the notification to see detailed analysis results

### Export Options
- Click 📥 Download on any chat to export as Markdown
- Exports include all messages with formatting preserved

## Future Enhancements (Planned)

### Agent Integration
- Integration with Proxmox VM management agents (in development)
- Automated infrastructure management capabilities
- Remote server configuration through Claude conversations

### Network Configuration (Planned)
- **DNS**: `claudehistory.dataintegrities.com` via Cloudflare
- **Reverse Proxy**: Nginx configuration for:
  - External domain routing to port 3101
  - Internal network restriction (192.x.x.x only)
  - SSL termination for secure access
- **Security**: Restrict access to local network only

### Additional Features
- 🔐 Authentication layer
- 📊 Analytics dashboard
- 🏷️ Tag and categorize conversations
- ⭐ Favorite important chats
- 📱 Mobile-responsive improvements

## Part of Provider Search Ecosystem

This Claude Chat History Viewer is part of the larger Provider Search project ecosystem, providing a way to review and reference past Claude Code conversations during development work.

## Development Continuation Process

### Finding the Last Thread That Crashed

When continuing work after a Claude Code session crash or interruption:

1. **Identify the Chat History Location**: 
   ```
   ~/.claude/projects/-Users-jeffk-Developement-provider-search-provider-search-flutter/
   ```

2. **Find the Most Recent JSONL File**:
   - Look for the newest `.jsonl` file by modification date
   - The crashed thread will be the most recently modified file

3. **Locate the Continuation Marker**:
   - Search for "CONTINUATION MARKER:" in the last conversation
   - The marker format is: `CONTINUATION MARKER: CLAUDE-WORK-YYYY-MM-DD`
   - This indicates where work should resume

4. **Extract Context**:
   - Read the last 100 lines of conversation before the crash
   - Note the current project state and what was being worked on
   - Identify any incomplete tasks or next steps

5. **Resume Work**:
   - Start from the claude folder directory (now its own git repo)
   - Reference the continuation marker and context
   - Continue with the identified next steps

### Current Project State (as of CLAUDE-WORK-2025-07-08)

- ✅ Implemented search highlighting features
- ✅ Search terms from homepage appear highlighted in yellow on chat detail pages
- ✅ Claude folder is now its own git repository at https://github.com/Data-Integrities/claude
- 🔄 Working from claude folder directory in separate VSCode instance

This documentation ensures continuity across Claude Code sessions and helps quickly resume work from where it left off.

## Troubleshooting

### Service Won't Start
- Check if port 3101 is already in use: `lsof -i :3101`
- Verify Node.js path: `which node`
- Check logs: `tail -f logs/stderr.log`

### Analysis Not Working
- Ensure `history-index.json` is writable
- Check for JavaScript errors in browser console
- Manually trigger analysis: visit `/analyze-chats`

## Production Access

The application is deployed at: https://claude-search.dataintegrities.com/
- Access restricted to local network (192.x.x.x addresses only)
- SSL/TLS enabled for secure access
- See [DEPLOYMENT.md](DEPLOYMENT.md) for infrastructure details

## Contributing

This is part of the Provider Search ecosystem. For issues or suggestions:
- GitHub: https://github.com/Data-Integrities/claude
- Contact: jeff@dataintegrities.com

## License

MIT License - Feel free to modify and use for your own Claude Code chat browsing needs.