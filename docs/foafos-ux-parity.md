# Foafos UX: what "the best of desktop, mobile and the web" means, checked

Status: 2026-11-13. The goal is a shell that offers what people already know from desktop
systems (macOS, Windows, GNOME), from phones (iOS, Android) and from the web (browser tabs,
Back), in four areas. This page lists, for each area, the features those systems share, and
whether foafos has each one. "Done" items name the pull request and are each covered by a test
in `inklet/finkapp/test/e2e-shell-ux.mjs` or `e2e-files-locations.mjs`. "Open" items are the
next small steps.

The finish line this proposes: every item below is done, or the owner has struck it out. A second
round of items was added once the first was done (2026-11-13); the owner may add more rows.

## File browser (Files)

| Feature (where people know it from) | Status |
|---|---|
| Back and Forward, with Alt+arrows, Cmd+[ ], mouse buttons (all desktops, browsers) | Done: #1046 |
| Up a folder: Backspace, Alt+Up; Home and End; arrows in the icon view (desktops) | Done: #996, #1001 |
| Type a name to jump to it (desktops) | Done: type-ahead in the list |
| Cmd or Ctrl + Down opens, Cmd, Ctrl or Alt + Up goes up from anywhere in Files, the keyboard landing where you were (Finder, Explorer) | Done: #1134 |
| Go to a folder by typing its path: /, Cmd or Ctrl + Shift + G, or click the current folder's name (GNOME Files, Finder, Explorer's address bar) | Done: #1125 |
| Copy path from an item's menu; a file's path in Go to folder opens its folder with it chosen (Finder's Copy as pathname) | Done: #1161 |
| Filter this folder; search every folder and inside files (desktops, phones) | Done: #1025, #1029 |
| List and icon views, sort by any column, both kept (desktops) | Done: #1017, #1020 |
| Bigger or smaller icons: Ctrl or Cmd + plus and minus, Ctrl + the wheel or a trackpad pinch, two fingers on a phone; kept with the view (Finder, Explorer, phone photo apps) | Done: #1162, #1163 |
| A Sort picker where the list has no column heads (a narrow window, a phone): name, newest, largest, kind (phone file managers) | Done: #1150 |
| Names sort as people expect: Photo 2 before Photo 10, capitals aside (Finder, Explorer) | Done: #1123 |
| Thumbnails for pictures (desktops, phones) | Done: #1018 |
| Quick Look: Space shows an item without opening it (macOS) | Done: #1015 |
| Where the space goes: a treemap (desktop disk tools) | Done: #1021, #1024 |
| Status bar: items, size, room left under a limit (desktops) | Done: #1064 |
| Opens at the folder you were in (desktops, phones) | Done: #1058 |
| The folder keeps up with files saved by other apps; pull down to refresh on a phone (desktops, phones) | Done: #1108 |
| Recent files (desktops, phones) | Done: #1072 |
| New file, new folder, rename (F2), delete with a question (desktops) | Done: #1004 |
| A right-click (or the Menu key, Shift+F10) on an item opens its menu: Open, Rename, Duplicate, Copy, Cut, Download, Compress, Trash; on several chosen, for them all (every desktop) | Done: #1155 |
| A right-click or long press on a folder's empty space opens its menu: New file, New folder, Upload, Paste, Choose all, view, Look for changes; a long press on a phone (Finder, Explorer, Android) | Done: #1156, #1157 |
| Duplicate a file, or a folder with all in it (macOS) | Done: #1034, #1149 |
| Drop files from the computer; paste files, screenshots and text (desktops) | Done: #1009, #1053 |
| Download a file to this computer, one or several (web file managers) | Done: #1112 |
| Download a folder as one .zip (web file managers) | Done: #1113 |
| Compress a folder or what is chosen into a .zip beside it, never over one there (Finder's Compress, Explorer's Send to zip) | Done: #1144 |
| Extract a .zip into a new folder beside it (opening a .zip in Finder, Explorer's Extract all) | Done: #1145 |
| Upload files, or a folder keeping its shape, with the system picker (web and phone file managers) | Done: #1116 |
| Rename a folder (F2 or Rename), and never rename over something already there (desktops) | Done: #1117 |
| A picked folder says what is in it, and its total size on request (Get Info, Properties) | Done: #1118 |
| Copy, cut and paste between folders (desktops) | Done: #1061, #1069 |
| Move a folder, by drag or cut and paste; delete an empty folder (desktops) | Done: #1114 |
| Drop a file or folder onto a folder in the path bar to move it there (Finder's path bar, Explorer's address bar) | Done: #1138 |
| Drag onto a folder to move (desktops) | Done: #1036, #1071 |
| Choose several: Ctrl/Cmd + click, Shift + click, Ctrl/Cmd + A (desktops) | Done: #1067, #1070 |
| Choose several by touch: long press, then taps, with a bar (phones) | Done: #1075 |
| Archives open as folders (macOS, Windows, GNOME) | Done: #1026 |
| Shift + arrows to extend a choice from the keyboard (desktops) | Done: #1080 |
| Drag a box over the empty space, or from beside a name in the list, to choose what it touches; Ctrl or Cmd adds (Finder, Explorer, GNOME Files) | Done: #1129, #1130 |
| A Trash to take deleted files back from, and Undo right after a delete (desktops, phones) | Done: #1083 |
| Folders go to the Trash whole, and come back whole (desktops) | Done: #1115 |
| Copy a folder and what is in it (desktops) | Done: #1082 |
| Folders you use often, kept in the side panel (Finder sidebar, Explorer Quick access) | Done: #1081 |
| A right-click on a folder in the side panel: Open, New folder in it, Download as .zip, Keep in or Remove from the side panel (Finder's sidebar, Explorer's navigation pane) | Done: #1158 |

## Task switching

| Feature | Status |
|---|---|
| All windows as cards, minimised ones too; pick by click, number or arrows (Mission Control, Task View) | Done: #993, #999, #1000 |
| Close all from All windows, asking once first; one Reopen brings them all back (Android's Clear all, a browser's reopen closed window) | Done: #1148, #1151 |
| Hold the menu handle for All windows, as holding a phone's gesture bar shows recent apps; its title lists every gesture | Done: #1133 |
| Type a name in All windows to narrow it (GNOME overview) | Done: #1047 |
| A window's title says what is open in it (Files — notes, Notes — trip), the app's name always first: foafos.setTitle (every desktop) | Done: #1135, #1136 |
| The Task Manager names each window by its title too, so two windows of one app can be told apart and filtered (Windows' Task Manager) | Done: #1152, #1153 |
| Next window of the same app: Ctrl ; ` or the window menu (a Mac's Cmd+`, GNOME Super+`) | Done: #1126 |
| Close a window from All windows with a middle click, or Delete on its card (browser tabs, GNOME overview) | Done: #1124 |
| A right-click on an All windows card: Show, Snap left or right, Move to another workspace, Close (Windows' Task View) | Done: #1159 |
| No window by that name: All windows offers the app, and Enter opens it (GNOME overview search) | Done: #1102 |
| Swipe a card up to close it; tap the space around to leave (phones) | Done: #1006, #1031 |
| The hint speaks of taps on a touch screen, keys on a keyboard | Done: #1056 |
| Next and previous window by key (Ctrl ; j, k) | Done: #1002, #1032 |
| Back to the window used last, and back again (one Alt+Tab, Cmd+Tab) | Done: #1059 |
| Swipe sideways along a full-screen window's bar to switch (phones' bottom bar) | Done: #1063 |
| Task Manager: everything running, pause, close, bring back a minimised one (desktops) | Done: #1011, #1073 |
| Back closes All windows and All apps rather than leaving the shell (phones, browsers) | Done: #1060 |
| A switcher that shows while a key is held and cycles while it is pressed again: Ctrl ; ; held (Alt+Tab held) | Done: #1084 |

## App and widget discovery

| Feature | Status |
|---|---|
| All apps in folders, with search over names, descriptions and folders (Start, Launchpad, app drawers) | Done: #995, #1014 |
| Search puts the best name match first, and Enter opens it (Spotlight, Start) | Done: #1054 |
| Search files from All apps: a row hands what was typed to Files, which searches every folder with its own access (Start menu, Spotlight) | Done: #1131 |
| What each app or widget does, in search and on a long press or right-click (phones, desktops) | Done: #997, #1007, #1062 |
| An app's sheet says what it may do, in plain words, from its manifest (a phone's App info permissions) | Done: #1146 |
| Pin apps and widgets to a Pinned folder (Start, docks, home screens) | Done: #1033, #1035 |
| Pin or unpin an app from its window's menu (a taskbar's Pin to taskbar, a dock's Keep in Dock) | Done: #1143 |
| Widgets opened from All apps show in Recent with the apps (phones' recent widgets, Start's Recent) | Done: #1137 |
| Pinned apps in your own order: Alt+arrows, or Move earlier/later on a long press (docks, home screens) | Done: #1101 |
| A pinned app by its place, Ctrl ; 1 to 9: open it, or bring its window forward (Windows' Win+1 to 9) | Done: #1140 |
| The pinned apps as a row of icons at the top of the ☰ menu (a ring of their own in the ring menu), a dot under each open one (docks, taskbars) | Done: #1141, #1142 |
| A dot under each app that is open (docks) | Done: #1049, #1057 |
| Arrow keys through All apps; no on-screen keyboard thrown up on a phone | Done: #1008, #1013 |
| A sheet of every key, from the menu or Ctrl ; / (desktops' keyboard help, "?" on the web) | Done: #1077 |
| The desktop's own menu, from a right-click or long press on it: All apps, Widgets, All windows, Arrange, Show the desktop (Windows, a Mac, a phone's home screen) | Done: #1127 |

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
| The windows you had open come back after a reload (browsers' tab restore, macOS reopening windows) | Done: #1104 |
| Windows follow the page when it changes size (desktops, when a screen changes) | Done: #1050 |
| Resize from any edge or corner, not only the bottom-right (all desktops) | Done: #1079 |
| Double-click the top or bottom edge for the full height (Windows) | Done: #1103 |
| Keys for the four quarters: Ctrl ; i steps round them (Windows, GNOME) | Done: #1078 |
| Snap layouts: rest the mouse on Maximise to pick a half or a quarter (Windows 11) | Done: #1154 |

## Across all four

| Feature | Status |
|---|---|
| A notice that does not cover a phone's title bar, and stays in the menu | Done: #1052 |
| Every action named for screen readers; keys shown beside menu rows | Done: #1003, and each step above |
| Touch targets of about 44 px on touch screens | Done: window buttons, All apps, the bars above |
| On a touch-only screen, menus leave out what needs a keyboard (phones) | Done: #1091 |
| Everything a key does on a desktop can be reached on a phone too, e.g. workspaces from the menu | Done: #1092 |
| A phone's Back closes the innermost thing open: an app's sheet, a menu, the keys sheet, then All apps or All windows (Android) | Done: #1132 |
| High contrast (Windows' contrast themes): chosen, pressed and best-match states stay visible, by the system's Highlight and outlines | Done: #1164 |
| A screen reader hears Files' list as a grid named after the folder, which rows are chosen, and how it is sorted (Finder and Explorer with VoiceOver, Narrator) | Done: #1165 |
| Each window is a named landmark, so a screen reader jumps from window to window (VoiceOver's rotor, NVDA's D) | Done: this PR |
| A phone's Back goes back inside the app that has the screen: Files closes a file's panel, then goes back a folder (foafos.setBack; Android) | Done: #1139 |

## Second round

| Feature | Status |
|---|---|
| Show the desktop: put every window away, and bring them all back (Win+D, F11 on a Mac, GNOME Super+D) | Done: #1085 |
| Minimise the others, from the window menu (a Mac's Hide Others) | Done: #1111 |
| Keep a window on top of the others, from the window menu (GNOME, Windows PowerToys "Always on Top") | Done: #1086 |
| Files: play sound and video in the preview (Quick Look, phones) | Done: #1088 |
| Files: show PDFs in the preview, a page at a time, with pdf.js (Quick Look, phones) | Done: #1090 |
| Files: "Show in folder" from Recent and search; "Show where it was" from the Trash (desktops) | Done: #1087 |
| Search results narrowed by kind: Folders, Pictures, Documents, Sound and video, Code and data, Archives, with counts (Finder's and Explorer's search filters) | Done: #1160 |
| Workspaces: more than one desktop of windows, Ctrl ; . and , (Spaces, virtual desktops, GNOME workspaces) | Done: #1089 |
| All windows has a button for each workspace (Mission Control's row of Spaces) | Done: #1106 |
| Drag a window's card onto a workspace in All windows to move it there (Mission Control) | Done: #1107 |
| Take the front window to the next or previous workspace and go with it: Ctrl ; > and < (GNOME Shift+Super+Page Down) | Done: #1120 |
| Close all of an app's windows from its sheet in All apps (a dock's Quit) | Done: #1121 |
| Arrange this workspace's windows side by side, filling the screen: Ctrl ; g or the menu (Windows' Show windows side by side, tiling desktops) | Done: #1122 |
