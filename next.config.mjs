import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // xeokit-sdk has broken .d.ts — shimmed via src/types/xeokit.d.ts (module
  // declared as `any`). TS/ESLint agora rodam normalmente na build.


  // ── Turbopack (dev only) ──────────────────────────────────────
  turbopack: {
    resolveAlias: {
      fs:       { browser: './src/lib/shims/fs.js'   },
      path:     { browser: './src/lib/shims/path.js' },
      'web-ifc': { browser: './node_modules/web-ifc/web-ifc-api.js' },
    },
  },

  // ── Webpack (production build) ────────────────────────────────
  webpack(config, { isServer }) {
    if (!isServer) {
      // Browser bundle: replace Node built-ins with stubs
      config.resolve.alias = {
        ...config.resolve.alias,
        fs:   path.resolve(__dirname, 'src/lib/shims/fs.js'),
        path: path.resolve(__dirname, 'src/lib/shims/path.js'),
      }
      // Force the browser build of web-ifc (avoids node-specific entry)
      config.resolve.alias['web-ifc'] = path.resolve(
        __dirname, 'node_modules/web-ifc/web-ifc-api.js',
      )
    }
    return config
  },
}

export default nextConfig
