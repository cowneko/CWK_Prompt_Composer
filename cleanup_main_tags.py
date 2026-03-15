"""
Remove tags from tags/main.txt that already exist in
quality.txt, style.txt, aesthetic.txt, or negative.txt.

Usage:
    python cleanup_main_tags.py

It will:
  1. Read all tags from quality, style, aesthetic, negative
  2. Read main.txt
  3. Remove any duplicates
  4. Write cleaned main.txt back
  5. Print a summary
"""

import os

TAGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tags")

def read_tags(filename):
    path = os.path.join(TAGS_DIR, filename)
    if not os.path.exists(path):
        print(f"  ⚠️  {filename} not found, skipping")
        return set()
    with open(path, "r", encoding="utf-8") as f:
        tags = set()
        for line in f:
            t = line.strip()
            if t:
                tags.add(t)
        return tags

def main():
    print("🔍 Reading category tag files...")

    other_tags = set()
    for name in ["quality.txt", "style.txt", "aesthetic.txt", "negative.txt"]:
        tags = read_tags(name)
        print(f"  📄 {name}: {len(tags)} tags")
        other_tags |= tags

    print(f"\n  📊 Total unique tags in other categories: {len(other_tags)}")

    # Read main.txt preserving order
    main_path = os.path.join(TAGS_DIR, "main.txt")
    if not os.path.exists(main_path):
        print("❌ tags/main.txt not found!")
        return

    with open(main_path, "r", encoding="utf-8") as f:
        main_lines = [line.strip() for line in f if line.strip()]

    original_count = len(main_lines)
    print(f"  📄 main.txt: {original_count} tags")

    # Filter out duplicates
    removed = []
    kept = []
    for tag in main_lines:
        if tag in other_tags:
            removed.append(tag)
        else:
            kept.append(tag)

    print(f"\n{'='*50}")
    print(f"  🗑️  Tags to remove: {len(removed)}")
    print(f"  ✅ Tags to keep:    {len(kept)}")
    print(f"{'='*50}")

    if removed:
        print(f"\n🗑️  Removed tags:")
        for tag in sorted(removed):
            # Show which file(s) it exists in
            sources = []
            for name in ["quality.txt", "style.txt", "aesthetic.txt", "negative.txt"]:
                if tag in read_tags(name):
                    sources.append(name.replace(".txt", ""))
            print(f"    - {tag}  (in: {', '.join(sources)})")

    if not removed:
        print("\n✨ No duplicates found — main.txt is already clean!")
        return

    # Confirm before writing
    print(f"\n⚠️  This will rewrite tags/main.txt ({original_count} → {len(kept)} tags)")
    answer = input("   Proceed? [y/N]: ").strip().lower()

    if answer != "y":
        print("❌ Aborted.")
        return

    # Write back
    with open(main_path, "w", encoding="utf-8") as f:
        for tag in kept:
            f.write(tag + "\n")

    print(f"\n✅ Done! main.txt cleaned: {original_count} → {len(kept)} tags ({len(removed)} removed)")

if __name__ == "__main__":
    main()