# Usability Review - FINK Player
Date: 2026-01-22

## Summary
**Overall Usability Score: 7/10**

The FINK Player provides a visually distinctive retro-themed interactive fiction experience with generally good mobile responsiveness. The ZX Spectrum-inspired color scheme creates a cohesive aesthetic. Key strengths include good touch target sizing for main interactions and smooth animations. The main areas needing improvement are: navigation discoverability, loading state feedback, and some small touch targets for secondary controls.

## Screenshots

| Screenshot | Description |
|------------|-------------|
| `usability-01-initial-load-desktop.png` | Initial load state on desktop (1280x720) |
| `usability-02-content-loaded-desktop.png` | Content loaded with TOC choices visible |
| `usability-03-radial-menu-open.png` | Radial menu expanded showing 5 navigation options |
| `usability-04-after-choice-desktop.png` | Episodes submenu with 6 adventure options |
| `usability-05-dev-panel.png` | Developer panel with logs and configuration |
| `usability-06-breadcrumb-expanded.png` | Breadcrumb navigation (minimal visual change) |
| `usability-07-mobile-initial.png` | Mobile view (375x667) - good responsive layout |
| `usability-08-mobile-menu.png` | Mobile radial menu - appropriately sized |
| `usability-09-mobile-scrolled.png` | Mobile after scroll interaction |
| `usability-10-small-mobile.png` | Very small screen (320x568) - choices wrap correctly |
| `usability-11-tablet.png` | Tablet view (768x1024) - good proportions |

## Issues Found

### Critical

1. **Resource Loading Failures**
   - Console errors: `Failed to load resource: net::ERR_NAME_NOT_RESOLVED` and 404 errors
   - Impact: May cause broken images or missing content for users
   - Location: Network requests during page load
   - Recommendation: Verify all external resource URLs are valid; add fallback handling

### Major

2. **Breadcrumb Toggle is Nearly Invisible** (Severity: Major)
   - The breadcrumb toggle button (`#breadcrumb-toggle`) displays only a small triangle character (▶)
   - On mobile, this is an extremely small tap target
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/index.html` (line 25)
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-breadcrumb.css`
   - Recommendation: Increase size to at least 44x44px with padding; add visual label or icon

3. **No Loading Progress Indication for Story Content**
   - When navigating between stories, users see a generic "Loading..." message
   - No progress indicator or estimated time
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-player.css` (lines 486-532)
   - Recommendation: Add percentage or progress bar; show what's being loaded

4. **Choice Buttons Have Delayed Interactivity**
   - Choice buttons start with `pointer-events: none` and become clickable after animation
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-player.css` (line 339)
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-ui.js` (line 240)
   - Users may tap before the button is ready and think it's broken
   - Recommendation: Add visual "loading" state indicator or reduce animation delay

5. **Radial Menu Has No Affordance**
   - The hamburger menu (☰) in bottom-left has no label or indication of functionality
   - New users may not discover the navigation options
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/index.html` (line 188)
   - Recommendation: Add subtle pulse animation on first load; add "Menu" label on desktop

### Minor

6. **AudioContext Warning on Page Load**
   - Console warning: "The AudioContext was not allowed to start"
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-audio.js`
   - Standard browser behavior, but could be handled more gracefully
   - Recommendation: Show audio icon with "tap to enable sound" prompt

7. **Scroll Status Bar Visibility Duration**
   - The scroll status bar only shows for 1.5s after scrolling stops
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-ui.js` (line 150)
   - May be too brief for users to read the FINK statistics
   - Recommendation: Extend to 3-4 seconds or keep visible while actively scrolling

8. **Font Loading Flash**
   - "Press Start 2P" font loads from Google Fonts, causing initial text flash
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/index.html` (line 9)
   - Recommendation: Use `font-display: swap` and consider local font fallback

9. **Home Confirmation Dialog UX**
   - The "Go home?" confirmation appears inline in story output
   - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-ui.js` (lines 176-216)
   - Easy to miss among story content
   - Recommendation: Use modal overlay for important confirmations

10. **Small Font Size on Very Small Screens**
    - On 320px screens, the 12px font may be difficult to read
    - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-player.css` (lines 466-471)
    - Recommendation: Set minimum font size of 14px for body text on mobile

11. **Developer Panel Accessibility**
    - Dev panel tabs use emoji-only labels (📋, 🏊, 📊, 📂, 🔊)
    - File: `/home/user/glitchcan-minigam/inklet/finkapp/index.html` (lines 50-55)
    - Screen readers won't convey meaning
    - Recommendation: Add `aria-label` attributes to tab buttons

12. **Missing Focus Styles on Some Elements**
    - While `:focus-visible` is defined globally, some buttons may not show clear focus
    - File: `/home/user/glitchcan-minigam/inklet/finkapp/fink-theme.css` (lines 66-69)
    - Recommendation: Verify all interactive elements have visible focus states

## Recommendations (Prioritized)

### High Priority
1. **Fix resource loading errors** - Check network requests and add error handling
2. **Improve breadcrumb toggle visibility** - Increase touch target size and add visual indicator
3. **Add loading progress indication** - Show what's loading and estimated progress
4. **Add "ready" visual feedback to choice buttons** - Subtle glow or color change when clickable

### Medium Priority
5. **Enhance radial menu discoverability** - Add onboarding hint or subtle animation
6. **Handle AudioContext gracefully** - Show "tap for sound" indicator
7. **Improve home confirmation UX** - Use modal dialog instead of inline

### Low Priority
8. **Extend scroll status bar duration** - Give users more time to read stats
9. **Optimize font loading** - Reduce flash of unstyled text
10. **Improve minimum font sizes** - Ensure readability on very small screens
11. **Add accessibility labels** - Improve screen reader support for dev panel

## Positive Findings

1. **Good Touch Target Sizing** - Main choice buttons meet 48px minimum (line 340 in fink-player.css)
2. **Responsive Layout Works Well** - Content adapts properly from 320px to desktop
3. **Smooth Animations** - CSS transitions provide polished feel without being distracting
4. **Clear Color Contrast** - Cyan on dark background provides good readability
5. **Radial Menu Implementation** - Well-designed with good spacing when open
6. **History Toggle Feature** - Clever UX for showing past choices without cluttering view
7. **Prefers-reduced-motion Support** - Respects user accessibility preferences (fink-theme.css line 42)
8. **Status Overlay** - Clean loading/error display with spinner

## Technical Notes

- The app uses a modular JavaScript architecture with clear separation of concerns
- CSS custom properties (variables) are well-organized in fink-theme.css
- Touch handling includes `touch-action: manipulation` for better mobile performance
- The sandbox iframe approach for FINK content is secure and well-implemented
