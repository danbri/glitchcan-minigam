import { buildConfig, solidPane } from 'solidos-toolkit/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: solidPane({
    sandbox: {
      // Demo WebID served by the proxy (see demo/); has a foaf:jabberID.
      subject: 'http://localhost:5281/profile/bob.ttl#me'
    }
  }),
  build: buildConfig({ entry: 'src/index.ts' }),
  test: {
    environment: 'jsdom'
  }
})
