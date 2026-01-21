// Chess Minigame - Iframe wrapper for minichess
// Handles postMessage communication with embedded chess game

window.ChessMinigame = {
    // State
    active: false,
    container: null,
    iframe: null,
    onComplete: null,
    iframeSrc: '../../thumbwar/minichess.html',

    // Initialize the minigame
    init(container) {
        this.container = container;

        // Create iframe if not exists
        if (!this.iframe) {
            this.iframe = document.createElement('iframe');
            this.iframe.id = 'chess-iframe';
            this.iframe.style.cssText = 'width:100%; height:100%; border:none;';
            this.container.appendChild(this.iframe);
        }

        // Listen for postMessage from chess game
        window.addEventListener('message', (e) => this.handleMessage(e));

        this.log('Chess minigame initialized');
    },

    // Start the game
    start(onComplete = null) {
        this.active = true;
        this.onComplete = onComplete;

        // Load minichess in iframe
        this.iframe.src = this.iframeSrc;
        this.container.style.display = 'flex';

        this.log('Chess game started');
    },

    // Handle postMessage from chess iframe
    handleMessage(e) {
        if (!this.active) return;

        if (e.data && (e.data.type === 'minichess-complete' || e.data.type === 'minichess-return')) {
            const won = e.data.won || false;
            this.log(`Chess game ended. Won: ${won}`);

            const result = {
                won: won,
                type: 'chess'
            };

            this.end(result);
        }
    },

    // End the game
    end(result = null) {
        this.log('Chess game ending');

        this.active = false;
        this.container.style.display = 'none';
        this.iframe.src = '';

        if (result && this.onComplete) {
            this.onComplete(result);
        }

        return result;
    },

    // Check if game is active
    isActive() {
        return this.active;
    },

    log(msg) {
        console.log(`[ChessMinigame] ${msg}`);
    }
};
