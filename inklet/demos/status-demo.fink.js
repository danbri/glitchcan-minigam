// A story with its own status line — no treasure economy in sight.
//
// The player used to hardcode 💎/👑/⭐, so every story wore the same HUD.
// This one declares a flock and a fuel gauge instead, and gets exactly
// those. `# STATUS: none` would give it no status line at all.
oooOO`
VAR flock_size = 3
VAR fuel = 6
VAR crossings = 0

-> yard

=== yard ===
# STATUS: flock_size icon=🐦 label=flock always
# STATUS: fuel icon=⛽ format=bar max=8 always
# STATUS: crossings icon=🌉 label=crossings
The yard at first light. Three birds on the wire, and half a tank.
+ [Take on a passenger] -> gain
+ [Burn some fuel] -> burn
+ [Cross the water] -> cross

=== gain ===
~ flock_size = flock_size + 1
Another one drops in. The wire sags.
-> yard

=== burn ===
~ fuel = fuel - 2
The engine coughs and the needle drops.
-> yard

=== cross ===
~ crossings = crossings + 1
~ fuel = fuel - 1
The water goes under. That is one more than yesterday.
-> yard
`;
