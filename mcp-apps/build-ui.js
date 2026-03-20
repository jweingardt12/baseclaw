import { execSync } from "child_process";
import { mkdirSync, renameSync, existsSync, rmSync, readdirSync } from "fs";
import { join } from "path";

const apps = ["roster", "standings", "season", "intel"];
const distDir = "dist";

// Clean dist dir of old HTML files
if (existsSync(distDir)) {
  for (const app of apps) {
    const f = join(distDir, app + ".html");
    if (existsSync(f)) rmSync(f);
  }
} else {
  mkdirSync(distDir);
}

for (const app of apps) {
  const input = "ui/" + app + "-app/index.html";
  console.log("Building " + app + "...");
  execSync("npx vite build", {
    stdio: "inherit",
    env: { ...process.env, INPUT: input },
  });
  // Move the built file to dist/app.html
  const built = join(distDir, "ui", app + "-app", "index.html");
  const dest = join(distDir, app + ".html");
  if (existsSync(built)) {
    renameSync(built, dest);
    console.log("  -> " + dest);
  }
}

// Clean up leftover ui directory in dist
const distUi = join(distDir, "ui");
if (existsSync(distUi)) {
  rmSync(distUi, { recursive: true });
}

console.log("All UI apps built.");
