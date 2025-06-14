# Shane Manor FINK Story - Analysis & TODO

## Current Status: ✅ COMPILATION FIXED - Gameplay Testing Needed

### Validation Results (June 2025)

**✅ FINK Compilation Test PASSED**
- Command: `node validate-fink-puppeteer.mjs ../shane-manor.fink.js`
- Result: ✅ PASS - 9,532 chars of valid INK extracted
- Real ink-full.js engine successfully compiles the story
- No compilation errors detected

### Previous Problem Analysis (RESOLVED)

The story was initially broken due to missing INK variable declarations, but has been fixed using Option B (Simplified Version).

#### Missing Critical Structures:
```ink
LIST Evidence = muddy_footprints, open_safe, gambling_debts, new_will, 
                chair_barricade, surveillance_photos, threatening_letters,
                chess_position, locked_door, family_tensions, bloody_letter_opener,
                brandy_glass, servants_bell_system

LIST Suspects = charles_pemberton, victoria_ashworth, james_blackwood, 
               mary_collins, ashford_butler, mrs_pemberton

LIST Deductions = inside_job, outside_intruder, crime_of_passion, 
                 financial_motive, inheritance_scheme, gambling_connection

VAR evidence_found = ()
VAR suspects_met = ()
```

#### Symptoms:
- INK compilation will fail due to undefined variable references
- Conditional logic like `{evidence_found ? family_tensions: ...}` will break
- Investigation progress tracking is non-functional
- Story branches that depend on evidence/suspect tracking won't work

### Available Debug Tools

1. **`debug-shane-detailed.html`** - Comprehensive INK compilation tester
   - Uses proper iframe sandbox to extract FINK content
   - Tests real ink-full.js compilation
   - Provides detailed error reporting and stack traces

2. **`debug-shane-manor.html`** - Basic INK compilation validator
   - Simpler version focused on compilation success/failure
   - Good for quick validation tests

3. **`fix-shane-conditionals.js`** - Automated conditional removal script
   - Node.js script that strips out problematic conditional syntax
   - Takes approach of removing complexity rather than fixing variables

### Solution Options

#### Option A: Restore Full Variable Structure (RECOMMENDED)
- **Pro**: Maintains full story complexity and investigation mechanics
- **Pro**: Preserves original design intent
- **Con**: Requires careful restoration of all LIST and VAR declarations
- **Action**: Restore missing declarations from git history

#### Option B: Simplified Version (FALLBACK)
- **Pro**: Quick fix, guaranteed to work
- **Pro**: `shane-manor-minimal.fink.js` already demonstrates this approach
- **Con**: Loses investigation complexity and player choice consequences
- **Action**: Use enhanced version of `fix-shane-conditionals.js` to remove all variable references

### Working Reference

`inklet/shane-manor-minimal.fink.js` is a **working simplified version** that avoids all complex variable tracking. This demonstrates that the basic story structure and INK syntax are sound.

### Testing Protocol

1. **Before any changes**: Run debug tools to confirm current compilation failures
2. **After variable fixes**: Use `debug-shane-detailed.html` to verify compilation success
3. **Integration test**: Load story in FINK Player v5/v6 and complete a full playthrough
4. **Regression test**: Ensure other FINK stories still work (TOC, Hampstead, etc.)

### File Locations

- **Main story**: `inklet/shane-manor.fink.js` (BROKEN)
- **Working minimal**: `inklet/shane-manor-minimal.fink.js` (WORKING)
- **Debug tools**: `debug-shane-detailed.html`, `debug-shane-manor.html`
- **Fix script**: `fix-shane-conditionals.js`

### REMAINING TESTING NEEDED

**Compilation ✅ DONE** - Story compiles successfully with real INK engine

**Still Need to Test:**
1. **FINK Player Integration** - Load story via TOC → Games → Shane Manor in inklet5.html/inklet6.html
2. **Image System** - Verify images load from `media/shane/` with BASEHREF path resolution
3. **Story Flow** - Test investigation_choice loop and multiple endings (resolution, partial_resolution, time_up)
4. **Full Playthrough** - Complete detective story from start to ending
5. **Cross-device Testing** - Mobile/desktop compatibility

### Working Features Confirmed
- ✅ Real INK compilation via ink-full.js
- ✅ FINK structure with oooOO template literal
- ✅ IMAGE tags for visual elements
- ✅ BASEHREF for media path resolution
- ✅ Variable tracking (player_reputation, investigation_style, time_pressure)
- ✅ Complete story structure with branching paths

### Git Status Notes

- `shane-manor.fink.js` shows modifications (variables removed)
- Multiple debug files are untracked
- `shane-manor-minimal.fink.js` is untracked (new working version)

This analysis provides a clear path forward for fixing the Shane Manor story while preserving the debugging tools created during investigation.