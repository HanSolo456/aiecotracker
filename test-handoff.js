const os = require('os');
const path = require('path');
const fs = require('fs');
const STORE_DIR = path.join(os.tmpdir(), 'aiecotrack-desktop-google-handoff');
console.log("Store dir:", STORE_DIR);
try {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STORE_DIR, "test.txt"), "hello", "utf8");
  console.log("Wrote OK.", fs.readFileSync(path.join(STORE_DIR, "test.txt"), "utf8"));
} catch (e) {
  console.error("Failed:", e);
}
