import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
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
