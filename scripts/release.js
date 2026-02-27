#!/usr/bin/env node

import fs from "fs";
import { execSync } from "child_process";

function updateJSONVersion(file, version) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.version = version;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`✔ Updated ${file}`);
}

function updateCargoVersion(file, version) {
  let content = fs.readFileSync(file, "utf8");

  content = content.replace(
    /^version\s*=\s*".*?"/m,
    `version = "${version}"`
  );

  fs.writeFileSync(file, content);
  console.log(`✔ Updated ${file}`);
}

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// 读取版本号
const version = process.argv[2];

if (!version) {
  console.error("❌ Please provide version number.");
  console.log("Usage: node scripts/release.js 1.2.3");
  process.exit(1);
}

// 更新版本
updateJSONVersion("package.json", version);
updateJSONVersion("src-tauri/tauri.conf.json", version);
updateCargoVersion("src-tauri/Cargo.toml", version);

// Git 操作
run("git add .");
run(`git commit -m "release: v${version}"`);
run(`git tag v${version}`);
run("git push");
run("git push --tags");

console.log("\n🚀 Release completed!");