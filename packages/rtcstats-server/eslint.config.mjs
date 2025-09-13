import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig([{
    languageOptions: {
        globals: {
            ...globals.builtin,
            ...globals.node,
        },

        ecmaVersion: 2018,
        sourceType: 'module',
    },

    rules: {
        'block-scoped-var': 2,
        camelcase: 0,
        'comma-dangle': 0,
        'comma-style': [2, 'last'],
        'comma-spacing': 2,
        'consistent-return': 0,
        curly: [2, 'all'],

        'dot-notation': [0, {
            allowKeywords: true,
        }],

        'eol-last': 2,
        eqeqeq: [2],
        'guard-for-in': 2,
        'handle-callback-err': 2,
        indent: 0,
        'key-spacing': 2,
        'new-cap': 0,
        'no-caller': 2,
        'no-cond-assign': [2, 'always'],
        'no-debugger': 2,
        'no-empty': 0,
        'no-extra-boolean-cast': 0,
        'no-eval': 2,
        'no-extend-native': 2,
        'no-extra-bind': 2,
        'no-extra-parens': 0,
        'no-irregular-whitespace': 2,
        'no-iterator': 2,
        'no-loop-func': 2,

        'no-multi-spaces': [2, {
            ignoreEOLComments: true,
        }],

        'no-multi-str': 2,
        'no-native-reassign': 2,
        'no-new': 2,
        'no-path-concat': 0,
        'no-plusplus': 0,
        'no-process-exit': 0,
        'no-proto': 2,
        'no-redeclare': 2,
        'no-return-assign': 2,
        'no-script-url': 2,
        'no-sequences': 2,
        'no-shadow': 0,
        'no-spaced-func': 2,
        'no-trailing-spaces': 2,
        'no-underscore-dangle': 0,
        'no-undef': 2,
        'no-unused-vars': 2,
        'no-use-before-define': 2,
        'no-var': 2,
        'no-with': 2,
        quotes: ['error', 'single'],
        semi: [2, 'always'],
        'semi-spacing': 2,
        'space-infix-ops': 2,
        'space-unary-ops': 0,
        strict: 0,
        'valid-typeof': 2,
        'wrap-iife': [2, 'any'],
    },
}]);
