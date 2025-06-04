oooOO`
// Shane Manor - Minimal Test Version

VAR player_reputation = 50
VAR investigation_style = ""
VAR time_pressure = 3

=== start ===
Inspector Shane André-Louis steps out of the black taxi into the November drizzle.

The Gothic towers of Greystone Manor pierce the grey sky ahead.

TAXI DRIVER: Nasty business, this. Lord Pemberton seemed a decent sort.

* [Question the driver about local gossip]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: What's the word in the village about the family?
    DRIVER: Young Master Charles has been about more lately. Money troubles, they say.
    
* [Review your case notes methodically]
    ~ investigation_style = "procedural"
    Body discovered 8 AM by maid Mary Collins.

- The imposing front door opens before you can knock.

-> meet_butler

=== meet_butler ===
ASHFORD: Inspector André-Louis? I am Ashford, the butler.

The man is clearly shaken.

* [Put him at ease with gentle questioning]
    ~ player_reputation += 3
    ANDRÉ-LOUIS: Take your time, Mr. Ashford.
    
* [Press for immediate facts]
    ~ investigation_style = "direct"
    ANDRÉ-LOUIS: I need the essential details.

- ASHFORD: Where would you like to begin, Inspector?

-> resolution

=== resolution ===
~ player_reputation += 10

ASHFORD: Inspector André-Louis, your reputation is well-deserved.

The case is solved successfully.

-> END
`