/**
 * Input.js - Input handling for keyboard and touch controls
 * Manages keyboard, touch, and gamepad inputs with support for various controllers
 */

const Input = (() => {
  // Input state 
  const keyState = {};
  const touchState = {};
  let gamepadState = null;
  
  // Aliases for different control schemes
  const keyAliases = {
    'left': ['ArrowLeft', 'KeyA', 'KeyQ'],
    'right': ['ArrowRight', 'KeyD'],
    'up': ['ArrowUp', 'KeyW', 'KeyZ'],
    'down': ['ArrowDown', 'KeyS'],
    'jump': ['Space', ' ', 'ArrowUp', 'KeyW', 'KeyZ'],  // Space as primary jump key - include both event.code and event.key options
    'action': ['Enter', 'KeyE', 'KeyX'],
    'menu': ['Escape', 'KeyP'],
    'restart': ['KeyR']
  };
  
  // Vibration settings
  let vibrationEnabled = true;
  
  /**
   * Initialize input handling
   */
  function initialize() {
    // Set up keyboard event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Set up touch inputs
    setupTouchControls();
    
    // Set up gamepad handling
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
  }
  
  /**
   * Handle keyboard key down event
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeyDown(event) {
    // Prevent default browser behavior for game controls
    if (Object.values(keyAliases).some(aliases => 
      aliases.includes(event.code) || 
      aliases.includes(event.key) || 
      aliases.includes(event.keyCode?.toString())
    )) {
      event.preventDefault();
    }
    
    // Special handling for Space key which is super important for jumping
    if (event.code === 'Space' || event.key === ' ' || event.keyCode === 32) {
      keyState['Space'] = true;
      keyState[' '] = true;
      keyState['32'] = true;
      console.log('Jump key pressed!');
    } else {
      keyState[event.code] = true;
      keyState[event.key] = true;
      if (event.keyCode) keyState[event.keyCode.toString()] = true;
    }
  }
  
  /**
   * Handle keyboard key up event
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeyUp(event) {
    // Special handling for Space key
    if (event.code === 'Space' || event.key === ' ' || event.keyCode === 32) {
      keyState['Space'] = false;
      keyState[' '] = false;
      keyState['32'] = false;
    } else {
      keyState[event.code] = false;
      keyState[event.key] = false;
      if (event.keyCode) keyState[event.keyCode.toString()] = false;
    }
  }
  
  /**
   * Set up touch control event handlers
   */
  function setupTouchControls() {
    // Set up D-pad buttons
    setupTouchButton('left-btn', 'left');
    setupTouchButton('right-btn', 'right');
    setupTouchButton('up-btn', 'up');
    setupTouchButton('down-btn', 'down');
    setupTouchButton('jump-btn', 'jump');
  }
  
  /**
   * Set up event handlers for a touch button
   * @param {string} buttonId - Button element ID
   * @param {string} action - Action to trigger
   */
  function setupTouchButton(buttonId, action) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    // Use touchstart/touchend for mobile devices
    button.addEventListener('touchstart', (event) => {
      event.preventDefault();
      touchState[action] = true;
      
      // If vibration is enabled and supported, give haptic feedback
      if (vibrationEnabled && navigator.vibrate) {
        navigator.vibrate(20);
      }
    });
    
    button.addEventListener('touchend', (event) => {
      event.preventDefault();
      touchState[action] = false;
    });
    
    button.addEventListener('touchcancel', (event) => {
      event.preventDefault();
      touchState[action] = false;
    });
    
    // Also support mouse for testing on desktop
    button.addEventListener('mousedown', (event) => {
      touchState[action] = true;
    });
    
    button.addEventListener('mouseup', (event) => {
      touchState[action] = false;
    });
    
    // Prevent context menu on long press
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }
  
  /**
   * Handle gamepad connection
   * @param {GamepadEvent} event - Gamepad connection event
   */
  function handleGamepadConnected(event) {
    console.log(`Gamepad connected: ${event.gamepad.id}`);
    gamepadState = {
      gamepad: event.gamepad,
      connected: true
    };
  }
  
  /**
   * Handle gamepad disconnection
   * @param {GamepadEvent} event - Gamepad disconnection event
   */
  function handleGamepadDisconnected(event) {
    console.log(`Gamepad disconnected: ${event.gamepad.id}`);
    gamepadState = null;
  }
  
  /**
   * Update gamepad state if connected
   */
  function updateGamepadState() {
    if (!gamepadState || !gamepadState.connected) return;
    
    // Get the latest gamepad state
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;
    
    const gamepad = gamepads[gamepadState.gamepad.index];
    if (!gamepad) return;
    
    // Update gamepad state (buttons and axes)
    gamepadState.buttons = Array.from(gamepad.buttons).map(b => b.pressed);
    gamepadState.axes = Array.from(gamepad.axes);
  }
  
  /**
   * Check if a specific action is active
   * @param {string} action - Action to check 
   * @returns {boolean} True if action is active
   */
  function isActionActive(action) {
    // First check touch state
    if (touchState[action]) return true;
    
    // Special case for jump action to ensure it works with Space key
    if (action === 'jump' && (keyState['Space'] || keyState[' '] || keyState['32'])) {
      return true;
    }
    
    // Then check keyboard aliases
    if (keyAliases[action]) {
      for (const key of keyAliases[action]) {
        if (keyState[key]) return true;
      }
    }
    
    // Finally check gamepad
    if (gamepadState && gamepadState.connected) {
      // Map gamepad buttons/axes to actions
      switch (action) {
        case 'left':
          return gamepadState.buttons[14] || (gamepadState.axes[0] < -0.5);
        case 'right':
          return gamepadState.buttons[15] || (gamepadState.axes[0] > 0.5);
        case 'up':
          return gamepadState.buttons[12] || (gamepadState.axes[1] < -0.5);
        case 'down':
          return gamepadState.buttons[13] || (gamepadState.axes[1] > 0.5);
        case 'jump':
          return gamepadState.buttons[0] || gamepadState.buttons[1];
        case 'action':
          return gamepadState.buttons[2] || gamepadState.buttons[3];
        case 'menu':
          return gamepadState.buttons[9];
        case 'restart':
          return gamepadState.buttons[8];
      }
    }
    
    return false;
  }
  
  /**
   * Check if a specific key is pressed
   * @param {string} keyCode - Key code to check
   * @returns {boolean} True if key is pressed
   */
  function isKeyPressed(keyCode) {
    return keyState[keyCode] === true;
  }
  
  /**
   * Get axis value for horizontal movement (-1 to 1)
   * @returns {number} Axis value (-1 = left, 0 = neutral, 1 = right)
   */
  function getHorizontalAxis() {
    let value = 0;
    
    // Check keyboard/touch
    if (isActionActive('left')) value -= 1;
    if (isActionActive('right')) value += 1;
    
    // Check gamepad analog for finer control
    if (gamepadState && gamepadState.connected && gamepadState.axes) {
      const gamepadValue = gamepadState.axes[0];
      if (Math.abs(gamepadValue) > 0.1) {
        value = gamepadValue;
      }
    }
    
    return value;
  }
  
  /**
   * Get axis value for vertical movement (-1 to 1)
   * @returns {number} Axis value (-1 = up, 0 = neutral, 1 = down)
   */
  function getVerticalAxis() {
    let value = 0;
    
    // Check keyboard/touch
    if (isActionActive('up')) value -= 1;
    if (isActionActive('down')) value += 1;
    
    // Check gamepad analog for finer control
    if (gamepadState && gamepadState.connected && gamepadState.axes) {
      const gamepadValue = gamepadState.axes[1];
      if (Math.abs(gamepadValue) > 0.1) {
        value = gamepadValue;
      }
    }
    
    return value;
  }
  
  /**
   * Check if an action was just pressed this frame
   * (Requires update to be called every frame)
   */
  const prevActionState = {};
  
  /**
   * Check if action was just activated this frame
   * @param {string} action - Action to check
   * @returns {boolean} True if action was just activated
   */
  function wasActionJustActivated(action) {
    const isActive = isActionActive(action);
    const wasActive = prevActionState[action] || false;
    
    // Store for next frame
    prevActionState[action] = isActive;
    
    return isActive && !wasActive;
  }
  
  /**
   * Update input state (call every frame)
   */
  function update() {
    updateGamepadState();
  }
  
  /**
   * Reset all input states
   */
  function reset() {
    // Clear key states
    for (const key in keyState) {
      keyState[key] = false;
    }
    
    // Clear touch states
    for (const touch in touchState) {
      touchState[touch] = false;
    }
    
    // Reset previous action states
    for (const action in prevActionState) {
      prevActionState[action] = false;
    }
  }
  
  /**
   * Toggle vibration feedback
   * @param {boolean} enabled - Whether vibration should be enabled
   */
  function setVibration(enabled) {
    vibrationEnabled = enabled;
  }
  
  /**
   * Trigger device vibration if supported and enabled
   * @param {number} duration - Vibration duration in ms
   * @param {Array} pattern - Optional vibration pattern
   */
  function vibrate(duration, pattern) {
    if (!vibrationEnabled || !navigator.vibrate) return;
    
    if (pattern) {
      navigator.vibrate(pattern);
    } else {
      navigator.vibrate(duration);
    }
  }
  
  // Public API
  return {
    initialize,
    isActionActive,
    wasActionJustActivated,
    isKeyPressed,
    getHorizontalAxis,
    getVerticalAxis,
    update,
    reset,
    setVibration,
    vibrate
  };
})();

// For use in Node.js environment (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Input;
}