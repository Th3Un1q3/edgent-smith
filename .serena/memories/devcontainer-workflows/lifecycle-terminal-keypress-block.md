# Keypress Block

postCreateCommand runs in an interactive terminal; on exit, "Done. Press any key to close the terminal." blocks "configuring dev container" until keypress closes. By design; auto-close never shipped — microsoft/vscode-remote-release#4537.

Missing keypress = stuck "configuring" + no port forwarding (forwardPorts apply only after VS Code attaches). Fix: click the terminal, Enter. Plain reopen/attach skips postCreateCommand (create/rebuild only) — "sometimes works". Exiting-0 scripts are NOT the blocker; grep before blaming OrbStack. #10504 (Windows-only, postAttach) shows it.