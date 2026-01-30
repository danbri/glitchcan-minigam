# E6X4 Emulation Notes - Programming and Software

**Source:** CCS E6X4 Version 2, November 2011

## 1. Document Overview

E6X4 covers programming and software for Elliott 4100 Series computers:
- Assemblers (NEAT, SAP families)
- High-level languages (ALGOL 60, FORTRAN 66, COBOL)
- Operating systems (EASE, DES, KOS)
- Multiprogramming hardware facilities

**Emulation relevance:** Defines OS-level behaviors the hardware must support.

---

## 2. Programming Modes

### Executive Mode
- Full memory access
- No restrictions on peripherals
- Operating system runs in this mode

### Protected Mode
- Normal user mode under multiprogramming
- Restricted to allocated memory region
- Limited peripheral access
- Memory violations trigger Executive Mode entry

### Mode Transition Instructions
| Instruction | Action |
|-------------|--------|
| `EXEN` | Enter Executive Mode |
| `PMEN` | Load Base, Range, Alarm Clock; enter Protected Mode |

---

## 3. Memory Protection

### Base and Range Registers
- **Two 10-bit registers** define permitted memory region
- `Base`: Starting address (units of 1024 words implied)
- `Range`: Size of permitted region

### Protection Behavior
```
Permitted region: [Base * 1024, (Base + Range) * 1024)

On access outside region:
  1. User program suspended
  2. Executive Mode entered
  3. (Implied: trap to OS handler)
```

**Note:** E6X4 states these facilities "were seldom activated... except in KOS"

---

## 4. Interrupt System

### Three Priority Levels

| Level | Name | Priority | Purpose |
|-------|------|----------|---------|
| 1 | **Interrupt** (Hesitation) | Highest | Hardware events |
| 2 | **Attention** | Middle | Device completion, SI channels |
| 3 | **Normal** | Lowest | Normal computation |

### TSS Interrupt Handling
- TSS (Time Sharing Supervisor) routes interrupts to appropriate handlers
- Maintains per-device routines for each Standard Interface channel
- Organizes queues and buffers for I/O transfers

### Level Transitions
Occur via:
1. Hardware Interrupt or Attention signal
2. Subroutine entry/exit within TSS

---

## 5. Real-Time Clock (Alarm Clock)

### Specification
- Standard on Elliott 4130
- Produces interrupt once every second
- Can be set to "ring" after N seconds

### Behavior
```
PMEN instruction sets:
  - Base register
  - Range register
  - Alarm Clock setting

When Alarm Clock expires:
  - Protected Mode program terminated
  - (Implied: return to Executive/OS)
```

---

## 6. Operating System Components

### EASE (Systems Executive)
Three independent modules:

| Module | Name | Function |
|--------|------|----------|
| NICE | Normal Input and Control Executive | Operator interface, paper tape loading |
| SPAN | Storage Planning and Allocation | Primary/secondary memory management |
| TSS | Time Sharing Supervisor | Interrupt handling, I/O management |

### SPAN Utilities
| Call | Action |
|------|--------|
| `ALLOC` | Reserve space in primary memory (may return "No Room") |
| `DELETE` | Free space no longer needed |
| `BANISH` | Move chapter to secondary storage |
| `RECALL` | Bring chapter into primary storage |

### Other Systems Mentioned
- **SysD**: Simple paper tape loader (commissioning floor)
- **DES**: Disc Executive System (standalone, full memory access)
- **DES2**: DES with slave area for second program
- **DES BATCH**: Batch job operating system
- **T30C**: Batch mode system
- **KOS**: Kent On-line System (multi-access, used Protected Mode)

---

## 7. Testable Requirements

### Memory Protection
1. Base/Range registers must be 10-bit each
2. Access outside `[Base*1024, (Base+Range)*1024)` must trap
3. Trap must switch to Executive Mode
4. Executive Mode bypasses all protection checks

### Mode Transitions
1. `EXEN` must enter Executive Mode immediately
2. `PMEN` must load Base, Range, Alarm Clock, then enter Protected Mode
3. Protection violation in Protected Mode must enter Executive Mode

### Real-Time Clock
1. Clock must interrupt once per second
2. Alarm setting via PMEN must trigger termination after N seconds
3. Alarm only applies in Protected Mode

### Interrupt Priorities
1. Hesitation > Attention > Normal
2. Higher priority interrupts must preempt lower
3. TSS-style handlers must be callable at each level

---

## 8. Test Cases

### TC-E6X4-01: Memory Protection Enforcement
```
Setup:
  - Base = 10 (permits 10240-...)
  - Range = 2 (permits ...through 12287)
  - Enter Protected Mode via PMEN

Test:
  - Access address 10240: SHOULD succeed
  - Access address 12287: SHOULD succeed
  - Access address 12288: SHOULD trap to Executive Mode
  - Access address 10239: SHOULD trap to Executive Mode

Verify: executiveMode flag becomes true after violation
```

### TC-E6X4-02: EXEN Instruction
```
Setup: In Protected Mode

Test: Execute EXEN

Verify:
  - executiveMode becomes true
  - No protection checking on subsequent accesses
```

### TC-E6X4-03: PMEN Instruction
```
Setup: In Executive Mode

Test: Execute PMEN with Base=5, Range=3, Alarm=10

Verify:
  - baseReg = 5
  - rangeReg = 3
  - rtcDelay = 10 (or equivalent)
  - executiveMode becomes false
```

### TC-E6X4-04: Real-Time Clock Interrupt
```
Setup: rtcCounter at 0

Test: Advance simulated time by 1 second

Verify: Hesitation-level interrupt raised
```

### TC-E6X4-05: Alarm Clock Termination
```
Setup:
  - Protected Mode with Alarm=3 seconds
  - Running user program

Test: Advance simulated time by 3 seconds

Verify:
  - User program terminated/suspended
  - Executive Mode entered
```

### TC-E6X4-06: Interrupt Priority
```
Setup: All three levels pending

Test: Process interrupts

Verify:
  - Hesitation serviced first
  - Then Attention
  - Then Normal
```

---

## 9. Implementation Notes

### Current Emulator Status
The emulator (`elliott4130-core.js`) already implements:
- `executiveMode` flag
- `baseReg` and `rangeReg` (10-bit)
- `checkProtection()` method
- Three interrupt levels (`INT_HESITATION`, `INT_ATTENTION`, `INT_NORMAL`)
- `rtcCounter` and `rtcDelay` for Real-Time Clock

### Gaps Identified
1. **EXEN/PMEN instructions**: Need to verify implementation exists
2. **Alarm clock termination**: Need to verify it enters Executive Mode
3. **Protection violation vector**: Need to verify trap address

### Historical Note
Per E6X4: "multiprogramming facilities were seldom activated... except in KOS"
- Most software ran in Executive Mode
- Protection primarily used by KOS (Kent On-line System, 1968-1970)
- Emulator can default to Executive Mode for compatibility
