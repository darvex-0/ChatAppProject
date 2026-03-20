import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

export default [
    js.configs.recommended,
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                localStorage: 'readonly',
                URL: 'readonly',
                Date: 'readonly',
                FileReader: 'readonly',
                Blob: 'readonly',
                Audio: 'readonly',
                MediaRecorder: 'readonly',
                IntersectionObserver: 'readonly',
                fetch: 'readonly',
                Promise: 'readonly',
                Math: 'readonly',
                JSON: 'readonly',
                Object: 'readonly',
                Array: 'readonly',
                React: 'readonly',
            },
        },
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
            'react-refresh': reactRefreshPlugin,
        },
        rules: {
            // React rules
            ...reactPlugin.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
            'react/prop-types': 'off',          // Using TypeScript or informal typing
            'react/display-name': 'warn',

            // Hooks rules
            ...reactHooksPlugin.configs.recommended.rules,

            // React Refresh
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

            // General
            'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'error',
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'public/**'],
    },
];
