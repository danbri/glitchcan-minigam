# UX Review — Calendar
_First-time user, no prior knowledge. Headless Chromium, desktop + mobile._

## Top findings
- [major] **Desktop "Title" input is not keyboard-accessible.** The field renders visually in the "New event" dialog and has correct dimensions, but `offsetParent` is null for the first text input that appears (zero bounding rect). Playwright — a reliable proxy for assistive technology and keyboard-driven entry — could not focus or type into it. The save flow only worked after forcing the value via `element.value` + dispatched events. A real user who relies on tab navigation or a screen reader cannot fill in the event title on desktop.
- [major] **"Day" view button does not function.** Clicking "Day" produces no visible change: the view stays on whatever was last shown (Month or Week). The button has no apparent effect. A user who expects a single-day timeline view cannot access it.
- [minor] **Event title is truncated with no tooltip in month/week view.** On the month grid, the event shows "10:00 AM Team me..." — no hover tooltip or expand affordance was detected to see the full title. Users with longer names have no way to confirm what they created without switching to Agenda view.
- [minor] **The form has no placeholder text in the Title field.** Nothing signals what to type there — the field is blank with just a label above. Location has "Search for a place…" which is better. Low discoverability for first-time users.
- [minor] **"Repeat count (optional)" field is hidden when repeat is "Does not repeat."** Arguably correct, but the day-of-week toggles (S M T W T F S) remain visible even when repetition is off, which looks like broken UI to a new user.
- [none] **Navigation, view switching (Month/Week/Agenda), event persistence, and search bar are all present and coherent.** The calendar's overall shape (left sidebar for calendars, top toolbar with view switcher, ‹ › Today navigation, + Event button) matches user expectations from Google Calendar or Apple Calendar.

---

## Task 1 — Viewing schedule and adding an event (desktop)
**What I tried:** Clicked the 📅 Calendar icon in the left rail, observed the month view, clicked Week and Day view buttons, then clicked "+ Event" to create an event for tomorrow.

**What I observed:** Calendar opened immediately with a clean month view showing June 2026. Today (Fri 26) was highlighted with a shaded background. Month/Week/Agenda view buttons worked correctly — week view shows a 7-column hourly grid labeled Sun 21 – Sat 27, agenda view shows events in a date-grouped list. The "+ Event" dialog opened on the first click and showed a well-structured form: Title, Location, Calendar dropdown, All-day checkbox, Start/End datetime pickers, Description, Repeat options (including day-of-week toggles), Reminder, Organizer email, Attendees. After forcing the title value programmatically and saving, the event appeared on Sat 27 in month view ("10:00 AM Team me...") and fully in Agenda view ("Saturday, June 27 / 10:00 AM / Team meeting tomorrow"). Search field is present but was not tested for retrieval.

**Friction:** The Title input field cannot be typed into via normal keyboard interaction (zero bounding rect on the first `input[type=text]` that Playwright found before the dialog was open). This is the single biggest barrier: a user pressing Tab after opening the form, or clicking the field, should be able to type immediately. Instead, the field may have a focus/z-index or visibility bug that prevents standard interaction. Day view button had no effect at all — clicking it left the display unchanged with no error.

**Severity:** major (Title input inaccessibility), major (Day view broken), minor (truncation in month cells)

**Suggestions:** Fix the Title input so it receives focus on dialog open and accepts keyboard input. Implement or surface the Day view. Add a placeholder like "Add title" to the Title field. Show event full title on hover (tooltip). Consider auto-scrolling week/day view to business hours (8 am) rather than 1 am on open.

---

## Task 2 — Viewing and adding an event on mobile
**What I tried:** Loaded the app at 390×844 (iPhone-sized, touch-enabled). The app opened to the Editor with a bottom navigation bar showing icons+labels for all apps. Tapped Calendar. Tapped "+ Event". Filled in title (via tap + virtual keyboard simulation), set start datetime to tomorrow at 2 PM. Scrolled to Save and tapped it.

**What I observed:** Mobile layout is well-adapted. The left desktop rail becomes a bottom tab bar with emoji icons + labels — discoverable and thumb-friendly. Calendar opens with the same Month/Week/Day/Agenda toolbar at the top, plus a "☰" sidebar toggle for the calendar list. The "+ Event" button is prominent (brown, top-right). The "New event" dialog rendered in a full-width modal sheet with all fields accessible by scrolling. The Title field WAS focusable on mobile (unlike desktop). Start/End used `datetime-local` native pickers which trigger the OS date/time wheel on real devices — standard and correct. The save flow completed, and the event persisted. No layout overflow was detected (no elements wider than the viewport).

**Friction:** The Save button is below the fold and requires scrolling down past Repeat day-of-week toggles, Repeat count, Reminder, Organizer email, and Attendees — that is six fields to scroll past after filling just title + time. On a 390px screen with a virtual keyboard raised, Save is likely not reachable without closing the keyboard first. The "Repeat count (optional)" label appears with no input box visible (it is hidden), which looks like a rendering error. Day-of-week circles (S M T W T F S) with no label showing their purpose will confuse first-time users who aren't scheduling a recurring event.

**Severity:** minor (Save buried below fold with keyboard up), minor (orphaned day-of-week circles), none for layout/navigation overall

**Suggestions:** Move Save to the top of the dialog (sticky header with X / Save), or add a fixed footer with Save. Hide the repeat day-of-week row entirely when "Does not repeat" is selected. Add a "Quick add" path: tap a day cell → small popover with just title + time → Save, like Google Calendar's two-step flow.

---

## Overall impression
The Calendar module has the right bones: month/week/agenda views work, event data persists within the session, mobile navigation is well-structured, and the form captures all the fields a user would expect. However, two issues need fixing before it feels production-ready: the desktop Title field interaction bug would leave any new user stuck at the first step of event creation, and the Day view button does nothing. Visually the design is clean and consistent with the rest of the edot suite. With those two issues resolved and the Save button made reachable on mobile without scrolling, this would be a solid first-version calendar.
