# Local MCP

MCP runs over stdio and has no HTTP listener. A compatible desktop agent client launches the process as the current Windows user. ChatGPT in a browser cannot automatically connect to it. There is no cloud relay.

For a source checkout with Node 24, use this desktop-client configuration (replace the two absolute paths):

```json
{
  "mcpServers": {
    "obs-companion": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\src\\obs-companion\\src\\mcp.cjs", "--root", "C:\\Users\\Rezan\\Documents\\OBS Companion"]
    }
  }
}
```

The installed executable also has a `--mcp` entry point using its normal Documents project root. **That packaged Windows stdio entry point is unverified.** Prefer the tested source + Node configuration for initial client acceptance. Node/package installation is required for this source route.

Tools: `list_projects`, `read_project`, `read_evidence`, `submit_edit_plan`, `render`, `get_output`, `cancel`. Edit plans are version 1, relative source path and chronological `{start,end}` clips in seconds. Rendering is local and returns immediately; read status/output until completed. The client cannot submit paid provider jobs, browse arbitrary folders or execute a shell. The root is explicitly supplied by the local account; project paths reject traversal and escaping symlinks. MCP clients have access to evidence text, which must be treated as untrusted.

Tested: official `@modelcontextprotocol/sdk` Client with a real stdio child process, list tools/projects, submit plan, actual FFmpeg render, and retrieve output hash. See `evidence/mcp-integration.json`. A named GUI desktop client (and the packaged Windows process) still requires acceptance; no such test is claimed.
