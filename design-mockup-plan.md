# Design Mockup Plan - Dark Mode with V1 Features

## Changes to implement (keeping current dark theme):

### 1. Header Section
- Replace current centered "Claude Code Chat History" with a smaller, left-aligned header similar to V1
- Add a subtitle "Browse your Claude Code conversations" below it
- Keep dark background (#2b2b2b)

### 2. Stats Row (New Addition)
- Add a second row with two stat cards showing:
  - Total Conversations (count)
  - Total Messages (count)
- Style similar to V1 but with dark theme colors

### 3. Conversations Section
- Change "Recent Conversations" to just "Conversations"
- Keep our current format but wrap each chat in a rounded rectangle card
- Keep our blue date, one-liner format, and bulleted summaries

### 4. Chat Cards (Each conversation)
- Wrap each chat entry in a rounded rectangle with subtle border
- Add to each card:
  - Message count (like "📝 285 messages")
  - Download link (📥 for markdown export)
- Keep our current layout:
  - Blue date - First message
  - 💡 Summary
  - • Bullet points

### 5. Visual Structure
```
┌─────────────────────────────────────────┐
│ 🤖 Claude Chat History                  │
│ Browse your Claude Code conversations    │
├─────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    │
│  │      9      │    │    3687     │    │
│  │Conversations│    │  Messages   │    │
│  └─────────────┘    └─────────────┘    │
├─────────────────────────────────────────┤
│ Conversations                           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Jul 7, 2025 11:43 AM - I'm testing..│ │
│ │ 💡 Summary                          │ │
│ │ • another folder...                 │ │
│ │ • new repo and folder...            │ │
│ │ • clean summary file...             │ │
│ │ 📝 285 messages        📥 Download   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Jul 7, 2025 1:46 AM - first quest...│ │
│ │ 💡 Summary                          │ │
│ │ • discussed flutter...              │ │
│ │ 📝 53 messages         📥 Download   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Key Points:
- Keep all current dark mode colors
- Keep blue dates (#4a90e2)
- Keep current spacing and layout within cards
- Just add the card wrapper, stats, and download functionality
- Download should export chat as .md file