#!/usr/bin/env python3
import json
import glob
import subprocess
import sys

def format_firebase_key():
    files = glob.glob("*firebase-adminsdk*.json")
    if not files:
        print("❌ No Firebase service account JSON file found in this directory.")
        sys.exit(1)

    json_file = files[0]
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    private_key = data.get("private_key", "").strip()
    if not private_key:
        print("❌ 'private_key' field not found in JSON.")
        sys.exit(1)

    # Convert to single-line JSON escaped string (no physical return symbols)
    single_line_key = json.dumps(private_key)

    # On macOS, copy directly to clipboard
    try:
        subprocess.run("pbcopy", input=single_line_key, text=True, check=True)
        print("🎉 SUCCESS: Clean single-line private key copied directly to your clipboard!")
        print("👉 You can now directly press Cmd+V in Vercel.")
    except Exception:
        print("Single-line formatted key for Vercel:\n")
        print(single_line_key)

if __name__ == "__main__":
    format_firebase_key()
