#!/bin/bash

# Script to automatically update index.html with all games in the repository
# Run this whenever you add a new game

echo "Updating index.html with all games..."

# Extract the header part of the current index.html (everything before the first game container)
HEADER=$(sed -n '1,/first-game-container/p' index.html)

# Start building the new index.html content
echo "$HEADER" > index.html.new

# Find all game directories
GAMES=$(find . -maxdepth 1 -type d -not -path "./.*" -not -path "." | sort)

for GAME_DIR in $GAMES; do
  GAME_NAME=$(basename "$GAME_DIR")
  
  # Skip directories that don't contain HTML files
  if [ ! -f "$GAME_DIR/$GAME_NAME.html" ] && [ "$(find "$GAME_DIR" -name "*.html" -maxdepth 1 | wc -l)" -eq 0 ]; then
    continue
  fi
  
  echo "Adding game: $GAME_NAME"
  
  # Try to extract title and description from HTML files
  HTML_FILE="$GAME_DIR/$GAME_NAME.html"
  if [ ! -f "$HTML_FILE" ]; then
    HTML_FILE=$(find "$GAME_DIR" -name "*.html" -maxdepth 1 | head -1)
  fi
  
  TITLE=$(echo "$GAME_NAME" | sed 's/\b\(.\)/\u\1/g' | sed 's/-/ /g')
  DESCRIPTION="A browser-based minigame"
  
  # Create a game container entry
  cat >> index.html.new << EOL
    <div class="game-container">
        <h2 class="game-title">$TITLE</h2>
        <div class="game-description">
            <p>$DESCRIPTION</p>
            <p><strong>Best played on:</strong> Any device</p>
            <p><strong>How to play:</strong> Open the game and follow on-screen instructions</p>
        </div>
EOL

  # Add links to all HTML files in the directory
  for HTML in $(find "$GAME_DIR" -name "*.html" -maxdepth 1); do
    BASENAME=$(basename "$HTML")
    BASENAME_NO_EXT="${BASENAME%.*}"
    BUTTON_TEXT="Play $BASENAME_NO_EXT"
    if [ "$BASENAME" = "$GAME_NAME.html" ]; then
      BUTTON_TEXT="Play $TITLE" 
    fi
    echo "        <a href=\"$GAME_NAME/$BASENAME\" class=\"play-button\">$BUTTON_TEXT</a>" >> index.html.new
  done
  
  # Add metadata div for GitHub Actions
  cat >> index.html.new << EOL
        <div class="game-meta" id="${GAME_NAME}-meta">
            <p>Loading file information...</p>
        </div>
    </div>

EOL
done

# Extract the footer part (repository info and footer sections)
FOOTER=$(sed -n '/repo-info/,$p' index.html)
echo "$FOOTER" >> index.html.new

# Replace the old index.html with the new one
mv index.html.new index.html

echo "Index.html updated successfully!"