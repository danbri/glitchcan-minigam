// FINK Player Configuration
window.FinkConfig = {
    // Sandbox settings
    SANDBOX_TIMEOUT_MS: 15000,
    
    // Default paths - simplified, no form fields
    DEFAULT_MEDIA_PATH: '', // Empty - let stories specify their own BASEHREF
    DEFAULT_FINK_FILE: '../toc.fink.js',
    
    // Choice emoji mapping
    emojiMap: {
        'go': '🚶', 'walk': '🚶‍♂️', 'run': '🏃‍♀️', 'look': '👀', 'search': '🔍',
        'take': '🤲', 'grab': '✊', 'hold': '👐', 'find': '🔎',
        'talk': '💬', 'ask': '❓', 'tell': '🗣️', 'speak': '🗯️',
        'listen': '👂', 'hear': '🔊', 'watch': '👁️', 'observe': '🧐',
        'wait': '⏳', 'stay': '⌛', 'hide': '🙈', 'escape': '🏃‍♂️',
        'open': '🔓', 'close': '🔒', 'climb': '🧗‍♀️', 'jump': '⏫',
        'drink': '🥤', 'eat': '🍽️', 'sleep': '😴', 'wake': '⏰',
        'use': '🔧', 'call': '📞', 'push': '👉', 'pull': '👈',
        'read': '📚', 'write': '✍️', 'follow': '🦮', 'lead': '🧭',
        'right': '➡️', 'left': '⬅️', 'up': '⬆️', 'down': '⬇️',
        'yes': '✅', 'no': '❌', 'maybe': '❓', 'help': '🆘',
        'restart': '🔄'
    },
    
    // Default emojis for choices
    defaultEmojis: ['🚀', '🧩', '🎯'],
    
    // Debug settings
    MAX_DEBUG_MESSAGES: 100,
    KEEP_DEBUG_MESSAGES: 50
};
