#!/usr/bin/env python3
"""Simple CLI that reads stdin and echoes a greeting."""
import sys

def main():
    data = sys.stdin.read()
    if not data:
        print("Hello — no stdin received.")
    else:
        data = data.rstrip("\n")
        print(f'Hello — received: "{data}"')

if __name__ == "__main__":
    main()
