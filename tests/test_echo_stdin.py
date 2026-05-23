import subprocess
import sys


def run_input(inp):
    p = subprocess.Popen(
        [sys.executable, "scripts/echo_stdin.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    out, err = p.communicate(inp)
    return out.strip()


def test_with_input():
    assert run_input("hello from stdin\n") == 'Hello — received: "hello from stdin"'


def test_no_input():
    assert run_input("") == "Hello — no stdin received."


if __name__ == "__main__":
    test_with_input()
    test_no_input()
    print("ALL TESTS PASSED")
