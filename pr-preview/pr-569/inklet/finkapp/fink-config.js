// FINK Player Configuration - finkapp version
window.FinkConfig = {
    // Sandbox settings
    SANDBOX_TIMEOUT_MS: 15000,

    // Default paths - story specified BASEHREF takes precedence
    DEFAULT_MEDIA_PATH: '',
    DEFAULT_FINK_FILE: '../toc.fink.js',

    // Choice emoji mapping (for narrative choices)
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
        'restart': '🔄', 'mine': '⛏️', 'gems': '💎', 'play': '🎮',
        'explore': '🧭', 'enter': '🚪', 'exit': '🚪', 'back': '↩️'
    },

    // Default emojis for choices without keyword matches
    defaultEmojis: ['🚀', '🧩', '🎯', '✨', '🌟'],

    // Debug settings
    MAX_DEBUG_MESSAGES: 200,
    KEEP_DEBUG_MESSAGES: 100,

    // Minigame settings (moved from hardcoded values)
    MINIGAME: {
        gems: {
            spawnCount: 8,
            spawnInterval: 1500,
            maxGems: 15,
            timeout: 5000,
            emojis: ['💎', '💠', '🔷', '🔹']
        },
        mega: {
            spawnCount: 4,
            spawnInterval: 2000,
            maxGems: 10,
            timeout: 3000,
            emojis: ['👑', '💛', '🌟', '✨']
        }
    },

    // Foley default durations
    FOLEY_DEFAULT_DURATION: 60,

    // Audio settings
    AUDIO_FADE_DURATION: 2.0,

    // Local FINK files for dev panel quick load
    LOCAL_FINKS: [
        { name: '🏠 Bag End', path: 'bagend.fink.js' },
        { name: '🎮 Hampstead', path: 'hampstead.fink.js' },
        { name: '⛏️ Mudslide Mines', path: 'mudslidemines.fink.js' },
        { name: '🏞️ Riverbend', path: 'riverbend.fink.js' },
        { name: '🏚️ Shane Manor', path: 'shane-manor.fink.js' },
        { name: '📑 TOC', path: '../toc.fink.js' }
    ]
};
