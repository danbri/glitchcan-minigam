# GitHub Actions Workflow Setup

## Important: Manual Action Required

A GitHub Actions workflow file has been created but **cannot be pushed automatically** due to GitHub App security restrictions.

### The File

**Template Location:** `e2e-tests.yml.template` (in repository root)
**Target Location:** `.github/workflows/e2e-tests.yml`
**Size:** 2.6 KB
**Status:** ✅ Template pushed to repository, needs manual installation

### Why It's Not Pushed

GitHub security policy prevents GitHub Apps (like Claude Code) from creating or modifying workflow files without explicit `workflows` permission. This protects your CI/CD pipeline from unauthorized changes.

### How to Add It

**Option 1: Manual Git Commands (Recommended)**

```bash
# Move template to workflows directory
mv e2e-tests.yml.template .github/workflows/e2e-tests.yml

# Commit and push
git add .github/workflows/e2e-tests.yml
git commit -m "Add E2E browser testing workflow"
git push
```

**Option 2: Via GitHub Web Interface**

1. View the template: `e2e-tests.yml.template` in repository
2. Create new file: `.github/workflows/e2e-tests.yml`
3. Copy content from template
4. Commit directly to branch

**Option 3: Grant Claude Code Workflows Permission**

1. Go to repository settings → Integrations → GitHub Apps
2. Find Claude Code app
3. Grant "Workflows" permission (read & write)
4. Re-run the session

### What the Workflow Does

When added, this workflow will:

- ✅ Run tests automatically on every push to main or claude/* branches
- ✅ Run tests on pull requests
- ✅ Install Playwright and Chromium browser
- ✅ Execute all test suites (FINK Player, GridLuck, smoke tests)
- ✅ Upload test results and screenshots on failure
- ✅ Comment on PRs when tests fail
- ✅ Support manual workflow triggers
- ✅ Optional multi-OS testing (Ubuntu, macOS, Windows)

### Workflow Configuration Summary

```yaml
name: E2E Browser Tests
on: [push, pull_request, workflow_dispatch]
runs-on: ubuntu-latest
timeout: 30 minutes
browsers: Chromium
node: 20
artifacts: Test results (7 days), Playwright reports (30 days)
```

### Testing Framework Status

| Component | Status | Location |
|-----------|--------|----------|
| Test suites | ✅ Pushed | `tests/*.spec.js` |
| Configuration | ✅ Pushed | `playwright.config.js` |
| Documentation | ✅ Pushed | `TESTING.md`, `tests/README.md` |
| npm scripts | ✅ Pushed | `package.json` |
| GitHub workflow | ⚠️ Local only | `.github/workflows/e2e-tests.yml` |

### Running Tests Without CI/CD

You can run tests locally or via manual workflow trigger:

```bash
# Local testing (requires Chromium installation)
npm install
npx playwright install chromium
npm test
```

### Next Steps

1. **Add the workflow file** using one of the options above
2. **Create a pull request** from this branch
3. **Watch tests run** automatically on GitHub Actions
4. **Review test results** in PR checks

### Questions?

See `TESTING.md` for complete testing documentation and troubleshooting.

---

**Note:** This is a security feature, not a bug. It ensures that CI/CD pipeline changes always have human approval.
