# Ink: Interactive Narrative Programming Language

**Ink** is a powerful scripting language for creating branching interactive stories, from simple choice-driven narratives to complex RPGs with state tracking.

## Core Syntax

**Basic Flow:**
- Text flows line by line
- `*` creates one-time choices, `+` creates sticky (repeatable) choices
- `->` diverts story flow to knots/stitches
- `-> END` terminates story

**Structure:**
- `=== knot_name ===` defines major story sections
- `= stitch_name` defines subsections within knots
- `- gather_point` collects branching paths back together

## Variables & Logic

**Variable Types:**
```ink
VAR health = 100          // Global integer
VAR name = "Player"       // String
VAR visited_cave = false  // Boolean
VAR current_location = -> forest  // Divert target
```

**Conditionals:**
```ink
* {health > 50} [Attack] You strike boldly!
* {health <= 50} [Retreat] You back away carefully.
* {visited_cave} "I remember this place..."
```

**Math & Logic:**
- Standard operators: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `and`, `or`, `not`
- Functions: `MIN()`, `MAX()`, `RANDOM(min,max)`, `POW()`

## Advanced Features

**Lists (State Machines):**
```ink
LIST Inventory = sword, shield, potion
LIST MoodState = happy, angry, (sad), excited

VAR player_items = (sword, potion)
VAR npc_mood = sad

* {player_items ? sword} [Draw sword]
* {npc_mood == angry} "Why are you upset?"
```

**Functions:**
```ink
=== function heal_player(amount) ===
~ health += amount
~ health = MIN(health, 100)
~ return health

=== function describe_item(item) ===
{ item:
- sword: A gleaming blade
- shield: Sturdy oak and iron
- else: Unknown item
}
```

**Weave (Nested Choices):**
```ink
* "What happened here?"
  ** "Tell me everything."
  ** "Just the basics."
* "I need to go."
- Whatever you choose, the story continues...
```

**Threads (Parallel Content):**
```ink
<- examine_room
<- talk_to_npc
* [Leave] -> exit
```

**Tunnels (Subroutines):**
```ink
-> check_inventory -> continue_story

=== check_inventory ===
You search your pockets...
->->  // Return to caller
```

## Dynamic Text

**Alternatives:**
- `{text1|text2|text3}` - Sequence (cycles through once)
- `{&text1|text2|text3}` - Cycle (repeats)
- `{~text1|text2|text3}` - Shuffle (random)
- `{!text1|text2|}` - Once-only (then empty)

**Conditional Text:**
```ink
The guard {health > 80: glares menacingly | looks tired}.
You have {Inventory ? sword: a weapon | empty hands}.
```

## Game Integration

**External Functions:**
```ink
EXTERNAL playSound(soundName)
EXTERNAL getPlayerName()

~ playSound("sword_clash")
~ name = getPlayerName()
```

**Tags for Metadata:**
```ink
"Hello there!" #happy #npc_intro
The door creaks open. #sound:door_creak.ogg
```

**Variable Observers:**
```csharp
story.ObserveVariable("health", (varName, newValue) => {
    UpdateHealthUI((int)newValue);
});
```

## Powerful Patterns

**Read Counts & Timing:**
```ink
* {not tavern_visited} [Enter tavern]
* {TURNS_SINCE(-> last_meal) > 5} [Eat something]
```

**Knowledge Chains:**
```ink
LIST Investigation = saw_body, found_weapon, identified_killer

* {Investigation ? saw_body && not (Investigation ? found_weapon)} 
  [Search for murder weapon]
```

**Procedural Choice Generation:**
```ink
~ temp i = 0
- (loop)
{ available_items has Items(i):
  * [Take {Items(i)}] -> take_item(Items(i))
}
~ i++
{ i < LIST_COUNT(LIST_ALL(Items)): -> loop }
```

Ink excels at **responsive narratives** where past choices shape future options, **state-driven storytelling** with complex character relationships, and **modular content systems** that can adapt to player actions. Its strength lies in making complex branching logic feel natural to write while maintaining clean, readable code.​​​​​​​​​​​​​​​​

# Appendix: Validation & QA Reference

## Syntax Validation Guidelines

### Common Compile-Time Errors
- **Missing diverts**: Knots without `-> END` or flow continuation
- **Undefined targets**: `-> nonexistent_knot` references
- **Malformed choices**: Missing `*` or `+`, incorrect nesting levels
- **Variable type mismatches**: Assigning strings to numeric variables
- **Infinite loops**: `=== loop === -> loop` without exit conditions
- **Reserved keywords**: Using `END`, `DONE`, `true`, `false` as identifiers

### Runtime Validation
- **Out of content**: Story reaches dead end without choices or `-> END`
- **Choice exhaustion**: All conditional choices fail, no fallback provided
- **Stack overflow**: Excessive tunnel/function recursion depth
- **Variable access**: Reading undefined variables (returns 0/false/empty)

### Testing Patterns
```ink
// Test mode debugging
VAR debug_mode = true
{debug_mode: [DEBUG] Current health: {health}}

// Validation functions
=== function validate_inventory() ===
{LIST_COUNT(inventory) > 10:
    [WARNING] Inventory overflow: {LIST_COUNT(inventory)} items
}

// State consistency checks
{health <= 0 and not game_over:
    [ERROR] Invalid state: dead but game continues
}
```

## Ink Grammar (Simplified BNF)

```bnf
<story> ::= <content>*

<content> ::= <knot> | <stitch> | <choice> | <gather> | <divert> | 
              <conditional> | <text> | <logic> | <include>

<knot> ::= "===" <identifier> "===" <newline> <content>*

<stitch> ::= "=" <identifier> <newline> <content>*

<choice> ::= <choice_marker> <conditions>? <choice_text> <newline> <content>*
<choice_marker> ::= "*" | "+"
<conditions> ::= "{" <expression> "}"
<choice_text> ::= <text> | "[" <text> "]" <text>?

<gather> ::= "-" <label>? <newline> <content>*
<label> ::= "(" <identifier> ")"

<divert> ::= "->" <target>
<target> ::= <identifier> | <identifier> "." <identifier> | "END" | "DONE"

<conditional> ::= "{" <expression> ":" <content>* "}"
<text> ::= <string> | <inline_logic>
<inline_logic> ::= "{" <expression> "}"

<logic> ::= "~" <assignment> | "~" <function_call>
<assignment> ::= <identifier> <operator> <expression>
<operator> ::= "=" | "+=" | "-=" | "++" | "--"

<expression> ::= <term> (<binary_op> <term>)*
<term> ::= <identifier> | <number> | <string> | <list> | 
          <function_call> | "(" <expression> ")"

<binary_op> ::= "+" | "-" | "*" | "/" | "%" | "==" | "!=" | 
               "<" | ">" | "<=" | ">=" | "and" | "or" | 
               "?" | "!?" | "^"

<function_call> ::= <identifier> "(" <expression_list>? ")"
<expression_list> ::= <expression> ("," <expression>)*

<variable_def> ::= "VAR" <identifier> "=" <expression>
<list_def> ::= "LIST" <identifier> "=" <list_items>
<list_items> ::= <list_item> ("," <list_item>)*
<list_item> ::= <identifier> | "(" <identifier> ")" | 
               <identifier> "=" <number>

<include> ::= "INCLUDE" <filename>

<identifier> ::= <letter> (<letter> | <digit> | "_")*
<number> ::= <digit>+ ("." <digit>+)?
<string> ::= '"' <char>* '"'
<comment> ::= "//" <char>* <newline> | "/*" <char>* "*/"
```

## QA Testing Framework

### Automated Testing Patterns
```ink
// Unit test for functions
=== test_heal_function ===
~ temp initial_health = 50
~ temp result = heal_player(30)
{result == 80: [PASS] | [FAIL]} Heal function test
-> DONE

// Integration test for story paths
=== test_combat_sequence ===
~ health = 100
~ inventory += sword
-> combat_encounter
= after_combat
{health > 0: [PASS] | [FAIL]} Player survived combat
-> DONE

// Regression test for choice availability
=== test_choice_conditions ===
~ temp choice_count = 0
* {true} -> test_choice_1
* {false} -> test_choice_2
* -> test_fallback
= test_choice_1
~ choice_count++
{choice_count == 1: [PASS] | [FAIL]} Conditional choices working
-> DONE
```

### Coverage Analysis
```ink
// Track visited content
VAR content_coverage = ()
LIST AllContent = intro, forest, cave, town, ending

=== function track_visit(location) ===
~ content_coverage += location

// Report coverage at end
=== final_report ===
Coverage: {LIST_COUNT(content_coverage)}/{LIST_COUNT(LIST_ALL(AllContent))}
Missed: {LIST_ALL(AllContent) - content_coverage}
```

### Performance Profiling
```ink
// Expensive operations monitoring
VAR recursion_depth = 0
VAR max_list_size = 0

=== function profile_recursion(depth) ===
~ recursion_depth = MAX(recursion_depth, depth)
{depth > 100: [WARNING] Deep recursion: {depth}}

=== function profile_list_ops(list) ===
~ max_list_size = MAX(max_list_size, LIST_COUNT(list))
{LIST_COUNT(list) > 50: [WARNING] Large list operation}
```

## Validation Checklist

### Pre-Release QA
- [ ] All story paths reachable from start
- [ ] No orphaned knots/stitches
- [ ] All conditional branches tested
- [ ] Variable state consistency maintained
- [ ] Save/load functionality verified
- [ ] Performance acceptable on target platforms
- [ ] Localization hooks functional (if applicable)
- [ ] External function bindings working
- [ ] Tag metadata correctly formatted
- [ ] No memory leaks in long play sessions

### Stress Testing
```ink
// Choice explosion test
~ temp i = 0
- (stress_loop)
* {i < 1000} [Choice {i}]
~ i++
-> stress_loop
+ [Exit stress test]
-> DONE

// Variable overflow test
~ temp large_number = 999999999
~ large_number = large_number * large_number
{large_number > 0: [PASS] | [FAIL]} Number overflow handling

// Deep nesting test
-> tunnel_1 -> tunnel_2 -> tunnel_3 -> tunnel_4 -> tunnel_5 ->
=== tunnel_1 ===
->->
=== tunnel_2 ===
->->
// ... etc
```

### Error Recovery Testing
```ink
// Graceful degradation patterns
=== function safe_divide(a, b) ===
{b == 0:
    [ERROR] Division by zero attempted
    ~ return 0
}
~ return a / b

// Fallback content
* {complex_condition()} [Complex choice]
* -> [Simple fallback]
Always available if conditions fail
```

This validation framework ensures robust, maintainable interactive narratives that handle edge cases gracefully and provide clear debugging information during development.