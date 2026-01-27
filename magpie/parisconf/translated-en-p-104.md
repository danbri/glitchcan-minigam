# Page 104

## Type
Abstract

## Author
Goran KJELLBERG

## Language
[Original in English]

## Content

Goran KJELLBERG


SOME PROBLEMS TREATED WITH THE BARK


PROPERTIES OF THE BARK. It is a relay machine, containing about
5 200 relays (augmented in January 1951 to 8 000).

Memory: 50 variable numbers and 100 constants (after Jan. 1951,
100 variable numbers and 200 constants).

Number representation:
2^p . q
|p| < 64, 6 binary digits
|q| < 1, 24 binary digits

with the signs of p and q this gives 32 binary characters for the representation of one number.

Input and output. 5 stations (telegraph transmitters) permit
reading from punched paper tapes in the decimal system. 2 stations permit
reading in the binary system.

Likewise 5 stations are equipped to punch paper tapes in the
decimal system and 2 stations for punching in the binary system.

One typewriter is available, equipped for printing in either
the decimal or the octal system.

An instruction has the form:
N   A   op   signs   B   C   D

N is the number (index) of the instruction, A and B the addresses of the
numbers that are to be combined by the operation "op", with the signs indicated by "signs", C is the address of the result and D the index of the
next instruction.

Instructions are "given to the machine" in the form of plugged
connections set up on the instruction panels: panel A, panel B, panel C,
operations and signs panel, and sequence panel (or "jump" panel). Each
instruction requires normally one plugged connection on each panel (two
on the operations and signs panel).

Operations: Transfer                    100 ms
            Addition                    150 ms
            Multiplication              250 ms
            Various                     variable

---

## Notes
[Original in English]

BARK (Binar Aritmetisk Relakalkylator, or Binary Arithmetic Relay Calculator) was Sweden's first electronic computer, built at the Royal Institute of Technology in Stockholm. It used electromechanical relays rather than vacuum tubes.

[Translation note: The floating-point representation described (2^p . q with separate exponent and mantissa) was advanced for its time, as many contemporary machines used fixed-point arithmetic.]
