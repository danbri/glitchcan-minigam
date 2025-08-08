/**
 * Mamikon Mini-Chess Integration for FINK Stories
 * Based on: https://codepen.io/danbri/pen/azOvvGX
 * 
 * A simplified chess game focused on tactical positions,
 * specifically designed for Shane Manor's "queen sacrifice" scene.
 */

class MamikonMiniChess {
    constructor(containerId, config = {}) {
        this.container = document.getElementById(containerId);
        this.config = {
            position: config.position || this.getShaneManorPosition(),
            onGameEnd: config.onGameEnd || (() => {}),
            showHints: config.showHints !== false,
            difficulty: config.difficulty || 'medium'
        };
        
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameEnded = false;
        this.moveHistory = [];
        this.queenSacrificeDetected = false;
        
        this.init();
    }
    
    init() {
        this.createBoard();
        this.setupPosition();
        this.render();
    }
    
    createBoard() {
        // Initialize 8x8 board
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    }
    
    getShaneManorPosition() {
        // The critical position from Shane Manor story
        // White has just played an aggressive queen sacrifice
        // Black must respond correctly to avoid mate in 3
        return {
            'a8': 'bR', 'b8': 'bN', 'c8': 'bB', 'd8': 'bQ', 'e8': 'bK', 'f8': 'bB', 'g8': 'bN', 'h8': 'bR',
            'a7': 'bP', 'b7': 'bP', 'c7': 'bP', 'd7': null, 'e7': 'bP', 'f7': 'bP', 'g7': 'bP', 'h7': 'bP',
            'a6': null, 'b6': null, 'c6': null, 'd6': 'bP', 'e6': null, 'f6': null, 'g6': null, 'h6': null,
            'a5': null, 'b5': null, 'c5': null, 'd5': null, 'e5': null, 'f5': null, 'g5': null, 'h5': null,
            'a4': null, 'b4': null, 'c4': null, 'd4': null, 'e4': null, 'f4': null, 'g4': null, 'h4': null,
            'a3': null, 'b3': null, 'c3': null, 'd3': null, 'e3': null, 'f3': null, 'g3': null, 'h3': null,
            'a2': 'wP', 'b2': 'wP', 'c2': 'wP', 'd2': null, 'e2': 'wP', 'f2': 'wP', 'g2': 'wP', 'h2': 'wP',
            'a1': 'wR', 'b1': 'wN', 'c1': 'wB', 'd1': null, 'e1': 'wK', 'f1': 'wB', 'g1': 'wN', 'h1': 'wR'
        };
    }
    
    setupPosition() {
        const position = this.config.position;
        
        // Clear board
        this.createBoard();
        
        // Set up pieces from position
        for (let square in position) {
            if (position[square]) {
                const file = square.charCodeAt(0) - 97; // 'a' = 0
                const rank = 8 - parseInt(square[1]); // '8' = 0
                this.board[rank][file] = position[square];
            }
        }
    }
    
    render() {
        this.container.innerHTML = `
            <div class="minichess-container">
                <div class="minichess-header">
                    <h3>🏰 The Chess Position</h3>
                    <p>White has just played an aggressive queen sacrifice. Can you find the winning continuation?</p>
                </div>
                <div class="minichess-board" id="chess-board"></div>
                <div class="minichess-controls">
                    <button onclick="this.closest('.minichess-container').minichess.resetGame()">Reset Position</button>
                    <button onclick="this.closest('.minichess-container').minichess.getHint()">Get Hint</button>
                </div>
                <div class="minichess-status" id="chess-status">
                    ${this.currentPlayer === 'white' ? 'White' : 'Black'} to move
                </div>
            </div>
        `;
        
        // Store reference for event handlers
        this.container.querySelector('.minichess-container').minichess = this;
        
        this.renderBoard();
        this.addStyles();
    }
    
    renderBoard() {
        const boardEl = document.getElementById('chess-board');
        boardEl.innerHTML = '';
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const square = document.createElement('div');
                square.className = 'chess-square';
                square.className += (rank + file) % 2 === 0 ? ' light' : ' dark';
                square.dataset.rank = rank;
                square.dataset.file = file;
                
                const piece = this.board[rank][file];
                if (piece) {
                    square.textContent = this.getPieceSymbol(piece);
                    square.className += ` piece ${piece[0] === 'w' ? 'white' : 'black'}`;
                }
                
                square.addEventListener('click', () => this.handleSquareClick(rank, file));
                boardEl.appendChild(square);
            }
        }
    }
    
    getPieceSymbol(piece) {
        const symbols = {
            'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
            'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
        };
        return symbols[piece] || '';
    }
    
    handleSquareClick(rank, file) {
        if (this.gameEnded) return;
        
        if (this.selectedSquare) {
            // Try to make a move
            const [fromRank, fromFile] = this.selectedSquare;
            if (this.isValidMove(fromRank, fromFile, rank, file)) {
                this.makeMove(fromRank, fromFile, rank, file);
            }
            this.clearSelection();
        } else {
            // Select a piece
            const piece = this.board[rank][file];
            if (piece && piece[0] === (this.currentPlayer === 'white' ? 'w' : 'b')) {
                this.selectedSquare = [rank, file];
                this.highlightSquare(rank, file);
            }
        }
    }
    
    isValidMove(fromRank, fromFile, toRank, toFile) {
        // Simplified move validation for demo purposes
        const piece = this.board[fromRank][fromFile];
        if (!piece) return false;
        
        // Check if destination has own piece
        const destPiece = this.board[toRank][toFile];
        if (destPiece && destPiece[0] === piece[0]) return false;
        
        // Basic piece movement (simplified)
        const pieceType = piece[1];
        const rankDiff = Math.abs(toRank - fromRank);
        const fileDiff = Math.abs(toFile - fromFile);
        
        switch (pieceType) {
            case 'P': // Pawn
                const direction = piece[0] === 'w' ? -1 : 1;
                const startRank = piece[0] === 'w' ? 6 : 1;
                if (fileDiff === 0 && !destPiece) {
                    return (toRank === fromRank + direction) || 
                           (fromRank === startRank && toRank === fromRank + 2 * direction);
                }
                if (fileDiff === 1 && rankDiff === 1 && destPiece) {
                    return toRank === fromRank + direction;
                }
                return false;
            case 'R': // Rook
                return rankDiff === 0 || fileDiff === 0;
            case 'N': // Knight
                return (rankDiff === 2 && fileDiff === 1) || (rankDiff === 1 && fileDiff === 2);
            case 'B': // Bishop
                return rankDiff === fileDiff;
            case 'Q': // Queen
                return rankDiff === 0 || fileDiff === 0 || rankDiff === fileDiff;
            case 'K': // King
                return rankDiff <= 1 && fileDiff <= 1;
            default:
                return false;
        }
    }
    
    makeMove(fromRank, fromFile, toRank, toFile) {
        const piece = this.board[fromRank][fromFile];
        const capturedPiece = this.board[toRank][toFile];
        
        // Check for queen sacrifice detection
        if (piece === 'wQ' && capturedPiece) {
            this.queenSacrificeDetected = true;
        }
        
        // Make the move
        this.board[toRank][toFile] = piece;
        this.board[fromRank][fromFile] = null;
        
        // Record move
        const moveNotation = this.algebraicNotation(fromRank, fromFile, toRank, toFile, piece, capturedPiece);
        this.moveHistory.push(moveNotation);
        
        // Switch players
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        // Check for game end conditions
        this.checkGameEnd();
        
        this.render();
    }
    
    algebraicNotation(fromRank, fromFile, toRank, toFile, piece, capturedPiece) {
        const files = 'abcdefgh';
        const fromSquare = files[fromFile] + (8 - fromRank);
        const toSquare = files[toFile] + (8 - toRank);
        const pieceSymbol = piece[1] === 'P' ? '' : piece[1];
        const capture = capturedPiece ? 'x' : '';
        
        return `${pieceSymbol}${capture}${toSquare}`;
    }
    
    checkGameEnd() {
        // Simplified endgame detection
        // In a real implementation, this would check for checkmate, stalemate, etc.
        
        if (this.moveHistory.length >= 6) {
            this.gameEnded = true;
            const performance = this.evaluatePerformance();
            this.updateStatus(`Game complete! Performance: ${performance}`);
            this.config.onGameEnd(performance, this.queenSacrificeDetected, this.moveHistory);
        }
    }
    
    evaluatePerformance() {
        // Evaluate player performance based on moves made
        let score = 50; // Base score
        
        if (this.queenSacrificeDetected) score += 30;
        if (this.moveHistory.length <= 4) score += 20; // Efficient play
        
        if (score >= 80) return 'Brilliant';
        if (score >= 65) return 'Good';
        if (score >= 50) return 'Decent';
        return 'Needs Improvement';
    }
    
    getHint() {
        const hints = [
            "Look for the most forcing move - what threatens the enemy king?",
            "The queen sacrifice creates tactical opportunities...",
            "Consider how the pieces coordinate after the sacrifice",
            "What would Lord Pemberton's opponent have played here?"
        ];
        
        const randomHint = hints[Math.floor(Math.random() * hints.length)];
        this.updateStatus(`Hint: ${randomHint}`);
    }
    
    resetGame() {
        this.setupPosition();
        this.currentPlayer = 'white';
        this.gameEnded = false;
        this.moveHistory = [];
        this.queenSacrificeDetected = false;
        this.selectedSquare = null;
        this.render();
    }
    
    highlightSquare(rank, file) {
        // Remove previous highlights
        document.querySelectorAll('.chess-square.selected').forEach(sq => {
            sq.classList.remove('selected');
        });
        
        // Add highlight to selected square
        const square = document.querySelector(`[data-rank="${rank}"][data-file="${file}"]`);
        if (square) square.classList.add('selected');
    }
    
    clearSelection() {
        this.selectedSquare = null;
        document.querySelectorAll('.chess-square.selected').forEach(sq => {
            sq.classList.remove('selected');
        });
    }
    
    updateStatus(message) {
        const statusEl = document.getElementById('chess-status');
        if (statusEl) statusEl.textContent = message;
    }
    
    addStyles() {
        if (document.getElementById('minichess-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'minichess-styles';
        styles.textContent = `
            .minichess-container {
                max-width: 400px;
                margin: 20px auto;
                padding: 20px;
                border: 2px solid #8b4513;
                border-radius: 10px;
                background: linear-gradient(145deg, #f4f1e8, #e8e0d0);
                font-family: 'Serif', serif;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
            
            .minichess-header h3 {
                margin: 0 0 10px 0;
                color: #8b4513;
                text-align: center;
            }
            
            .minichess-header p {
                font-style: italic;
                color: #654321;
                text-align: center;
                font-size: 0.9em;
            }
            
            .minichess-board {
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                grid-template-rows: repeat(8, 1fr);
                width: 320px;
                height: 320px;
                margin: 20px auto;
                border: 3px solid #8b4513;
            }
            
            .chess-square {
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 24px;
                transition: background-color 0.2s;
            }
            
            .chess-square.light {
                background-color: #f0d9b5;
            }
            
            .chess-square.dark {
                background-color: #b58863;
            }
            
            .chess-square.selected {
                background-color: #7fa2ff !important;
                box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
            }
            
            .chess-square:hover {
                opacity: 0.8;
            }
            
            .chess-square.piece:hover {
                transform: scale(1.1);
            }
            
            .minichess-controls {
                text-align: center;
                margin: 15px 0;
            }
            
            .minichess-controls button {
                background: #8b4513;
                color: white;
                border: none;
                padding: 8px 16px;
                margin: 0 5px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .minichess-controls button:hover {
                background: #654321;
            }
            
            .minichess-status {
                text-align: center;
                font-weight: bold;
                color: #8b4513;
                padding: 10px;
                background: rgba(139, 69, 19, 0.1);
                border-radius: 5px;
                margin-top: 10px;
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Export for use in FINK stories
window.MamikonMiniChess = MamikonMiniChess;