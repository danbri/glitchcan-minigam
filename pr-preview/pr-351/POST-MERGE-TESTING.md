# Running Tests After PR Merge

Quick guide for running the headless browser tests after the testing framework is merged into main/master.

---

## Important: All Tests Are "Headless"

The tests run in **headless browser mode** (no visible window). There are no "non-headless" tests in this framework.

**Headless** = Browser runs in background without GUI (perfect for CI/CD and servers)

---

## Option 1: GitHub Actions (Automatic) ⭐ RECOMMENDED

Tests run automatically without any manual work.

### Setup (One-Time):

**Enable the workflow:**
```bash
# Move template to workflows directory
mv e2e-tests.yml.template .github/workflows/e2e-tests.yml
git add .github/workflows/e2e-tests.yml
git commit -m "Enable E2E testing workflow"
git push
```

### What Happens:

✅ Tests run automatically on **every push** to main or claude/* branches
✅ Tests run on **every pull request**
✅ GitHub installs Chromium (no download restrictions)
✅ Results appear in PR checks
✅ Artifacts uploaded on failure (screenshots, videos, reports)

### View Results:

1. Go to **Actions** tab in GitHub
2. Click on latest workflow run
3. See test results, download artifacts
4. Or check PR status checks

**Cost:** Free on GitHub (2,000 minutes/month for public repos)

---

## Option 2: Local Development Machine

Run tests on your laptop/desktop.

### Setup:

```bash
# Clone repository
git clone https://github.com/danbri/glitchcan-minigam.git
cd glitchcan-minigam

# Install dependencies
npm install

# Install Chromium browser
npx playwright install chromium

# Start local server (in one terminal)
npm run server

# Run tests (in another terminal)
npm test
```

### Test Commands:

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:fink          # FINK Player tests only
npm run test:gridluck      # GridLuck tests only
npm run test:smoke         # Smoke tests only

# Run with UI (interactive mode)
npm run test:ui

# Run in debug mode
npm run test:debug

# View test report
npm run test:report
```

### Watch Mode:

```bash
# Re-run tests on file changes
npx playwright test --ui
```

**Best for:** Development, debugging, trying changes

---

## Option 3: Custom Binary (Restricted Environments)

For environments with CDN download restrictions (like this Claude Code environment).

### Setup:

**A) Create GitHub Release with Chromium:**
```bash
# On unrestricted machine:
npx playwright install chromium
cd ~/.cache/ms-playwright/chromium-*/
tar -czf chromium-linux.tar.gz chrome-linux/

# Upload to GitHub releases
gh release create chromium-v1 chromium-linux.tar.gz
```

**B) Update download URL in `setup-chrome.sh`:**
```bash
# Edit line 9:
CHROME_URL="https://github.com/danbri/glitchcan-minigam/releases/download/chromium-v1/chromium-linux.tar.gz"
```

**C) Run tests:**
```bash
# Download happens automatically
npm test

# Or manually:
npm run setup-chrome  # Downloads binary
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=./chrome-linux/chrome
npm test
```

**Best for:** CI/CD with restricted network, containerized environments

---

## Option 4: Docker Container

Use pre-built image with browsers installed.

### Setup:

```bash
# Pull Playwright image
docker pull mcr.microsoft.com/playwright:v1.56.1

# Run tests in container
docker run --rm \
  -v $(pwd):/work \
  -w /work \
  mcr.microsoft.com/playwright:v1.56.1 \
  npm test
```

### With Docker Compose:

```yaml
# docker-compose.yml
version: '3'
services:
  playwright:
    image: mcr.microsoft.com/playwright:v1.56.1
    volumes:
      - .:/work
    working_dir: /work
    command: npm test
```

```bash
docker-compose run playwright
```

**Best for:** Consistent environment, CI/CD, multiple developers

---

## Option 5: Continuous Testing (Watch Files)

Run tests automatically when code changes.

### Setup:

```bash
# Install nodemon
npm install -g nodemon

# Watch for changes
nodemon --watch tests/ --watch inklet/ --watch thumbwar/ --exec "npm test"
```

**Or use Playwright UI:**
```bash
npm run test:ui  # Opens interactive UI with auto-rerun
```

**Best for:** Active development

---

## Which Option Should You Use?

| Scenario | Best Option | Why |
|----------|-------------|-----|
| **Just merged PR** | GitHub Actions | Automatic, no setup needed |
| **Developing locally** | Local Machine | Fast feedback, full control |
| **CI/CD pipeline** | GitHub Actions or Docker | Consistent, automated |
| **Restricted network** | Custom Binary | Bypasses CDN restrictions |
| **Team collaboration** | GitHub Actions | Everyone sees results |

---

## Test Output Examples

### Success:
```
Running 50 tests using 4 workers

  ✓ fink-player.spec.js:10:3 › should load FINK player (245ms)
  ✓ fink-player.spec.js:20:3 › should display choices (189ms)
  ✓ gridluck.spec.js:15:3 › should render canvas (156ms)

  50 passed (23.4s)
```

### Failure:
```
  ✗ fink-player.spec.js:10:3 › should load FINK player (5.2s)

    Error: page.locator('#story-title')
    Expected: visible
    Received: hidden

    Screenshot: test-results/fink-player-should-load.png
    Video: test-results/video.webm
```

### Reports:

After tests run:
```bash
npx playwright show-report
```
Opens HTML report in browser with:
- Test results
- Screenshots
- Videos
- Traces
- Filtering/sorting

---

## Troubleshooting

### "Browser not found"
```bash
# Install Chromium
npx playwright install chromium

# Or use custom binary
npm run setup-chrome
```

### "Tests timeout"
```bash
# Increase timeout in playwright.config.js
timeout: 60 * 1000,  // 60 seconds instead of 30
```

### "Port 8080 in use"
```bash
# Kill existing server
lsof -ti:8080 | xargs kill

# Or use different port
BASE_URL=http://localhost:9090 npm test
```

### "Tests fail on CI but pass locally"
```bash
# Run in CI mode locally
CI=true npm test

# Check for timing issues
# Add waits or increase timeouts
```

---

## Test Configuration

### Run Specific Browser:
```bash
# Desktop Chrome only
npx playwright test --project=chromium

# Mobile Chrome only
npx playwright test --project=mobile-chrome

# iPad only
npx playwright test --project=tablet
```

### Parallel Execution:
```bash
# Run with 4 workers (default)
npm test

# Run serially (one at a time)
npx playwright test --workers=1
```

### Update Screenshots:
```bash
# Update baseline screenshots
npx playwright test --update-snapshots
```

---

## CI/CD Integration Examples

### GitHub Actions (Already provided):
See `e2e-tests.yml.template`

### GitLab CI:
```yaml
test:
  image: mcr.microsoft.com/playwright:v1.56.1
  script:
    - npm install
    - npx playwright test
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
```

### Jenkins:
```groovy
pipeline {
  agent {
    docker {
      image 'mcr.microsoft.com/playwright:v1.56.1'
    }
  }
  stages {
    stage('Test') {
      steps {
        sh 'npm install'
        sh 'npx playwright test'
      }
    }
  }
  post {
    always {
      publishHTML([
        reportDir: 'playwright-report',
        reportFiles: 'index.html',
        reportName: 'Test Report'
      ])
    }
  }
}
```

---

## Cost & Performance

### GitHub Actions (Free Tier):
- **2,000 minutes/month** for public repos
- Each test run: ~2-5 minutes
- **~400-1000 runs/month** for free

### Local:
- **Free** (uses your machine)
- Faster (no setup time)
- Uses ~500 MB disk (Chromium)

### Docker:
- **Free** (pulls image once)
- ~1.5 GB disk space
- Slower first run (image download)

---

## Next Steps After Tests Pass

1. **Add status badge to README:**
```markdown
[![Tests](https://github.com/danbri/glitchcan-minigam/workflows/E2E%20Browser%20Tests/badge.svg)](https://github.com/danbri/glitchcan-minigam/actions)
```

2. **Set up branch protection:**
   - Require tests to pass before merging
   - Settings → Branches → Add rule

3. **Expand test coverage:**
   - Add tests for remaining 11 games
   - Add visual regression tests
   - Add performance tests

4. **Monitor test health:**
   - Track flaky tests
   - Update timeouts as needed
   - Keep browsers updated

---

## Quick Reference

| What | Command |
|------|---------|
| **Run all tests** | `npm test` |
| **Run specific file** | `npx playwright test tests/fink-player.spec.js` |
| **Debug mode** | `npm run test:debug` |
| **UI mode** | `npm run test:ui` |
| **Update snapshots** | `npx playwright test --update-snapshots` |
| **View report** | `npm run test:report` |
| **Install browser** | `npx playwright install chromium` |
| **Start server** | `npm run server` |

---

## Questions?

- **Full docs:** See `TESTING.md`
- **Test examples:** See `tests/README.md`
- **Custom binary:** See `CUSTOM-BINARY-ASSESSMENT.md`
- **Workflow setup:** See `WORKFLOW-SETUP.md`
- **Playwright docs:** https://playwright.dev/

---

**TL;DR:** After merge, enable GitHub Actions workflow = automatic testing on every push. Or run `npm test` locally after `npx playwright install chromium`.
