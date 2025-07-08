// Live find functionality for homepage
document.addEventListener('DOMContentLoaded', function() {
    const findLink = document.querySelector('.find-link');
    const findInputContainer = document.querySelector('.find-input-container');
    const findInput = document.querySelector('.find-input');
    const findResultsCount = document.querySelector('.find-results-count');
    const chatList = document.querySelector('.chat-list');
    const chatCards = document.querySelectorAll('.chat-card');
    
    let isInFindMode = false;
    let originalOrder = [];
    let currentSearchTerm = '';
    
    // Store original order
    chatCards.forEach((card, index) => {
        originalOrder.push({
            card: card,
            originalIndex: index
        });
    });
    
    if (findLink) {
        findLink.addEventListener('click', function(e) {
            e.preventDefault();
            toggleFindMode();
        });
    }
    
    if (findInput) {
        let searchTimeout;
        findInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performFind(this.value.trim());
            }, 200); // 200ms debounce
        });
        
        findInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                exitFindMode();
            }
        });
    }
    
    function toggleFindMode() {
        if (isInFindMode) {
            exitFindMode();
        } else {
            enterFindMode();
        }
    }
    
    function enterFindMode() {
        isInFindMode = true;
        findLink.textContent = '✕ Exit Find';
        findLink.title = 'Exit find mode';
        findInputContainer.style.display = 'block';
        findInput.focus();
    }
    
    function exitFindMode() {
        isInFindMode = false;
        findLink.textContent = '🔍 Find';
        findLink.title = 'Find in conversations';
        findInputContainer.style.display = 'none';
        findInput.value = '';
        findResultsCount.textContent = '';
        
        // Hide all match count lines
        document.querySelectorAll('.match-count-line').forEach(line => {
            line.style.display = 'none';
        });
        
        // Restore original order
        restoreOriginalOrder();
    }
    
    // Add click handler for chat links to pass search term
    document.addEventListener('click', function(e) {
        const chatLink = e.target.closest('.chat-link');
        if (chatLink && isInFindMode && currentSearchTerm) {
            e.preventDefault();
            const href = chatLink.getAttribute('href');
            const searchUrl = `${href}?search=${encodeURIComponent(currentSearchTerm)}`;
            window.location.href = searchUrl;
        }
    });
    
    function performFind(searchTerm) {
        currentSearchTerm = searchTerm;
        
        if (!searchTerm) {
            // No search term - show all in original order
            chatCards.forEach(card => {
                card.style.display = 'block';
                card.querySelector('.match-count-line').style.display = 'none';
            });
            findResultsCount.textContent = '';
            restoreOriginalOrder();
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        const results = [];
        let totalMatches = 0;
        let visibleChats = 0;
        
        chatCards.forEach(card => {
            // Use the full searchable text that includes all messages
            const searchableText = (card.dataset.searchable || '').toLowerCase();
            
            // Count matches
            const matches = countMatches(searchableText, searchLower);
            
            if (matches > 0) {
                results.push({
                    card: card,
                    matches: matches
                });
                totalMatches += matches;
                visibleChats++;
                
                // Show match count
                const matchCountLine = card.querySelector('.match-count-line');
                const matchCount = card.querySelector('.match-count');
                matchCount.textContent = `🔍 ${matches} match${matches > 1 ? 'es' : ''} found`;
                matchCountLine.style.display = 'block';
                card.style.display = 'block';
            } else {
                // Hide non-matching chats
                card.style.display = 'none';
                card.querySelector('.match-count-line').style.display = 'none';
            }
        });
        
        // Update results count
        if (visibleChats > 0) {
            findResultsCount.textContent = `${totalMatches} match${totalMatches > 1 ? 'es' : ''} in ${visibleChats} conversation${visibleChats > 1 ? 's' : ''}`;
        } else {
            findResultsCount.textContent = 'No matches found';
        }
        
        // Sort by match count (most matches first)
        sortByMatches(results);
    }
    
    function countMatches(text, searchTerm) {
        if (!searchTerm) return 0;
        const regex = new RegExp(escapeRegex(searchTerm), 'gi');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }
    
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
    }
    
    function sortByMatches(results) {
        // Sort by match count (descending)
        results.sort((a, b) => b.matches - a.matches);
        
        // Re-append cards in new order
        results.forEach(result => {
            chatList.appendChild(result.card);
        });
    }
    
    function restoreOriginalOrder() {
        // Sort by original index
        originalOrder.sort((a, b) => a.originalIndex - b.originalIndex);
        
        // Re-append in original order
        originalOrder.forEach(item => {
            chatList.appendChild(item.card);
        });
    }
});