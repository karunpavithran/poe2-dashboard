import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs from the server package root (npm -w script cwd), so the dev
// default is relative to it and must stay in sync with src/db/client.ts. Only
// migrate/studio actually open the DB; generate reads just the schema files.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/slices/**/*.schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DB_PATH ?? 'data/poe2-dashboard.db',
  },
})
