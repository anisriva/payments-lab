import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ['src/lib/payments/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['next', 'next/*', '@prisma/*', '@/*'],
            message: 'payments/core must stay framework-free.' },
          { regex: '(^|/)(db|generated|services)(/|$)',
            message: 'payments/core must not reach into db, generated or services.' },
        ],
      }],
    },
  },
];

export default eslintConfig;
