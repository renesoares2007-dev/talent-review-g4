import "dotenv/config";
import { defineConfig } from "prisma/config";
import path from "path";
import fs from "fs";

// Load .env.local if it exists (Vercel creates it with DATABASE_URL)
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envLocal = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envLocal.split("\n")) {
    const match = line.match(/^([^#=]+)="?([^"]*)"?$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
