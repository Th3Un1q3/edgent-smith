# Notifications Reference

## Overview
The `agent_utils` module uses the `ntfy.sh` service via a command-line interface for real-time alert delivery.

## Command
Use the `just` command to send a notification:

```bash
just notify <event> <message>
```

## Requirements
- **Tool**: `curl` must be installed and available in the shell environment.
- **Service**: An active subscription to an `ntfy.sh` topic is required.

### Environment Variables
The command expects the following variables, which are loaded from a `.env` file:

| Variable | Description |
|----------|-------------|
| `NTFY_TOPIC` | The ntfy.sh topic name used for sending notifications. |
| `NTFY_TOKEN` | The authentication token for the ntfy.sh topic (if required). |

## Usage Example
To send a "deployment" event with the message "Agent task completed successfully":

```bash
just notify deployment "Agent task completed successfully"
```
