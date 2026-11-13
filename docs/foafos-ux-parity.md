# Foafos UX: what "the best of desktop, mobile and the web" means, checked

Status: 2026-11-13. The goal is a shell that offers what people already know from desktop
systems (macOS, Windows, GNOME), from phones (iOS, Android) and from the web (browser tabs,
Back), in four areas. This page lists, for each area, the features those systems share, and
whether foafos has each one. "Done" items name the pull request and are each covered by a test
in `inklet/finkapp/test/e2e-shell-ux.mjs` or `e2e-files-locations.mjs`. "Open" items are the
next small steps.

The finish line this proposes: every item below is done, or the owner has struck it out.

## File browser (Files)

| Feature (where people know it from) | Status |
|---|---|
| Back and Forward, with Alt+arrows, Cmd+[ ], mouse buttons (all desktops, browsers) | Done: #1046 |
| Up a folder: Backspace, Alt+Up; Home and End; arrows in the icon view (desktops) | Done: #996, #1001 |
| Type a name to jump to it (desktops) | Done: type-ahead in the list |
| Filter this folder; search every folder and inside files (desktops, phones) | Done: #1025, #1029 |
| List and icon views, sort by any column, both kept (desktops) | Done: #1017, #1020 |
| Thumbnails for pictures (desktops, phones) | Done: #1018 |
| Quick Look: Space shows an item without opening it (macOS) | Done: #1015 |
| Where the space goes: a treemap (desktop disk tools) | Done: #1021, #1024 |
| Status bar: items, size, room left under a limit (desktops) | Done: #1064 |
| Opens at the folder you were in (desktops, phones) | Done: #1058 |
| Recent files (desktops, phones) | Done: #1072 |
| New file, new folder, rename (F2), delete with a question (desktops) | Done: #1004 |
| Duplicate (macOS) | Done: #1034 |
| Drop files from the computer; paste files, screenshots and text (desktops) | Done: #1009, #1053 |
| Copy, cut and paste between folders (desktops) | Done: #1061, #1069 |
| Drag onto a folder to move (desktops) | Done: #1036, #1071 |
| Choose several: Ctrl/Cmd + click, Shift + click, Ctrl/Cmd + A (desktops) | Done: #1067, #1070 |
| Choose several by touch: long press, then taps, with a bar (phones) | Done: #1075 |
| Archives open as folders (macOS, Windows, GNOME) | Done: #1026 |
| Shift + arrows to extend a choice from the keyboard (desktops) | Done: this PR |
| Undo the last move, copy or delete; or a Trash to take files back from (desktops, phones) | Open |
| Copy a folder and what is in it (desktops) | Done: this PR |
| Folders you use often, kept in the side panel (Finder sidebar, Explorer Quick access) | Done: this PR |

## Task switching

| Feature | Status |
|---|---|
| All windows as cards, minimised ones too; pick by click, number or arrows (Mission Control, Task View) | Done: #993, #999, #1000 |
| Type a name in All windows to narrow it (GNOME overview) | Done: #1047 |
| Swipe a card up to close it; tap the space around to leave (phones) | Done: #1006, #1031 |
| The hint speaks of taps on a touch screen, keys on a keyboard | Done: #1056 |
| Next and previous window by key (Ctrl ; j, k) | Done: #1002, #1032 |
| Back to the window used last, and back again (one Alt+Tab, Cmd+Tab) | Done: #1059 |
| Swipe sideways along a full-screen window's bar to switch (phones' bottom bar) | Done: #1063 |
| Task Manager: everything running, pause, close, bring back a minimised one (desktops) | Done: #1011, #1073 |
| Back closes All windows and All apps rather than leaving the shell (phones, browsers) | Done: #1060 |
| A switcher that shows while a key is held and cycles while it is pressed again (Alt+Tab held) | Open |

## App and widget discovery

| Feature | Status |
|---|---|
| All apps in folders, with search over names, descriptions and folders (Start, Launchpad, app drawers) | Done: #995, #1014 |
| Search puts the best name match first, and Enter opens it (Spotlight, Start) | Done: #1054 |
| What each app or widget does, in search and on a long press or right-click (phones, desktops) | Done: #997, #1007, #1062 |
| Pin apps and widgets to a Pinned folder (Start, docks, home screens) | Done: #1033, #1035 |
| A dot under each app that is open (docks) | Done: #1049, #1057 |
| Arrow keys through All apps; no on-screen keyboard thrown up on a phone | Done: #1008, #1013 |
| A sheet of every key, from the menu or Ctrl ; / (desktops' keyboard help, "?" on the web) | Done: this PR |

## Window manager

| Feature | Status |
|---|---|
| Minimise, maximise, close; double-click the bar (all desktops) | Done: #994 |
| Drag to a side, the top or a corner to snap; keys for halves and full (Windows, GNOME, macOS) | Done: #1037 |
| Snap assist: the other half offers the other windows (Windows) | Done: #1074 |
| Window menu on the title bar, with each action's keys (Windows, GNOME) | Done: #1066 |
| Move and resize with the keyboard (Windows, GNOME) | Done: #1051 |
| Reopens where it was left, at its size, maximised if it was (desktops) | Done: #1010, #1055 |
| Reopen the app closed last (browsers' reopen closed tab) | Done: #1044 |
| Windows follow the page when it changes size (desktops, when a screen changes) | Done: #1050 |
| Resize from any edge or corner, not only the bottom-right (all desktops) | Done: this PR |
| Keys for the four quarters: Ctrl ; i steps round them (Windows, GNOME) | Done: this PR |

## Across all four

| Feature | Status |
|---|---|
| A notice that does not cover a phone's title bar, and stays in the menu | Done: #1052 |
| Every action named for screen readers; keys shown beside menu rows | Done: #1003, and each step above |
| Touch targets of about 44 px on touch screens | Done: window buttons, All apps, the bars above |
