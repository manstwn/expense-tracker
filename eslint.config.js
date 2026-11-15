module.exports = [
    {
        ignores: ["node_modules/**", "reports/**", "public/css/**", "package-lock.json"]
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                process: "readonly",
                console: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                fetch: "readonly",
                AbortController: "readonly",
                Intl: "readonly"
            }
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }]
        }
    },
    {
        files: ["public/app.js"],
        languageOptions: {
            sourceType: "script",
            globals: {
                window: "readonly",
                document: "readonly",
                localStorage: "readonly",
                fetch: "readonly",
                AbortController: "readonly",
                URLSearchParams: "readonly",
                Intl: "readonly",
                Chart: "readonly",
                lucide: "readonly",
                MutationObserver: "readonly",
                Option: "readonly",
                confirm: "readonly",
                alert: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                console: "readonly"
            }
        }
    }
];
