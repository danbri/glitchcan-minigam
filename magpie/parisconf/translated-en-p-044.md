# Page 44

## Type
Communication Abstract

## Language
French (translated to English)

## Content

Goran KJELLBERG


SOME PROBLEMS TREATED WITH THE BARK


CHARACTERISTICS OF THE BARK. Constructed exclusively of relays, numbering 5,200 (since January 1951: 8,000).

Memory: 50 variable numbers, 100 constant numbers (since January 1951: 100 variable numbers, 200 constants).

Representation of numbers:
2^P * q
|p| < 64, 6 binary digits
|q| < 1, 24 binary digits

With signs of p and q, this gives a total of 32 binary items of information for the representation of a number.

Input and output of numbers: 5 stations (ordinary telegraph transmitters) can read punched tapes in the decimal system. 2 stations can read tapes in the binary system.

Likewise, 5 stations can punch tapes in the decimal system, and 2 stations can punch in the binary system. In addition, there is a printer (teletype) capable of printing digits in decimal or octal system.

An instruction has the form
N     A     op     signs     B     C     D
N is the number of the instruction, A and B the addresses of the numbers which are to be combined by the operation "op", with the signs indicated by "signs", C is the address of the result and D the number of the next instruction.

The instructions are communicated to the machine by making the corresponding couplings on the 5 instruction panels: panel A, panel B, panel C, panel of operations and signs, and panel of jumps. Each instruction normally requires one connection on each panel (2 on the panel of operations and signs).

Operations:   Transfer               100 ms
              Addition               150 ms
              Multiplication         250 ms
              Miscellaneous          variable

---

## Notes
- Author name appears as "Goran KJELLBERG"
- BARK refers to the Swedish relay machine "Binar Aritmetisk Rela-Kalkylator" (Binary Arithmetic Relay Calculator)
- [Translation note: BARK was Sweden's first electronic calculating machine, completed in 1950. Its relay-based construction was typical of this transitional period before vacuum tubes became standard. The floating-point representation (2^P * q) was advanced for its time.]
