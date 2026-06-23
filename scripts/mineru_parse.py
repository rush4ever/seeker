#!/usr/bin/env python3
"""
MinerU document parser — CLI wrapper.
Usage: python3 mineru_parse.py <path-to-pdf-or-docx>

Takes a PDF or DOCX file, runs MinerU on it, and outputs the
parsed Markdown text to stdout.  Also emits the output directory
path so the caller can find extracted images.

Output format (one JSON line per meta, then the markdown):
  {"status":"ok","output_dir":"/tmp/mineru-xxx","markdown_path":"/tmp/mineru-xxx/...md"}
  <markdown content>

On error:
  {"status":"error","message":"..."}
"""

import json
import sys
import os
import subprocess
import tempfile
import shutil
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "Usage: mineru_parse.py <file-path>"}))
        sys.exit(1)

    file_path = os.path.abspath(sys.argv[1])
    if not os.path.isfile(file_path):
        print(json.dumps({"status": "error", "message": f"File not found: {file_path}"}))
        sys.exit(1)

    # Create a dedicated output directory
    output_dir = tempfile.mkdtemp(prefix="mineru_")

    try:
        # Run mineru CLI
        result = subprocess.run(
            ["mineru", "-p", file_path, "-o", output_dir],
            capture_output=True,
            text=True,
            timeout=600,  # 10 minutes max
        )

        if result.returncode != 0:
            print(json.dumps({
                "status": "error",
                "message": f"MinerU failed (exit {result.returncode}): {result.stderr[:500]}"
            }))
            sys.exit(1)

        # Find the output markdown file — mineru creates a subdirectory named after the input
        md_file = None
        for root, dirs, files in os.walk(output_dir):
            for f in files:
                if f.endswith(".md"):
                    md_file = os.path.join(root, f)
                    break

        if not md_file:
            print(json.dumps({"status": "error", "message": "No markdown output found"}))
            sys.exit(1)

        # Read the markdown content
        with open(md_file, "r", encoding="utf-8") as f:
            markdown = f.read()

        # Output the meta line
        meta = {
            "status": "ok",
            "output_dir": output_dir,
            "markdown_path": md_file,
            "size_bytes": len(markdown),
        }
        print(json.dumps(meta))
        print(markdown)

    except subprocess.TimeoutExpired:
        print(json.dumps({"status": "error", "message": "MinerU timed out after 600s"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
