# E6X3 Emulation Notes
## Elliott 4100 Series Instruction Set Reference

**Source**: CCS E6X3 Version 2, November 2011
**Scope**: Instruction sets and instruction times for Elliott 4100 Series computers

---

## 1. Architecture Summary

| Register | Bits | Description |
|----------|------|-------------|
| M | 24 | Main accumulator |
| R | 24 | Reserve accumulator, address modification |
| S | 17 | Sequence control (program counter) |
| K | 12 | Count register |
| C | 14 | Conditions register |

**Bit Numbering**: Bit 24 = MSB (0x800000), Bit 1 = LSB (0x000001)

### Condition Register C Flags
| Bit | Name | Description |
|-----|------|-------------|
| c24 | Neg | Result negative |
| c23 | St | Result standardized (bits 22,23 equal OR value=0) |
| c22 | Nz | Result non-zero |
| c21 | Ca | Carry-out from MS bit during add/sub |
| c20 | Of | Arithmetic overflow |
| c19 | - | Normal interrupt permit |
| c18 | - | Attention interrupt permit |
| c17 | - | Invalid information transfer |
| c6-c1 | - | Manual console switches |

---

## 2. Instruction Format

### Short Format (12 bits)
```
| F (6) | N (6) |
  Op code  Address
```
- F range: 00-37 octal
- N: Address in first 64 words only

### Long Format (24 bits)
```
| F (6) | Y (2) | Z (1) | N (15) |
  Op code  Mode   Extra   Address
```
- F range: 40-77 octal
- Z=1: Extracode instruction

### Addressing Modes (Y bits)
| Y | Mode | Effective Address |
|---|------|-------------------|
| 0 | Literal | N (unsigned positive) |
| 1 | Direct | N |
| 2 | Modified | N + R |
| 3 | Indirect | [N] (contents of location N) |

**Note**: For Y=2,3: bits 16-22 of final address must be zero (64K block limit)

---

## 3. Instruction Categories

### Group A: Arithmetic/Logic/Control (F=00-37 short, 40-77 long)
| F(s) | F(l) | Y | Action | Mnemonic |
|------|------|---|--------|----------|
| 00 | 40 | - | m' = m + Q | ADD |
| 01 | 41 | - | m' = m - Q | SUB |
| 02 | 42 | - | m' = Q - m | NADD |
| 03 | 43 | - | m' = Q | LD |
| 04 | 44 | - | r' = Q | LDR |
| 05 | - | - | s' = n; c'24-18 = n24-18 | JIR |
| - | 45 | 0 | s' = N | J |
| - | 45 | 1-3 | s' = Q | JI |
| 06 | 46 | - | m' = m & Q | AND |
| 07 | 47 | - | m' = m & ~Q | ANDN |
| 10 | 50 | - | r' = r + Q | ADDR |
| 11 | 51 | - | r' = r - Q | SUBR |
| 12 | 52 | - | r' = Q - r | NADR |
| - | 53 | 0 | [0]' = c24-18 + s; s' = s + N | JFL |
| 13 | 53 | 1-3 | [0]' = c24-18 + s; s' = Q | JIL |
| 14 | 54 | - | k' = Q | LDK |
| 15 | - | - | Shift instructions | (see below) |
| - | 55 | - | compare (m - Q) | COMP |
| 16 | 56 | 0 | s' = s + N | JF |
| - | 56 | 1-3 | s' = s + Q | JA |
| 17 | 57 | 0 | s' = s - N | JB |
| - | 57 | 1-3 | s' = s - Q | JS |
| 20 | 60 | 0 | if Neg: s' = s + Q | JN |
| 21 | 61 | 0 | if !Neg: s' = s + Q | JNN |
| 22 | 62 | 0 | if !Nz: s' = s + Q | JZ |
| 23 | 63 | 0 | if Nz: s' = s + Q | JNZ |
| 24 | 64 | 0 | if St: s' = s + Q | JST |
| 25 | 65 | 0 | if Of: s' = s + Q | JOF |
| 27 | 67 | 0 | k' = k - 1; if k12=1: s' = s + Q | DKJN |
| 30 | 60 | 1-3 | Q' = m | ST |
| 31 | 61 | 1-3 | Q' = r | STR |
| 32 | 62 | 1-3 | Q' = -Q | NEGS |
| 33 | 63 | 1-3 | Q' = Q - m | SUBS |
| 34 | 64 | 1-3 | Q' = Q + m | ADDS |
| 35 | 65 | 1-3 | Q' = 0 | CLS |
| 36 | 66 | 1-3 | Q' = Q + 1 | INCS |
| 37 | 67 | 1-3 | Q' = Q - 1 | DECS |

### Special Long Instructions (F=70-77)
| F | Y | Action | Mnemonic |
|---|---|--------|----------|
| 70 | 0 | Register-to-register | (see below) |
| 70 | 1-3 | Q' = Q(bcda); m' = m(abc)Q(a) | GET |
| 71 | 1-3 | Q' = Q(bcd)m(d) | PUT |
| 72 | 1-3 | m' = (r,m)/Q; r' = remainder | DIVM |
| 73 | 1-3 | (r,m)' = m × Q | MULM |
| 74 | 1-3 | m' = Q; [r]' = m; r' = r - 1 | MVE |
| 75 | 1-3 | Q' = m; m' = [r]; r' = r + 1 | MVB |
| 76 | 1-3 | swap Q and m | EXC |
| 77 | 1-3 | swap Q and r | EXCR |

---

## 4. Shift Instructions (Group B)

**Format**: F=15 (octal), N selects shift type, K register holds count

| N (oct) | Action | Mnemonic |
|---------|--------|----------|
| 00 | Shift R left arithmetically k places | SRL |
| 01 | Shift R left circularly k places | SRLA |
| 02 | Shift R right arithmetically k places | SRR |
| 03 | Shift R by k 6-bit characters left (circular) | SRLC |
| 04 | Shift M left arithmetically k places | SML |
| 05 | Shift M left circularly k places | SMLA |
| 06 | Shift M right arithmetically k places | SMR |
| 07 | Shift M by k 6-bit characters left (circular) | SMLC |
| 12 | Shift R right logically k places | SRRL |
| 16 | Shift M right logically k places | SMRL |
| 20 | Shift R until standardized, max k places; **k' = shift count** | SRST |
| 24 | Shift M until standardized, max k places; **k' = shift count** | SMST |
| 40 | Shift both (R,M) left arithmetically k places | SBL |
| 42 | Shift both (R,M) right arithmetically k places | SBR |
| 52 | Shift both (R,M) right logically k places | SBRL |
| 62 | Shift both (R,M) until standardized, max k places | SBST |

### Standardization Definition
A value is **standardized** when bits 22 and 23 differ (for non-zero values).
This is critical for floating-point normalization.

**SMST/SRST behavior**: Shifts left until standardized, K receives the count of shifts performed.

---

## 5. Register-to-Register Instructions (Group C)

**Format**: F=70, Y=0, N specifies registers

| N (oct) | Action | Mnemonic |
|---------|--------|----------|
| 00020 | r' = k | KTOR |
| 00402 | r' = m | MTOR |
| 00404 | r' = s | STOR |
| 00441 | r' = r + 1 if carry set | CAIR |
| 00541 | r' = r - 1 if carry set | CADR |
| 01001 | m' = r | RTOM |
| 01003 | m' = m OR r | MORR |
| 01010 | m' = c | CTOM |
| 02001 | s' = r | RTOS |
| 02002 | s' = m | MTOS |
| 04002 | c' = m | MTOC |
| 10001 | k' = r | RTOK |
| 10002 | k' = m | MTOK |
| 10201 | k' = -r | RNTK |
| 21000 | m' = interrupt word | ITOM |
| 41000 | m' = attention word | ATOM |

---

## 6. Extracode Trap Mechanism (Group E)

**Trigger**: Z=1 in long instruction, F in range 40-77 octal

### Trap Sequence for Y=0 (Literal Mode)
1. Place N in memory location 1
2. Place link (c24-18 + S) in memory location 2
3. Jump to address 2×F (even addresses 64-126)

### Trap Sequence for Y=1,2,3 (Other Modes)
1. Place effective address in memory location 1:
   - Y=1: N
   - Y=2: N + r
   - Y=3: [N]
2. Place link (c24-18 + S) in memory location 2
3. Jump to address 2×F + 1 (odd addresses 65-127)

### Link Word Format
```
| c24-c18 (7 bits) | S (17 bits) |
  Condition bits     Program counter
```
Total: 24 bits. Used by JFL, JIL, JIR for subroutine calls/returns.

---

## 7. Floating-Point Format

### Memory Format (Two 24-bit Words)
```
Word 1: | Sign (1) | Exponent (9) | Mantissa high (14) |
Word 2: | Mantissa low (24) |
```
- **Mantissa**: 39 bits total (38 stored + 1 implicit leading bit)
- **Exponent**: 9 bits, excess-256 bias (range -256 to +255)
- **Sign**: 1 bit in MSB of Word 1

### Internal Format (4130 Hardware FP)
- **Mantissa**: 48 bits (in R,M register pair)
- **Exponent**: 12 bits
- Accessed via FLU/WUF extracodes for unrounded representation

### FP Extracodes (Hardware on 4130, Software trap on 4120)
| F | Y | Z | N | Action | Mnemonic |
|---|---|---|---|--------|----------|
| 40 | 0 | 1 | 0 | fpa' = -fpa | FN |
| 40 | 0 | 1 | 2 | fpa' = float(m) | FCP |
| 40 | 0 | 1 | 4 | fpa' = abs(fpa) | FMOD |
| 40 | 0 | 1 | 6 | m' = entier(fpa) | FENT |
| 41 | 0 | 1 | 10 | m' = sign(fpa) {-1,0,+1} | FSIG |
| 40 | y | 1 | n | fpa' = fQ | FL |
| 41 | y | 1 | n | fQ' = fpa | WF |
| 42 | y | 1 | n | fpa' = fpa + fQ | FA |
| 43 | y | 1 | n | fpa' = fpa - fQ | FS |
| 44 | y | 1 | n | fpa' = fpa × fQ | FM |
| 45 | y | 1 | n | fpa' = fpa / fQ | FD |
| 46 | y | 1 | n | set c24-22 from (fpa - fQ) | FCP |
| 60 | y | 1 | n | fpa' = tQ (unrounded, 3 words) | FLU |
| 61 | y | 1 | n | tQ' = fpa (unrounded, 3 words) | WUF |

---

## 8. GET/PUT Character Instructions

Characters are 6-bit, packed 4 per 24-bit word as {a, b, c, d} where 'a' is MSB.

### GET (F=70, Y=1-3)
```
Q' = Q rotated left 6 bits: (bcda)
m' = m rotated left 6 bits with Q's old 'a' inserted: m(abc) + Q(a)
```
Fetches character from Q into low 6 bits of M, rotating both.

### PUT (F=71, Y=1-3)
```
Q' = Q rotated left 6 bits with m's low char: Q(bcd) + m(d)
```
Stores low 6 bits of M into Q, rotating Q.

---

## 9. I/O Instructions (Group D)

**Format**: F=74-77, Y=0, N encodes operation and channel

```
N format: | Operation (3 oct) | Channel (2 oct) |
```

| F | N prefix | Action | Mnemonic |
|---|----------|--------|----------|
| 74 | 000nn | Input data packed repetitive | IDPR |
| 74 | 100nn | Output data packed repetitive | ODPR |
| 74 | 200nn | Input data unpacked repetitive | IDUR |
| 74 | 300nn | Output data unpacked repetitive | ODUR |
| 75 | 000nn | Input status packed | ISPR |
| 75 | 100nn | Output control packed | OCPR |
| 75 | 200nn | Input status unpacked | ISUR |
| 75 | 300nn | Output control unpacked | OCUR |
| 76 | 200nn | Input data unpacked single to M | IDUM |
| 76 | 300nn | Output data unpacked single from M | ODUM |
| 77 | 200nn | Input status unpacked single to M | ISUM |
| 77 | 300nn | Output control unpacked single from M | OCUM |

---

## 10. Testable Requirements

### DKJN (Decrement K, Jump if Negative)
- Decrements K by 1
- Jumps if **k12=1** (bit 12 of K is set, i.e., K went negative in 12-bit signed)
- K is 12-bit, so negative means K & 0x800 != 0

### SMST (Shift M Until Standardized)
- Shifts M left until bits 22 and 23 differ
- Stops if M becomes zero OR k shifts performed
- K receives count of actual shifts

### JFL/JIL Link Format
- Link = (c24-18 << 17) | (S & 0x1FFFF)
- Stored at address 0
- JIR restores: S from bits 0-16, C bits 24-18 from bits 17-23

### Extracode Trap Addresses
- Y=0: Jump to 2×F (even: 0x40→128, 0x41→130, etc.)
- Y>0: Jump to 2×F+1 (odd: 0x40→129, 0x41→131, etc.)

---

## 11. Test Cases

### Shift Tests
```
Test: SMST on M=0x100000 (bit 20 set, bits 22,23 both 0)
Expected: M shifts left 1 place → M=0x200000, K=1
Reason: After 1 shift, bit 23=0, bit 22=1 → standardized

Test: SMST on M=0x000001
Expected: M=0x400000 after 22 shifts, K=22
Reason: Shifts until bit 22=1, bit 23=0

Test: SMST on M=0x000000
Expected: M=0, K=0
Reason: Zero is considered standardized, no shift needed

Test: SRLA (circular left) with K=25, R=0x800001
Expected: R=0x000003 (25 mod 24 = 1 shift, wraps MSB to LSB)
```

### Extracode Trap Tests
```
Test: Execute extracode F=0x42 (FA), Y=0, N=100
Expected: mem[1]=100, mem[2]=link, S=0x84*2=0x108 (half-word addr)

Test: Execute extracode F=0x42, Y=1, N=100
Expected: mem[1]=100, mem[2]=link, S=0x85*2=0x10A
```

### Floating-Point Format Tests
```
Test: Store 1.0 in FP format
Expected: Word1=0x400000 (sign=0, exp=256, mant=0), Word2=0x000000

Test: Store 2.0 in FP format
Expected: Word1=0x404000 (sign=0, exp=257, mant=0), Word2=0x000000

Test: Store -1.0 in FP format
Expected: Word1=0xC00000 (sign=1, exp=256, mant=0), Word2=0x000000

Test: Store 0.5 in FP format
Expected: Word1=0x3FC000 (sign=0, exp=255, mant=0), Word2=0x000000
```

### Link Word Tests
```
Test: JFL with S=0x100, C=0xFE0000
Expected: mem[0] = 0x7F0100 (upper 7 bits of C + S)
          S advances by N (relative jump)

Test: JIR from link=0x7F0100
Expected: S=0x100, C bits 24-18 restored to 0xFE
```

### GET/PUT Character Tests
```
Test: GET with Q=0xABCDEF, M=0x123456
Expected: Q=0xBCDEFA (rotated left, 'a' to low)
          M=0x23456A (rotated left, Q's old 'a' inserted)

Test: PUT with Q=0xABCDEF, M=0x123456
Expected: Q=0xBCDEF6 (rotated left, M's low char '6' inserted)
```

---

## 12. Implementation Notes

### Half-Word Addressing
S register addresses half-words (12-bit instruction positions):
- S bit 0 = 0: Upper half of word (bits 23-12)
- S bit 0 = 1: Lower half of word (bits 11-0)
- Word address = S >> 1

### Q Notation in Documentation
In E6X3, "Q" represents the operand value based on addressing mode:
- Y=0: Q = N (literal)
- Y=1: Q = [N] (contents of N)
- Y=2: Q = [N+R] (modified addressing)
- Y=3: Q = [[N]] (indirect addressing)

### Standardization Flag
The St (standardized) flag in C register is set when:
- Bits 22 and 23 of result are different, OR
- Result is zero

This supports floating-point normalization detection.
