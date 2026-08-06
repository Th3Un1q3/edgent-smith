# Filesystem Server Runtime Toolset

Gateway-hosted filesystem servers differ by image variant: in this deployment the Node `mcp/filesystem` image exposed 11 tools (`read_file`), the Rust `mcp/rust-mcp-filesystem` image 24 (`read_text_file`). Documented tool lists drift from reality (13 documented vs 11 actual Node tools) — enumerate the ACTUAL toolset via a code-mode sandbox after the server starts (write-then-read, denied-path probes) before writing recipes or tests. (Source: live probes vs. documented lists.)

The Rust filesystem server has NO delete tool: write-test artifacts become orphan files only the host can remove. Plan cleanup before running write tests — keep artifacts out of the repo or ask the user to rm. (Source: live probe of the runtime toolset.)

Filesystem tools return denial as a normal string result ("Access denied - path is outside allowed directories: ..."), not a thrown error — scripts must inspect result content, not rely on try/catch. Path enforcement is server-side: the Rust server canonicalizes and requires resolution under an allowed dir (symlink escapes denied), which is why allowed-directories (command args) is a trustworthy limit even when the whole workspace is mounted rw. (Source: live probes.)

Refs: mem:skills/general/live-testing-against-real-servers (return-format/anti-cheat methodology), mem:skills/general/context-gathering-tool-stack (stack context), mem:docker-mcp-gateway/bind-and-mount-mechanics (why a missing mount blocks startup).