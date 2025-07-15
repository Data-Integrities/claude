const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');
const moment = require('moment');

const app = express();
const PORT = 3101;

// Path for history index
const HISTORY_INDEX_PATH = path.join(__dirname, 'history-index.json');

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

// Claude conversation history base path
const CLAUDE_BASE_PATH = path.join(process.env.HOME, '.claude/projects');

// Serve static files
app.use(express.static('public'));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper function to extract project name from encoded path
function extractProjectName(encodedPath) {
  // Remove leading dash and convert remaining dashes back to slashes
  const decodedPath = encodedPath.substring(1).replace(/-/g, '/');
  // Get just the last part of the path as the project name
  const parts = decodedPath.split('/');
  return parts[parts.length - 1] || 'Unknown Project';
}

// Helper function to update history index
async function updateHistoryIndex(chatsByProject) {
  try {
    // Read existing index or create empty array
    let existingIndex = [];
    try {
      const indexContent = await fs.readFile(HISTORY_INDEX_PATH, 'utf-8');
      existingIndex = JSON.parse(indexContent);
    } catch (e) {
      // File doesn't exist or is invalid, start fresh
    }

    // Convert existing index to a Map for efficient lookup
    const existingMap = new Map();
    existingIndex.forEach(thread => {
      existingMap.set(`${thread.project}:${thread.id}`, thread);
    });

    // Build new index
    const newIndex = [];
    let hasChanges = false;

    Object.entries(chatsByProject).forEach(([projectName, chats]) => {
      chats.forEach(chat => {
        const key = `${projectName}:${chat.id}`;
        const existingThread = existingMap.get(key);
        
        // Extract summary bullets (remove HTML tags)
        const bullets = chat.summary
          .split('\n')
          .filter(line => line.trim().startsWith('•'))
          .map(line => line.replace(/<[^>]*>/g, '').trim());
        
        // Extract just the first sentence from firstMessage
        let firstSentence = chat.firstMessage || '';
        const sentenceMatch = firstSentence.match(/^[^.!?]*[.!?]/);
        if (sentenceMatch) {
          firstSentence = sentenceMatch[0].trim();
        } else {
          firstSentence = firstSentence.split('\n')[0].trim();
        }
        
        const threadInfo = {
          id: chat.id,
          project: projectName,
          date: chat.modifiedTime.toISOString(),
          firstSentence: firstSentence,
          oneLineSummary: existingThread?.oneLineSummary || existingThread?.oneLine,
          bulletSummary: existingThread?.bulletSummary || existingThread?.enhancedBullets || bullets,
          paragraphSummary: existingThread?.paragraphSummary || existingThread?.paragraph,
          messageCount: chat.messageCount,
          lastMessageTimestamp: chat.lastMessageTimestamp
        };

        // Check if this is new or has changed
        if (!existingThread || 
            existingThread.messageCount !== chat.messageCount ||
            existingThread.lastMessageTimestamp !== chat.lastMessageTimestamp ||
            !existingThread.oneLineSummary || 
            !existingThread.paragraphSummary) {
          hasChanges = true;
          
          // Mark for analysis
          threadInfo.needsAnalysis = true;
        }

        newIndex.push(threadInfo);
      });
    });

    // Sort by date (newest first)
    newIndex.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Only write if there are changes
    if (hasChanges || existingIndex.length !== newIndex.length) {
      await fs.writeFile(HISTORY_INDEX_PATH, JSON.stringify(newIndex, null, 2));
      console.log('Updated history-index.json with', newIndex.length, 'threads');
    }
  } catch (error) {
    console.error('Error updating history index:', error);
  }
}

// Helper function to run analysis
async function runAnalysis() {
  const startTime = Date.now();
  const results = {
    checkDuration: 0,
    claudeSummaryDuration: 0,
    numberOfChatsUpdated: 0,
    chatsAnalyzed: []
  };
  
  try {
    // Check phase
    const checkStart = Date.now();
    const indexContent = await fs.readFile(HISTORY_INDEX_PATH, 'utf-8');
    const historyIndex = JSON.parse(indexContent);
    
    const needsAnalysis = historyIndex.filter(thread => 
      thread.needsAnalysis || !thread.oneLineSummary || !thread.paragraphSummary
    );
    
    results.checkDuration = Date.now() - checkStart;
    
    if (needsAnalysis.length === 0) {
      return results;
    }
    
    // Analysis phase
    const analysisStart = Date.now();
    
    for (const chat of needsAnalysis) {
      const chatStart = Date.now();
      
      try {
        // Find project directory
        const projectDirs = await fs.readdir(CLAUDE_BASE_PATH);
        let projectDir = null;
        
        for (const dir of projectDirs) {
          if (dir.includes(chat.project.replace(/\//g, '-'))) {
            projectDir = dir;
            break;
          }
        }
        
        if (!projectDir) continue;
        
        // Get full conversation
        const messages = await getFullConversation(projectDir, chat.id);
        
        // Analyze the chat
        const analysis = await analyzeChat(messages, chat.firstSentence || messages[0]?.content);
        
        // Update the index
        const threadIndex = historyIndex.findIndex(t => t.id === chat.id);
        if (threadIndex !== -1) {
          historyIndex[threadIndex] = {
            ...historyIndex[threadIndex],
            oneLineSummary: analysis.oneLineSummary,
            paragraphSummary: analysis.paragraphSummary,
            bulletSummary: analysis.bulletSummary,
            lastAnalyzed: new Date().toISOString(),
            needsAnalysis: false
          };
          
          results.numberOfChatsUpdated++;
          results.chatsAnalyzed.push({
            project: chat.project,
            chatId: chat.id,
            firstMessage: (chat.firstSentence || 'No preview available').substring(0, 50) + '...',
            duration: Date.now() - chatStart
          });
        }
        
      } catch (error) {
        console.error(`Error analyzing chat ${chat.id}:`, error);
      }
    }
    
    // Save updated index
    await fs.writeFile(HISTORY_INDEX_PATH, JSON.stringify(historyIndex, null, 2));
    
    results.claudeSummaryDuration = Date.now() - analysisStart;
    results.totalDuration = Date.now() - startTime;
    
    return results;
    
  } catch (error) {
    console.error('Error in analysis:', error);
    return results;
  }
}

// Homepage - List all chat histories
app.get('/', async (req, res) => {
  try {
    // Read all project directories
    const projectDirs = await fs.readdir(CLAUDE_BASE_PATH);
    const chatsByProject = {};
    
    // Process each project directory
    for (const projectDir of projectDirs) {
      const projectPath = path.join(CLAUDE_BASE_PATH, projectDir);
      const projectStat = await fs.stat(projectPath);
      
      if (!projectStat.isDirectory()) continue;
      
      // Extract project name from the encoded directory name
      const projectName = extractProjectName(projectDir);
      
      // Read all .jsonl files from this project directory
      const files = await fs.readdir(projectPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      // Get file stats and create chat list for this project
      const projectChats = await Promise.all(
        jsonlFiles.map(async (filename) => {
          const filePath = path.join(projectPath, filename);
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
        
        // Get last message timestamp
        let lastMessageTimestamp = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.timestamp) {
              lastMessageTimestamp = entry.timestamp;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Create searchable text from all messages
        const searchableText = [...userMessages, ...assistantMessages].join(' ').toLowerCase();
        
        return {
          id: chatId,
          filename,
          projectDir,
          projectName,
          modifiedTime: stats.mtime,
          createdTime: stats.birthtime,
          size: stats.size,
          firstMessage: firstUserMessage || 'No preview available',
          summary: summaryResult.summary || 'No summary available',
          messageCount: content.split('\n').filter(line => line.trim()).length,
          searchableText: searchableText, // Add full text for searching
          lastMessageTimestamp: lastMessageTimestamp
        };
        })
      );
      
      if (projectChats.length > 0) {
        chatsByProject[projectName] = projectChats;
      }
    }
    
    // Sort projects by name
    const sortedProjects = Object.keys(chatsByProject).sort();
    
    // Sort chats within each project by modified time (newest first)
    sortedProjects.forEach(projectName => {
      chatsByProject[projectName].sort((a, b) => b.modifiedTime - a.modifiedTime);
    });
    
    // Calculate stats
    let totalConversations = 0;
    let totalMessages = 0;
    Object.values(chatsByProject).forEach(projectChats => {
      totalConversations += projectChats.length;
      totalMessages += projectChats.reduce((sum, chat) => sum + chat.messageCount, 0);
    });
    
    // Update history index
    await updateHistoryIndex(chatsByProject);
    
    // Run analysis automatically
    const analysisResults = await runAnalysis();
    
    // Load enhanced summaries from history index
    try {
      const indexContent = await fs.readFile(HISTORY_INDEX_PATH, 'utf-8');
      const historyIndex = JSON.parse(indexContent);
      
      // Create a map for quick lookup
      const enhancedSummaries = new Map();
      historyIndex.forEach(thread => {
        enhancedSummaries.set(`${thread.project}:${thread.id}`, thread);
      });
      
      // Update chatsByProject with enhanced summaries
      Object.entries(chatsByProject).forEach(([projectName, chats]) => {
        chats.forEach(chat => {
          const key = `${projectName}:${chat.id}`;
          const enhanced = enhancedSummaries.get(key);
          if (enhanced && enhanced.paragraphSummary) {
            // Replace the basic summary with enhanced summary
            chat.enhancedSummary = {
              oneLine: enhanced.oneLineSummary || chat.firstMessage,
              paragraph: enhanced.paragraphSummary,
              bullets: enhanced.bulletSummary || []
            };
          }
        });
      });
    } catch (e) {
      console.log('Could not load enhanced summaries:', e);
    }
    
    res.render('index', { 
      chatsByProject,
      sortedProjects,
      moment,
      stats: {
        totalConversations,
        totalMessages,
        totalProjects: sortedProjects.length
      },
      analysisResults
    });
  } catch (error) {
    console.error('Error reading chat histories:', error);
    res.status(500).send('Error loading chat histories');
  }
});

// View individual chat
app.get('/chat/:project/:id', async (req, res) => {
  try {
    const filename = `${req.params.id}.jsonl`;
    const projectPath = path.join(CLAUDE_BASE_PATH, req.params.project);
    const filePath = path.join(projectPath, filename);
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
                    // Check if this is a Write or Read tool call with file content
                    if ((item.name === 'Write' && item.input.file_path && item.input.content) ||
                        (item.name === 'Read' && item.input.file_path)) {
                      const filePath = item.input.file_path;
                      const fileExt = filePath.split('.').pop()?.toLowerCase();
                      const content = item.input.content;
                      
                      // Show filename prominently
                      const fileName = filePath.split('/').pop();
                      textContent += `\n### ${fileName}\n\n`;
                      
                      // Format content based on file extension
                      let language = '';
                      switch (fileExt) {
                        case 'md':
                        case 'markdown':
                          // For markdown files, render the content in a box
                          textContent += '---\n\n';
                          textContent += content + '\n\n';
                          textContent += '---\n\n';
                          break;
                        case 'js':
                        case 'jsx':
                          language = 'javascript';
                          break;
                        case 'ts':
                        case 'tsx':
                          language = 'typescript';
                          break;
                        case 'py':
                          language = 'python';
                          break;
                        case 'html':
                          language = 'html';
                          break;
                        case 'css':
                          language = 'css';
                          break;
                        case 'json':
                          language = 'json';
                          break;
                        case 'yml':
                        case 'yaml':
                          language = 'yaml';
                          break;
                        case 'xml':
                          language = 'xml';
                          break;
                        case 'sql':
                          language = 'sql';
                          break;
                        case 'sh':
                        case 'bash':
                          language = 'bash';
                          break;
                        default:
                          language = 'text';
                      }
                      
                      // For non-markdown files, use syntax highlighting
                      if (fileExt !== 'md' && fileExt !== 'markdown') {
                        textContent += `\`\`\`${language}\n${content}\n\`\`\`\n`;
                      }
                    } else {
                      // Regular tool input display
                      textContent += '```json\n' + JSON.stringify(item.input, null, 2) + '\n```\n';
                    }
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
        
        // Handle tool results that might contain file content
        if (entry.type === 'tool_result' && entry.content) {
          // Try to detect if this is file content based on the tool that was called
          const content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
          
          return {
            role: 'tool_result',
            content: content,
            htmlContent: content ? marked('```\n' + content + '\n```') : null,
            timestamp: entry.timestamp
          };
        }
        
        // Skip sidechain messages and other non-content entries
        return null;
        
      } catch (e) {
        console.error(`Error parsing line ${index + 1}:`, e);
        return null;
      }
    }).filter(msg => msg !== null); // Remove null entries
    
    // Store original messages before highlighting for title extraction
    const originalMessages = messages.map(msg => ({ ...msg }));
    
    // Add search highlighting if search term is provided
    let globalSearchCounter = 0; // Global counter for unique IDs
    
    function highlightSearchTerm(text, searchTerm) {
      if (!searchTerm || !text) return text;
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      
      // Don't highlight inside markdown headers (### filename)
      const lines = text.split('\n');
      const processedLines = lines.map(line => {
        if (line.trim().startsWith('### ')) {
          return line; // Don't highlight header lines
        }
        return line.replace(regex, (match) => {
          globalSearchCounter++;
          return `<a id="search_${globalSearchCounter}" class="search-highlight">${match}</a>`;
        });
      });
      
      return processedLines.join('\n');
    }
    
    // Apply highlighting to messages if search term exists
    if (searchTerm) {
      messages.forEach(msg => {
        // Only highlight in htmlContent to avoid double counting
        if (msg.htmlContent) {
          msg.htmlContent = highlightSearchTerm(msg.htmlContent, searchTerm);
        } else if (msg.content) {
          // Only highlight plain content if there's no HTML version
          msg.content = highlightSearchTerm(msg.content, searchTerm);
        }
      });
    }
    
    res.render('chat', { 
      chatId: req.params.id,
      projectDir: req.params.project,
      projectName: extractProjectName(req.params.project),
      messages,
      originalMessages, // Pass original unhighlighted messages for title
      moment,
      messageCount: messages.length,
      searchTerm: searchTerm,
      searchCount: globalSearchCounter
    });
  } catch (error) {
    console.error('Error reading chat:', error);
    res.status(404).send('Chat not found');
  }
});

// Download chat as markdown
app.get('/download/:project/:id', async (req, res) => {
  try {
    const filename = `${req.params.id}.jsonl`;
    const projectPath = path.join(CLAUDE_BASE_PATH, req.params.project);
    const filePath = path.join(projectPath, filename);
    const searchTerm = req.query.search || null;
    
    // Function to highlight search terms in markdown
    function highlightSearchTermMarkdown(text, searchTerm) {
      if (!searchTerm || !text) return text;
      const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return text.replace(regex, '**$1**'); // Use bold for highlighting in markdown
    }
    
    // Read the JSONL file
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse messages and convert to markdown
    let markdown = `# Claude Chat History\n\n`;
    markdown += `**Chat ID:** ${req.params.id}\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n`;
    if (searchTerm) {
      markdown += `**Search Term:** "${searchTerm}"\n`;
    }
    markdown += `\n---\n\n`;
    
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
            const userContent = msg.content || '';
            markdown += `${highlightSearchTermMarkdown(userContent, searchTerm)}\n\n`;
          }
          
          // Assistant messages
          if (entry.type === 'assistant' && msg.role === 'assistant') {
            markdown += `## Claude\n`;
            if (timestamp) markdown += `*${timestamp}*\n\n`;
            
            if (Array.isArray(msg.content)) {
              msg.content.forEach(item => {
                if (item.type === 'text') {
                  markdown += `${highlightSearchTermMarkdown(item.text, searchTerm)}\n\n`;
                } else if (item.type === 'tool_use') {
                  markdown += `**Tool Call: ${item.name}**\n\n`;
                  if (item.input) {
                    const jsonString = JSON.stringify(item.input, null, 2);
                    markdown += '```json\n' + highlightSearchTermMarkdown(jsonString, searchTerm) + '\n```\n\n';
                  }
                }
              });
            } else if (typeof msg.content === 'string') {
              markdown += `${highlightSearchTermMarkdown(msg.content, searchTerm)}\n\n`;
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

// Route to view history index JSON
app.get('/history-index.json', async (req, res) => {
  try {
    const indexContent = await fs.readFile(HISTORY_INDEX_PATH, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(indexContent);
  } catch (error) {
    res.status(404).json({ error: 'History index not found' });
  }
});

// Helper function to extract full conversation
async function getFullConversation(projectDir, chatId) {
  const filePath = path.join(CLAUDE_BASE_PATH, projectDir, `${chatId}.jsonl`);
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const messages = [];
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      if (entry.type === 'user' && entry.message && entry.message.role === 'user') {
        messages.push({
          role: 'user',
          content: entry.message.content || ''
        });
      } else if (entry.type === 'assistant' && entry.message && entry.message.role === 'assistant') {
        let textContent = '';
        if (Array.isArray(entry.message.content)) {
          entry.message.content.forEach(item => {
            if (item.type === 'text') {
              textContent += item.text + '\n';
            }
          });
        } else if (typeof entry.message.content === 'string') {
          textContent = entry.message.content;
        }
        
        if (textContent.trim()) {
          messages.push({
            role: 'assistant',
            content: textContent.trim()
          });
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return messages;
}

// Helper function to analyze a single chat
async function analyzeChat(messages, firstMessage) {
  // Create a conversation summary for analysis
  let conversationText = '';
  messages.forEach(msg => {
    conversationText += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
  });
  
  // Analyze the conversation
  // Since I'm Claude analyzing the conversation, I'll do this directly
  const topics = [];
  const accomplishments = [];
  
  // Look for key patterns in the conversation
  const fullText = conversationText.toLowerCase();
  
  // Extract main topics and accomplishments
  if (fullText.includes('created') || fullText.includes('built') || fullText.includes('implemented')) {
    // Look for what was created/built
    const createdMatches = fullText.match(/(created?|built?|implemented?)\s+([^.!?\n]+)/g) || [];
    createdMatches.forEach(match => {
      const cleaned = match.replace(/(created?|built?|implemented?)\s+/i, '').trim();
      if (cleaned.length > 10 && cleaned.length < 100) {
        accomplishments.push(cleaned);
      }
    });
  }
  
  // Look for files mentioned
  const fileMatches = fullText.match(/\b[\w-]+\.(js|ts|jsx|tsx|json|md|py|html|css|yml|yaml)\b/g) || [];
  const uniqueFiles = [...new Set(fileMatches)].slice(0, 3);
  
  // Create one-line summary - a single descriptive sentence
  let oneLineSummary = '';
  if (accomplishments.length > 0) {
    oneLineSummary = `Discussion about ${accomplishments[0]}${uniqueFiles.length > 0 ? ` involving ${uniqueFiles[0]}` : ''}.`;
  } else if (uniqueFiles.length > 0) {
    oneLineSummary = `Working with ${uniqueFiles.join(', ')} files.`;
  } else {
    oneLineSummary = `${messages.length}-message conversation about ${firstMessage ? firstMessage.substring(0, 50) : 'various topics'}.`;
  }
  
  // Create paragraph summary (2-5 sentences)
  let paragraphSummary = '';
  if (accomplishments.length > 0) {
    paragraphSummary = `This conversation focused on ${accomplishments[0]}. `;
    if (uniqueFiles.length > 0) {
      paragraphSummary += `Key files involved include ${uniqueFiles.join(', ')}. `;
    }
    if (accomplishments.length > 1) {
      paragraphSummary += `Additional work included ${accomplishments.slice(1, 3).join(' and ')}. `;
    }
    paragraphSummary += `The discussion covered ${messages.length} messages with ${accomplishments.length} main accomplishments.`;
  } else if (uniqueFiles.length > 0) {
    paragraphSummary = `This conversation involved working with ${uniqueFiles.join(', ')}. `;
    paragraphSummary += `The discussion spanned ${messages.length} messages covering file modifications and updates.`;
  } else {
    paragraphSummary = `A ${messages.length}-message conversation that began with "${(firstMessage || '').substring(0, 100)}...". `;
    paragraphSummary += `The discussion covered various topics and technical implementations.`;
  }
  
  // Create bullet summary (up to 8 bullets)
  const bulletSummary = [];
  accomplishments.slice(0, 5).forEach(acc => {
    bulletSummary.push(`Implemented ${acc}`);
  });
  
  if (bulletSummary.length < 8 && uniqueFiles.length > 0) {
    uniqueFiles.slice(0, 3).forEach(file => {
      if (bulletSummary.length < 8) {
        bulletSummary.push(`Worked with ${file}`);
      }
    });
  }
  
  // Add message count if room
  if (bulletSummary.length < 8) {
    bulletSummary.push(`${messages.length} total messages exchanged`);
  }
  
  return {
    oneLineSummary,
    paragraphSummary,
    bulletSummary
  };
}

// Route to analyze out-of-date chats (can still be called manually)
app.get('/analyze-chats', async (req, res) => {
  try {
    const results = await runAnalysis();
    
    if (results.numberOfChatsUpdated === 0) {
      res.json({
        ...results,
        message: 'All chats are up to date'
      });
    } else {
      res.json(results);
    }
    
  } catch (error) {
    console.error('Error in analyze-chats:', error);
    res.status(500).json({ error: 'Error analyzing chats', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude Chat Viewer running at http://localhost:${PORT}`);
  console.log(`Reading chats from: ${CLAUDE_BASE_PATH}`);
});