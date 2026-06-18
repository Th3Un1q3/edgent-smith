# Workflow: Docker MCP Gateway Setup

This workflow guides you through setting up the Docker MCP Gateway in a production-ready environment using Docker Compose.

## Prerequisites
- Docker and Docker Compose installed.
- A `.env` file for local development or a secret manager for production.

## Step 1: Choose Secret Management Strategy

### Option A: Docker Secrets (Recommended)
Use this for production environments to keep credentials out of environment logs.
1. Define secrets in your `docker-compose.yaml`:
   ```yaml
   services:
     gateway:
       secrets:
         - api_key
   secrets:
     api_key:
       file: ./secrets/api_key.txt
   ```
2. Access secrets inside the container at `/run/secrets/api_key`.

### Option B: Environment Variables
Use this for local development.
1. Create a `.env` file.
2. Ensure the variable names match the requirements of the MCP server being hosted.
3. Pass them to the gateway service:
   ```yaml
   services:
     gateway:
       env_file: .env
   ```

## Step 2: Docker Compose Configuration
Configure the gateway service to listen on the correct ports and mount necessary volumes (like `docker.sock` if it's orchestrating other containers).

## Step 3: Verification
Run `docker compose up -d` and check the logs:
`docker compose logs -f gateway`
Verify that the gateway successfully initializes and the tools are listed.
