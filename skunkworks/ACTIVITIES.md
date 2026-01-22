# Activities, Not Windows

## The Problem

**OS model:** Windows are rectangles with processes. No meaning.

**Browser model:** Tabs are documents inside one app. Can't escape.

**User reality:** "I'm working on Project X" spans:
- 5 browser tabs (research, docs, email thread)
- 1 editor window (code)
- 1 terminal (running tests)
- 1 chat thread (with teammate)
- 1 music player (background)

Neither model captures this. User has to mentally track "Project X" across unrelated windows/tabs.

---

## Historical Attempts

### Windows Sets (2018, cancelled)
Microsoft tried adding tabs to every window. Would have unified browser tabs and app windows. Killed - too disruptive to app model.

### macOS Spaces (2009+)
Virtual desktops. User manually assigns windows to spaces. Problems:
- Manual assignment = friction
- No semantic meaning (just "Desktop 2")
- Apps can span spaces awkwardly
- No persistence across restarts

### Arc Browser (2022+)
Spaces = separate tab groups with different profiles. Easels = spatial canvases. Problems:
- Still trapped inside browser
- Can't include non-browser windows
- Spaces are manual, not inferred

### Android Recent Apps
Shows Chrome tabs individually in app switcher. Better! But:
- Only for mobile
- No grouping by activity
- No cross-app activity concept

### PWAs (Progressive Web Apps)
Web pages that "escape" the tab, become standalone windows. Problems:
- Lose browser chrome (back, forward, URL bar)
- Lose extensions
- No deep integration with other apps

---

## The Synthesis: Activity as Entity

An **Activity** is an entity in Timeline OS:

```javascript
{
  id: 'activity:paper-writing-2024',
  facets: {
    identity: {
      name: 'Writing paper on X',
      icon: '📝',
      color: '#58a6ff'
    },
    temporal: {
      created: '2024-06-01T09:00:00Z',
      lastActive: '2024-06-15T16:30:00Z',
      totalTime: 'PT47H23M'  // 47 hours spent
    },
    composition: {
      // What's IN this activity
      windows: [
        { type: 'browser-tab', url: 'https://arxiv.org/...', title: 'Paper 1' },
        { type: 'browser-tab', url: 'https://arxiv.org/...', title: 'Paper 2' },
        { type: 'browser-tab', url: 'https://docs.google.com/...', title: 'Draft' },
        { type: 'app-window', app: 'VSCode', path: '/projects/paper/' },
        { type: 'app-window', app: 'Terminal', cwd: '/projects/paper/' },
      ],
      pinned: [
        { type: 'browser-tab', url: 'https://spotify.com', title: 'Focus playlist' }
      ],
      layout: {
        // Spatial arrangement when activity is active
        primary: { windows: [0, 1, 2], split: 'horizontal' },
        secondary: { windows: [3, 4], split: 'vertical' }
      }
    },
    social: {
      collaborators: ['entity:alice', 'entity:bob'],
      visibility: 'private'
    },
    semantic: {
      topics: ['machine learning', 'research', 'writing'],
      project: 'entity:project-x',
      deadline: '2024-07-01'
    }
  },
  links: [
    { relation: 'part-of', target: 'entity:project-x' },
    { relation: 'involves', target: 'entity:alice' },
    { relation: 'deadline', target: 'entity:event-conference' }
  ]
}
```

---

## Window/Tab as Entity

Individual windows and tabs are also entities:

```javascript
{
  id: 'window:chrome-tab-abc123',
  facets: {
    identity: {
      title: 'Attention Is All You Need - arXiv',
      url: 'https://arxiv.org/abs/1706.03762',
      favicon: '...'
    },
    temporal: {
      opened: '2024-06-15T10:00:00Z',
      lastViewed: '2024-06-15T14:30:00Z',
      viewTime: 'PT2H15M'
    },
    media: {
      representations: {
        'text/html': { url: '...', cached: true },
        'application/pdf': { url: '...pdf' },
        'text/plain': { extracted: '...' }  // For search
      },
      screenshot: 'blob:thumb123'
    },
    semantic: {
      topics: ['transformers', 'attention', 'NLP'],
      autoTags: ['research', 'paper', 'AI'],
      readingProgress: 0.7  // 70% scrolled
    }
  },
  links: [
    { relation: 'part-of', target: 'activity:paper-writing-2024' },
    { relation: 'cites', target: 'window:chrome-tab-def456' },  // Link to another paper
    { relation: 'referenced-in', target: 'entity:doc-draft' }
  ]
}
```

---

## How It Works

### 1. Activity Detection (AI-assisted)

Instead of manual grouping, AI suggests activities:

```
System detects:
- User opened 5 arxiv tabs in 10 minutes
- User opened Google Doc "Paper Draft"
- User switched to VSCode in /projects/paper/

AI suggests:
┌─────────────────────────────────────────────────┐
│ Create activity "Research & Writing"?           │
│                                                 │
│ Detected pattern: research papers + writing doc │
│ + code editing in same directory                │
│                                                 │
│ [Create Activity]  [Not Now]  [Never for this] │
└─────────────────────────────────────────────────┘
```

### 2. Activity Switching

Instead of alt-tab through random windows:

```
┌─────────────────────────────────────────────────────────┐
│ Activities                                    ⌘+Space   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📝 Writing paper on X          2h ago    ████████░░   │
│     5 tabs, VSCode, Terminal                           │
│                                                         │
│  ✈️  Planning trip              yesterday  ███░░░░░░░   │
│     4 tabs, spreadsheet                                │
│                                                         │
│  💬 Team standup               3h ago      ██░░░░░░░░   │
│     Slack, calendar, notes                             │
│                                                         │
│  🎵 Background                 always      ░░░░░░░░░░   │
│     Spotify (pinned across activities)                 │
│                                                         │
│  [+ New Activity]                                      │
└─────────────────────────────────────────────────────────┘
```

Switching activities:
1. Saves current window positions
2. Hides windows not in new activity
3. Restores new activity's layout
4. Optionally resumes where you left off (scroll positions, cursor)

### 3. Cross-Activity Windows

Some windows belong to multiple activities or "float":

```javascript
// Spotify is background music for everything
{
  id: 'window:spotify',
  facets: {
    composition: {
      floats: true,  // Visible across all activities
      position: 'pip-bottom-right'
    }
  }
}

// Slack thread relevant to two activities
{
  id: 'window:slack-thread-123',
  links: [
    { relation: 'part-of', target: 'activity:paper-writing' },
    { relation: 'part-of', target: 'activity:team-standup' }
  ]
}
```

### 4. Activity Timeline

Activities appear in the main timeline:

```
10am  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  4pm
       │         │              │           │
       │         │              │           └─ Switched to "Trip planning"
       │         │              └─ Opened new paper tab
       │         └─ Created "Paper writing" activity
       └─ Morning email
```

Scrubbing the timeline can restore activity state at that point (window positions, open tabs, even scroll positions if cached).

---

## Browser Integration

Browsers would need to expose tab state via extension/API:

```javascript
// Extension sends tab state to Timeline OS
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  timelineOS.postMessage({
    type: 'tab-update',
    tabId,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl
  });
});

// Timeline OS can request tab grouping
timelineOS.addEventListener('message', (msg) => {
  if (msg.type === 'focus-tabs') {
    chrome.tabs.highlight({ tabs: msg.tabIds });
  }
  if (msg.type === 'group-tabs') {
    chrome.tabs.group({ tabIds: msg.tabIds, title: msg.name });
  }
});
```

### Arc-Style Integration (Deeper)

For browsers like Arc that already have spaces:

```javascript
// Bidirectional sync
arcSpaces.onSpaceChange((space) => {
  timelineOS.syncActivity({
    sourceApp: 'arc',
    spaceId: space.id,
    name: space.name,
    tabs: space.tabs
  });
});

timelineOS.onActivityChange((activity) => {
  arcSpaces.sync({
    activityId: activity.id,
    tabs: activity.facets.composition.windows.filter(w => w.type === 'browser-tab')
  });
});
```

---

## Native App Integration

For non-browser apps, integration via:

### 1. Accessibility API (read-only, universal)
```javascript
// macOS accessibility
const runningApps = AXUIElement.systemWide().windows();
// Can detect: app name, window title, position, size
// Cannot: deep state, document content
```

### 2. App-Specific Plugins
```javascript
// VSCode extension
vscode.workspace.onDidOpenTextDocument((doc) => {
  timelineOS.postMessage({
    type: 'document-open',
    app: 'vscode',
    path: doc.uri.fsPath,
    language: doc.languageId
  });
});
```

### 3. File Watching
```javascript
// Infer activity from file access
fsWatch('/projects/paper/', (event) => {
  timelineOS.hint({
    type: 'file-activity',
    path: event.path,
    suggestedActivity: 'activity:paper-writing'
  });
});
```

---

## Privacy Considerations

Activities contain sensitive data (what you're working on, when, with whom).

**Mitigations:**

1. **Local-first**: Activity data stays on device by default
2. **Facet-level control**: Maybe sync activity names but not tab URLs
3. **Work/Personal separation**: Different activity namespaces
4. **Selective sharing**: Share "Project X" with collaborators, keep personal hidden

```javascript
// Activity visibility settings
{
  id: 'activity:paper-writing',
  facets: {
    privacy: {
      syncToCloud: false,
      shareWith: ['entity:alice'],  // Co-author can see
      excludeFromTimeline: false,
      hideSensitiveTabs: ['banking.com']
    }
  }
}
```

---

## Relation to FINK

A FINK story session could be an activity:

```javascript
{
  id: 'activity:playing-hampstead',
  facets: {
    identity: {
      name: 'Playing Hampstead Adventure',
      icon: '🎮',
      type: 'entertainment'
    },
    composition: {
      windows: [
        { type: 'timeline-app', app: 'fink-player', story: 'hampstead.fink.js' }
      ]
    },
    temporal: {
      started: '2024-06-15T20:00:00Z',
      playTime: 'PT45M'
    },
    progress: {
      storyState: { knot: 'the_beach', variables: { score: 5 } },
      percentComplete: 0.6
    }
  }
}
```

Switching away preserves story state. Switching back restores exactly where you were.

---

## Summary

| Concept | Old Model | Timeline OS |
|---------|-----------|-------------|
| What you're doing | "Chrome window" | "Activity: Paper writing" |
| Grouping | Manual (or none) | AI-suggested, user-confirmed |
| Switching | Alt-tab through rectangles | Activity picker with context |
| State | Lost on close | Persisted in entity |
| History | Browser back button | Full timeline with branches |
| Sharing | Screenshot | Sync activity entity |

The insight: **Activities are entities**, not window arrangements. They have identity, temporal extent, semantic meaning, and can be linked to projects, people, and events.
