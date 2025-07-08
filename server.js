const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');
const moment = require('moment');

const app = express();
const PORT = 3000;

// Generate a summary of the chat conversation with message indices
function generateChatSummary(userMessages, assistantMessages, firstUserMessage, chatId) {
  if (userMessages.length === 0) return { summary: 'Empty conversation', anchors: [] };
  
  const accomplishments = [];
  const anchors = [];
  
  // Combine messages with their indices
  const allMessages = [];
  userMessages.forEach((msg, idx) => allMessages.push({ content: msg, index: idx * 2, type: 'user' }));
  assistantMessages.forEach((msg, idx) => allMessages.push({ content: msg, index: idx * 2 + 1, type: 'assistant' }));
  allMessages.sort((a, b) => a.index - b.index);
  
  const allText = allMessages.map(m => m.content).join(' ').toLowerCase();
  
  // Look for action words and accomplishments with their message indices
  const actionPatterns = [
    { pattern: /created?\s+([^.!?]+)/g, verb: 'created' },
    { pattern: /built?\s+([^.!?]+)/g, verb: 'built' },
    { pattern: /implemented?\s+([^.!?]+)/g, verb: 'implemented' },
    { pattern: /added?\s+([^.!?]+)/g, verb: 'added' },
    { pattern: /fixed?\s+([^.!?]+)/g, verb: 'fixed' },
    { pattern: /updated?\s+([^.!?]+)/g, verb: 'updated' },
    { pattern: /installed?\s+([^.!?]+)/g, verb: 'installed' },
    { pattern: /configured?\s+([^.!?]+)/g, verb: 'configured' },
    { pattern: /deployed?\s+([^.!?]+)/g, verb: 'deployed' },
    { pattern: /setup?\s+([^.!?]+)/g, verb: 'setup' },
    { pattern: /wrote?\s+([^.!?]+)/g, verb: 'wrote' },
    { pattern: /designed?\s+([^.!?]+)/g, verb: 'designed' },
    { pattern: /developed?\s+([^.!?]+)/g, verb: 'developed' },
    { pattern: /optimized?\s+([^.!?]+)/g, verb: 'optimized' },
    { pattern: /refactored?\s+([^.!?]+)/g, verb: 'refactored' },
    { pattern: /debugged?\s+([^.!?]+)/g, verb: 'debugged' },
    { pattern: /resolved?\s+([^.!?]+)/g, verb: 'resolved' },
    { pattern: /completed?\s+([^.!?]+)/g, verb: 'completed' }
  ];
  
  // Find which message contains each accomplishment
  actionPatterns.forEach(({ pattern, verb }) => {
    // Check each message individually to find where the action occurs
    allMessages.forEach(msg => {
      const msgText = typeof msg.content === 'string' ? msg.content : '';
      const msgLower = msgText.toLowerCase();
      let match;
      const localPattern = new RegExp(verb + '\\s+([^.!?]+)', 'g');
      while ((match = localPattern.exec(msgLower)) !== null && accomplishments.length < 5) {
        const accomplishment = match[1].trim();
        if (accomplishment.length > 10 && accomplishment.length < 100) {
          const cleaned = accomplishment
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9\s]/gi, '')
            .trim();
          
          if (cleaned && !accomplishments.some(a => a.text.includes(cleaned.substring(0, 20)))) {
            accomplishments.push({
              text: cleaned,
              messageIndex: msg.index,
              anchorId: `msg-${msg.index}`
            });
          }
        }
      }
    });
  });
  
  // Look for file mentions
  const fileMatches = allText.match(/\b[\w-]+\.(js|py|html|css|json|md|txt|yml|yaml|xml|sql|sh|bat|ejs|ts|tsx|jsx)\b/g);
  if (fileMatches && accomplishments.length < 3) {
    const uniqueFiles = [...new Set(fileMatches)].slice(0, 2);
    uniqueFiles.forEach(file => {
      // Find which message mentions this file
      const msgIndex = allMessages.findIndex(m => {
        const content = typeof m.content === 'string' ? m.content : '';
        return content.toLowerCase().includes(file);
      });
      if (msgIndex !== -1) {
        accomplishments.push({
          text: `worked on ${file}`,
          messageIndex: allMessages[msgIndex].index,
          anchorId: `msg-${allMessages[msgIndex].index}`
        });
      }
    });
  }
  
  // Generate summary with links
  if (accomplishments.length > 0) {
    const bullets = accomplishments.slice(0, 3).map(item => {
      anchors.push({ id: item.anchorId, messageIndex: item.messageIndex });
      return `• <a href="/chat/${chatId}#${item.anchorId}" class="summary-link">${item.text}</a>`;
    });
    return { summary: bullets.join('\n'), anchors };
  }
  
  // Fallback
  return { summary: `• ${userMessages.length} message conversation`, anchors: [] };
}

// Claude conversation history path
const CLAUDE_HISTORY_PATH = path.join(
  process.env.HOME,
  '.claude/projects/-Users-jeffk-Developement-provider-search-provider-search-flutter'
);

// Serve static files
app.use(express.static('public'));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Homepage - List all chat histories
app.get('/', async (req, res) => {
  try {
    // Read all .jsonl files from the Claude history directory
    const files = await fs.readdir(CLAUDE_HISTORY_PATH);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    // Get file stats and create chat list
    const chats = await Promise.all(
      jsonlFiles.map(async (filename) => {
        const filePath = path.join(CLAUDE_HISTORY_PATH, filename);
        const stats = await fs.stat(filePath);
        
        // Read content to get first user message for preview
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        let firstUserMessage = '';
        let summary = '';
        const userMessages = [];
        const assistantMessages = [];
        
        // Extract all messages for summarization
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'user' && entry.message && entry.message.role === 'user') {
              const content = entry.message.content || '';
              userMessages.push(content);
              if (!firstUserMessage) {
                firstUserMessage = content;
              }
            } else if (entry.type === 'assistant' && entry.message && entry.message.role === 'assistant') {
              // Extract ALL content from assistant messages
              let textContent = '';
              if (Array.isArray(entry.message.content)) {
                entry.message.content.forEach(item => {
                  if (item.type === 'text') {
                    textContent += item.text + ' ';
                  } else if (item.type === 'tool_use') {
                    // Include tool names and inputs
                    textContent += `Tool: ${item.name} `;
                    if (item.input) {
                      textContent += JSON.stringify(item.input) + ' ';
                    }
                  } else if (item.type === 'tool_result') {
                    // Include tool results
                    if (item.content) {
                      textContent += JSON.stringify(item.content) + ' ';
                    }
                  } else {
                    // Include any other content types as JSON
                    textContent += JSON.stringify(item) + ' ';
                  }
                });
              } else if (typeof entry.message.content === 'string') {
                textContent = entry.message.content;
              }
              if (textContent.trim()) {
                assistantMessages.push(textContent.trim());
              }
            } else if (entry.type === 'tool_result' || entry.type === 'system') {
              // Also capture tool results and system messages
              let content = '';
              if (entry.content) {
                content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
              } else if (entry.message && entry.message.content) {
                content = typeof entry.message.content === 'string' ? entry.message.content : JSON.stringify(entry.message.content);
              }
              if (content.trim()) {
                assistantMessages.push(content.trim());
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        // Generate summary based on conversation content
        const chatId = filename.replace('.jsonl', '');
        const summaryResult = generateChatSummary(userMessages, assistantMessages, firstUserMessage, chatId);
        
        // Create searchable text from all messages
        const searchableText = [...userMessages, ...assistantMessages].join(' ').toLowerCase();
        
        return {
          id: chatId,
          filename,
          modifiedTime: stats.mtime,
          createdTime: stats.birthtime,
          size: stats.size,
          firstMessage: firstUserMessage || 'No preview available',
          summary: summaryResult.summary || 'No summary available',
          messageCount: content.split('\n').filter(line => line.trim()).length,
          searchableText: searchableText // Add full text for searching
        };
      })
    );
    
    // Sort by modified time (newest first)
    chats.sort((a, b) => b.modifiedTime - a.modifiedTime);
    
    // Calculate stats
    const totalConversations = chats.length;
    const totalMessages = chats.reduce((sum, chat) => sum + chat.messageCount, 0);
    
    res.render('index', { 
      chats, 
      moment,
      stats: {
        totalConversations,
        totalMessages
      }
    });
  } catch (error) {
    console.error('Error reading chat histories:', error);
    res.status(500).send('Error loading chat histories');
  }
});

// View individual chat
app.get('/chat/:id', async (req, res) => {
  try {
    const filename = `${req.params.id}.jsonl`;
    const filePath = path.join(CLAUDE_HISTORY_PATH, filename);
    const searchTerm = req.query.search || null;
    
    // Read the JSONL file
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse each line - handle Claude Code JSONL format
    const messages = lines.map((line, index) => {
      try {
        const entry = JSON.parse(line);
        
        // Extract the actual message from the Claude Code format
        if (entry.message) {
          const msg = entry.message;
          
          // Handle user messages
          if (entry.type === 'user' && msg.role === 'user') {
            return {
              role: 'user',
              content: msg.content || '',
              htmlContent: msg.content ? marked(msg.content) : null,
              timestamp: entry.timestamp
            };
          }
          
          // Handle assistant messages
          if (entry.type === 'assistant' && msg.role === 'assistant') {
            // Extract text content from content array
            let textContent = '';
            if (Array.isArray(msg.content)) {
              msg.content.forEach(item => {
                if (item.type === 'text') {
                  textContent += item.text + '\n';
                } else if (item.type === 'tool_use') {
                  textContent += `\n**Tool Call: ${item.name}**\n`;
                  if (item.input) {
                    textContent += '```json\n' + JSON.stringify(item.input, null, 2) + '\n```\n';
                  }
                }
              });
            } else if (typeof msg.content === 'string') {
              textContent = msg.content;
            }
            
            return {
              role: 'assistant',
              content: textContent.trim(),
              htmlContent: textContent ? marked(textContent.trim()) : null,
              timestamp: entry.timestamp,
              model: msg.model
            };
          }
        }
        
        // Skip sidechain messages and other non-content entries
        return null;
        
      } catch (e) {
        console.error(`Error parsing line ${index + 1}:`, e);
        return null;
      }
    }).filter(msg => msg !== null); // Remove null entries
    
    // Add search highlighting if search term is provided
    function highlightSearchTerm(text, searchTerm) {
      if (!searchTerm || !text) return text;
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      let counter = 0;
      return text.replace(regex, (match) => {
        counter++;
        return `<a id="search_${counter}" class="search-highlight">${match}</a>`;
      });
    }
    
    // Apply highlighting to messages if search term exists
    if (searchTerm) {
      messages.forEach(msg => {
        if (msg.content) {
          msg.content = highlightSearchTerm(msg.content, searchTerm);
        }
        if (msg.htmlContent) {
          msg.htmlContent = highlightSearchTerm(msg.htmlContent, searchTerm);
        }
      });
    }
    
    res.render('chat', { 
      chatId: req.params.id,
      messages,
      moment,
      messageCount: messages.length,
      searchTerm: searchTerm
    });
  } catch (error) {
    console.error('Error reading chat:', error);
    res.status(404).send('Chat not found');
  }
});

// Download chat as markdown
app.get('/download/:id', async (req, res) => {
  try {
    const filename = `${req.params.id}.jsonl`;
    const filePath = path.join(CLAUDE_HISTORY_PATH, filename);
    
    // Read the JSONL file
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse messages and convert to markdown
    let markdown = `# Claude Chat History\n\n`;
    markdown += `**Chat ID:** ${req.params.id}\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;
    
    lines.forEach((line) => {
      try {
        const entry = JSON.parse(line);
        
        if (entry.message) {
          const msg = entry.message;
          const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';
          
          // User messages
          if (entry.type === 'user' && msg.role === 'user') {
            markdown += `## You\n`;
            if (timestamp) markdown += `*${timestamp}*\n\n`;
            markdown += `${msg.content || ''}\n\n`;
          }
          
          // Assistant messages
          if (entry.type === 'assistant' && msg.role === 'assistant') {
            markdown += `## Claude\n`;
            if (timestamp) markdown += `*${timestamp}*\n\n`;
            
            if (Array.isArray(msg.content)) {
              msg.content.forEach(item => {
                if (item.type === 'text') {
                  markdown += `${item.text}\n\n`;
                } else if (item.type === 'tool_use') {
                  markdown += `**Tool Call: ${item.name}**\n\n`;
                  if (item.input) {
                    markdown += '```json\n' + JSON.stringify(item.input, null, 2) + '\n```\n\n';
                  }
                }
              });
            } else if (typeof msg.content === 'string') {
              markdown += `${msg.content}\n\n`;
            }
          }
        }
      } catch (e) {
        // Skip unparseable lines
      }
    });
    
    // Set headers for download
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="claude-chat-${req.params.id}.md"`);
    res.send(markdown);
    
  } catch (error) {
    console.error('Error downloading chat:', error);
    res.status(404).send('Chat not found');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude Chat Viewer running at http://localhost:${PORT}`);
  console.log(`Reading chats from: ${CLAUDE_HISTORY_PATH}`);
});