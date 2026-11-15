#!/usr/bin/env python3
"""Generate a GitHub-style table of contents from a UTF-8 Markdown file."""
import html
import re
import sys
import unicodedata
from pathlib import Path

ATX = re.compile(r"^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$")
FENCE = re.compile(r"^ {0,3}([\x60~]{3,})(.*)$")
SETEXT = re.compile(r"^ {0,3}(=+|-+)[ \t]*$")

def plain(text):
    """Remove common inline Markdown while keeping visible heading text."""
    saved = []
    def stash(value):
        saved.append(value)
        return "\x00" + str(len(saved)-1) + "\x00"
    text = re.sub(r"\\([!\"#$%&'()*+,\-./:;<=>?@\[\]^_\x60{|}~])",
                  lambda m: stash(m[1]), text)
    text = re.sub(r"(\x60+)(.*?)\1", lambda m: stash(m[2]), text)
    text = re.sub(r"!?\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)", r"\1", text)
    text = re.sub(r"!?\[([^\]]*)\]\[[^\]]*\]", r"\1", text)
    text = re.sub(r"<((?:https?://|mailto:)[^<>]+)>", r"\1", text)
    text = re.sub(r"</?[A-Za-z][^>]*>", "", text)
    text = re.sub(r"(\*\*\*|___|\*\*|__|~~|\*)(?=\S)(.+?)(?<=\S)\1",
                  r"\2", text)
    text = re.sub(r"(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)", r"\1", text)
    text = re.sub(r"\x00(\d+)\x00", lambda m: saved[int(m[1])], text)
    return html.unescape(text).strip()

def slug(text):
    """Lowercase, retain letters/marks/numbers, underscores and hyphens."""
    out = []
    for c in text.lower():
        if c == " ":
            out.append("-")
        elif c in "-_" or unicodedata.category(c)[0] in "LMN":
            out.append(c)
    return "".join(out)

def headings(lines):
    fence = None
    previous = None
    comment = False
    for line in lines:
        if comment:
            if "-->" not in line:
                continue
            line = line.split("-->", 1)[1]
            comment = False
        if "<!--" in line:
            left, right = line.split("<!--", 1)
            if "-->" in right:
                line = left + right.split("-->", 1)[1]
            else:
                line = left
                comment = True
        f = FENCE.match(line)
        if fence:
            if f and f[1][0] == fence[0] and len(f[1]) >= fence[1] and not f[2].strip():
                fence = None
            continue
        if f and len(set(f[1])) == 1:
            fence = (f[1][0], len(f[1]))
            previous = None
            continue
        h = ATX.match(line)
        if h:
            raw = re.sub(r"[ \t]+#+[ \t]*$", "", h[2]).strip()
            yield len(h[1]), plain(raw)
            previous = None
            continue
        s = SETEXT.match(line)
        if s and previous is not None:
            yield 1 if s[1][0] == "=" else 2, plain(previous)
            previous = None
            continue
        previous = line.strip() if (
            line.strip() and not line.startswith(("    ", "\t"))
            and not re.match(r"^ {0,3}(?:[-+*]\s|>\s|\d+[.)]\s)", line)
        ) else None

def toc(markdown):
    used = set()
    next_suffix = {}
    for level, label in headings(markdown.splitlines()):
        base = slug(label)
        anchor = base
        if anchor in used:
            n = next_suffix.get(base, 1)
            while f"{base}-{n}" in used:
                n += 1
            anchor = f"{base}-{n}"
            next_suffix[base] = n + 1
        used.add(anchor)
        label = label.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")
        yield f'{"  " * (level - 1)}- [{label}](#{anchor})'

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 toc.py FILE", file=sys.stderr)
        return 1
    try:
        text = Path(sys.argv[1]).read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError):
        print("Error: cannot read UTF-8 Markdown file.", file=sys.stderr)
        return 1
    for line in toc(text):
        print(line)
    return 0

if __name__ == "__main__":
    sys.exit(main())
