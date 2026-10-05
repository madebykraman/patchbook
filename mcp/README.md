# Patchbook MCP bridge

This is the first local MCP bridge for Patchbook.

It exposes Patchbook review JSON packets from a local inbox to an MCP-compatible coding agent.

## Current tools

- `list_reviews` — list available review packets
- `get_latest_review` — return the newest review
- `get_review` — return a review by ID
- `get_annotation` — return one annotation with screen/source context

## Inbox

By default the server reads:

`~/Downloads/Patchbook`

Override it with:

`PATCHBOOK_INBOX=/absolute/path/to/inbox`

The Patchbook web app currently exports its JSON packet manually. The next bridge step is automatic agent-inbox delivery from Patchbook/Chrome so the MCP server can consume new reviews without manual file movement.

## Install

From this directory:

```bash
npm install
npm start
```

Then register the command with your MCP client, for example:

```json
{
  "mcpServers": {
    "patchbook": {
      "command": "node",
      "args": ["/absolute/path/to/patchbook/mcp/server.mjs"],
      "env": {
        "PATCHBOOK_INBOX": "/absolute/path/to/your/Patchbook/inbox"
      }
    }
  }
}
```

The server uses stdio and does not expose an HTTP endpoint.
