# Page 104

Göran KJELLBERG


SOME PROBLEMS TREATED WITH THE BARK


PROPERTIES OF THE BARK. It is a relay machine, containing about
5 200 relays (augmented in January 1951 to 8 000).

Memory : 50 variable numbers and 100 constants (after Jan. 1951,
100 variable numbers and 200 constants).

Number representation :
2^p . q
|p| < 64, 6 binary digits
|q| < 1, 24 binary digits

with the signs of p and q this gives 32 binary characters for the repre-
sentation of one number.

Input and output. 5 stations (telegraph transmitters) permit
reading from punched paper tapes in the decimal system. 2 stations permit
reading in the binary system.

Likewise 5 stations are equipped to punch paper tapes in the
decimal system and 2 stations for punching in the binary system.

One typewriter is available, equipped for printing in either
the decimal or the octal system.

An instruction has the form :
N   A   op   signs   B   C   D

N is the number (index) of the instruction, A and B the addresses of the
numbers that are to be combined by the operation "op", with the signs indi-
cated by "signs", C is the address of the result and D the index of the
next instruction.

Instructions are "given to the machine" in the form of plugged
connections set up on the instruction panels : panel A, panel B, panel C,
operations and signs panel, and sequence panel (or "jump" panel). Each
instruction requires normally one plugged connection on each panel (two
on the operations and signs panel).

Operations : Transfer                    100 ms
             Addition                    150 ms
             Multiplication              250 ms
             Various                     variable

---
[No OCR uncertainties noted]
