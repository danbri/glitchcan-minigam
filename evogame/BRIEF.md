# alife games

An artificial life simulator where the organisms are playable browser minigames and the selection pressure is human enjoyment.

## Architecture

**Static HTML shell** (`index.html`) hosted on GitHub Pages. No server. All game state lives in IndexedDB in the user's browser.

**Claude Code** operates the evolution engine by automating the user's real desktop browser via Playwright MCP. It reads the game pool state, generates new games, performs crossover breeding, and culls unfit games.

The human user is the fitness function -- they play the games and vote thumbs up/down.

## How it works

1. A pool of game definitions exists in the browser's IndexedDB.
2. Each definition has a short natural language description + a self-contained HTML/JS/CSS blob rendered into a sandboxed iframe.
3. The user scrolls a feed of game cards. Top 2 games have their iframes loaded and running. The rest are paused/greyed out. Max 10 visible.
4. Each card has thumbs-up / thumbs-down buttons.
5. Claude Code reads the pool state via `page.evaluate(() => window.alife.getPool())`.
6. Claude Code decides what to do: breed two thriving games, generate a fresh one, or cull dying ones.
7. Claude Code generates the game blob (self-contained HTML) and injects it via `page.evaluate(...)`.
8. The new game appears at the top of the feed. The user plays and votes. Repeat.

## The browser API

The page exposes `window.alife` with these methods (all async):

- `addGame({id?, title, description, blob, parents?, generation})` -- inject a new game
- `getPool()` -- all games with vote counts and status
- `getAlive()` -- only alive games
- `getThriving()` -- alive games with net positive votes (min 1 vote)
- `getThrivingPairs()` -- all candidate parent pairs for crossover
- `killGame(id)` -- mark a game as dead (hidden from feed)
- `deleteGame(id)` -- hard delete
- `reset()` -- clear everything
- `getStats()` -- summary: {total, alive, dead, thriving, maxGeneration, totalVotes}

## Game blob constraints

When generating game HTML blobs, they must:

- Be a single self-contained HTML document (inline all JS/CSS)
- Fit a square viewport (~480x480px iframe)
- Use canvas, WebGL, SVG, or DOM for rendering -- no external dependencies
- Support mouse/touch input, or be purely passive/animated
- Include no network requests
- Be immediately understandable (no instructions needed, or a one-line overlay hint that fades)
- Be small (under 15KB ideally)
- Use `<html><head><style>...</style></head><body>...<script>...</script></body></html>` structure

## Evolution rules

### Fitness
A game is "thriving" if `votes.up > votes.down` and it has at least 1 total vote. Fitness score = votes.up - votes.down.

### Crossover
Select two thriving parents (fitness-weighted). Read both descriptions. Write a new description that combines the most interesting mechanic from each into something coherent (not a random mash-up). Then render the child description into a blob. The child's generation = max(parent_a.gen, parent_b.gen) + 1.

### Genesis
Generate a novel game concept from scratch. Try to diversify -- look at what's currently in the pool and aim for something different. Generation = 0.

### Culling
Kill games with net score <= -3 (3 more downvotes than upvotes). Also cull if population exceeds 20 alive games (kill the lowest-fitness games).

### Pacing
- Breed: when 2+ thriving games exist, crossover is the primary mechanism
- Genesis: inject a new random game when population < 5, or at ~1/3 the rate of breeding
- Cull: check after every evolution step

## Claude Code workflow

### Setup
1. Push `index.html` to a GitHub Pages repo (or serve locally with `npx serve`)
2. Open Claude Code in the project directory
3. Use Playwright MCP to open the page in the user's browser

### Evolution step (the main loop)

```
1. Navigate to the alife games page (or confirm it's already open)
2. Read pool state: page.evaluate(() => window.alife.getStats())
3. Decide action:
   - If alive < 5: genesis (seed the pool)
   - If thriving >= 2: crossover (breed) -- primary action
   - If alive > 20: cull lowest fitness
   - Occasionally (1 in 3 steps): genesis for diversity
4. For genesis:
   a. Invent a 2-3 sentence game description
   b. Generate a self-contained HTML blob that implements it
   c. Inject: page.evaluate((g) => window.alife.addGame(g), gameData)
5. For crossover:
   a. Read thriving pairs: page.evaluate(() => window.alife.getThrivingPairs())
   b. Select a pair (fitness-weighted or random)
   c. Write a new description combining elements of both parents
   d. Generate HTML blob
   e. Inject with parents and generation set
6. For culling:
   a. Read pool: page.evaluate(() => window.alife.getPool())
   b. Find games with net votes <= -3
   c. Kill them: page.evaluate((id) => window.alife.killGame(id), id)
7. Pause and tell the user to play + vote, or loop
```

### Game description examples

Good game descriptions are short, concrete, and implementable:

- "Colored particles drift down like rain. Tap anywhere to create a circular repulsion field that pushes them away. Score increases while no particles touch the bottom edge."
- "A grid of squares slowly fills with color from the center outward. Click any square to reset it to black. Try to keep the grid from becoming fully colored."
- "Two orbiting dots leave trails. The trails fade over time. Tap to reverse the direction of one orbit. The patterns created are purely aesthetic."
- "A snake made of connected circles follows your mouse cursor with springy physics. The tail whips around with momentum. Passive toy, no score."
- "Bubbles rise from the bottom. Each has a number (1-9). Click two bubbles whose numbers sum to 10 to pop them both. Missed bubbles that reach the top cost a life. Three lives."
- "A generative tree grows from the bottom. Every few seconds a new branch splits off. Click branches to prune them. The tree's shape emerges from your pruning choices."

### Generating the HTML blob

When you generate the blob, think about:
- Start with a working minimal version, then add polish
- Use requestAnimationFrame for animation loops
- Handle both mouse and touch events
- Dark background (#000 or near-black) works best in the feed
- Keep text minimal, large, and high-contrast
- If there's a score, display it clearly
- Make it feel alive within the first second

## File structure

```
alife-games/
  index.html          -- the static shell (deploy to GitHub Pages)
  BRIEF.md            -- this file (project context for Claude Code)
  seed_games.json     -- optional pre-made game descriptions for bootstrapping
```

## Key principle

The LLM is both the genome (it encodes descriptions into phenotypes/blobs) and the evolutionary engine (it decides what to breed, what to invent, what to kill). The human provides selection pressure through play and voting. The browser is the environment where fitness is tested.
