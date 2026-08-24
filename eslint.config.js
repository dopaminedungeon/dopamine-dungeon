import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: [
      'src/context/CampaignContext.jsx',
      'src/context/ModeContext.jsx',
      'src/context/TenantContext.jsx',
    ],
    rules: {
      // These providers intentionally synchronize auth/storage state in effects.
      'react-hooks/set-state-in-effect': 'off',
      // Context modules intentionally export both a provider and its public hook.
      'react-refresh/only-export-components': 'off',
    },
  },
])
