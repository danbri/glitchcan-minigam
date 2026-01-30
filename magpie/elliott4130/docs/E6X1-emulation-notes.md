# E6X1 Emulation Notes

**Source:** CCS-E6X1 "Elliott 4100 series deliveries" Issue 1, March 2004
**Original:** Pages 18-20 of "Elliott-Automation: computer orders and deliveries, 1947-1966"
**Published:** Elliott-Automation Ltd., early 1967

## Document Overview

**This is a customer delivery list, NOT a technical manual.**

Contains partial listings of:
- NCR/Elliott 4120 computers (40 delivered, 40 on order = 80 total by end-1966)
- ARCH 2020 Industrial Control Systems
- NCR/Elliott 4130 computers (20 on order by end-1966)

## Emulation-Relevant Details

**NONE.** No technical specifications, instruction details, memory layouts, timing, or hardware configurations are included in this document.

## Historical Context (Indirect Value)

### Model Differentiation
- 4120 and 4130 were distinct models in the 4100 series
- ARCH 2020 was a related Industrial Control System product

### Application Types (May Inform Test Scenarios)
Systems marked `*` were "on line" (real-time/interactive):

| Category | Examples |
|----------|----------|
| Real-time control | Refinery control, traffic control, telescope control, message switching |
| Interactive research | Conversational programming (NPL), multi-access computing (Dundee) |
| Hybrid systems | Cambridge process control research |
| Batch processing | Accounting, statistics, engineering calculations |

### Notable 4130 Customers (1966)
- Sussex University - animal behaviour study (on-line)
- Queen's College Dundee - multi-access computing system
- Cambridge University - hybrid system for process control
- Royal Observatory Edinburgh - telescope & instrument control

### Geographic Distribution
International sales: Hungary (Csepel), Czechoslovakia, Romania, East Germany (Schwedt), Australia

## Testable Requirements

**NONE derivable from this document.**

## Test Cases

**NONE derivable from this document.**

---

**Recommendation:** This document provides historical context only. For emulation specifications, refer to E6X2 (Programmer's Guide), E6X3 (Floating-Point), and other technical manuals.
