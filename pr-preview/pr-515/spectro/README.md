# Spectro JSW

A faithful ZX Spectrum-inspired implementation of Jet Set Willy, complete with authentic color clash, ZX Spectrum resolution, and retro aesthetics.

## Features

- 🎮 Authentic ZX Spectrum graphics (256×192 pixels)
- 🎨 True-to-life color clash simulation
- 🕹️ Classic platformer gameplay
- 🔊 Retro sound effects
- 📱 Responsive design with touch controls for mobile
- 🖥️ Keyboard, touch, and gamepad support
- 🧪 Unit testing with Jest

## Technical Details

This project uses modern web technologies while faithfully recreating the technical limitations of the ZX Spectrum:

- HTML5 Canvas for rendering
- ZX Spectrum color palette (8 colors with bright variants)
- 32×24 character grid (8×8 pixel cells)
- Maximum of 2 colors per character cell (ink & paper)
- Attribute clash when sprites overlap character cells

## Game Controls

- **Arrow Keys** or **WASD**: Move Willy
- **Space** or **Up**: Jump
- **Enter** or **E**: Use doors
- **Escape** or **P**: Pause/Menu
- **R**: Reset current room

## Technical Architecture

The game is split into several modules:

- `spectrum.js`: Core ZX Spectrum display emulation
- `renderer.js`: Game rendering system
- `input.js`: Input handling (keyboard, touch, gamepad)
- `entities.js`: Game entity management
- `rooms.js`: Room layouts and data
- `game.js`: Main game controller

## Development

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/spectro-jsw.git
cd spectro-jsw

# Install dependencies
npm install

# Start the development server
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## Credits

This project is inspired by the original Jet Set Willy created by Matthew Smith for the ZX Spectrum in 1984.

## License

MIT