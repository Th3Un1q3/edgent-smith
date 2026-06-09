# Common DevContainer Errors
Common issues encountered when starting or using the devcontainer environment.

- **Docker Permissions**: Ensure the current user is in the `docker` group.
- **Port Conflicts**: Ensure ports 8000, 11434, and 16686 are not in use by host processes.
- **SSL Certs**: Ensure `SSL_CERT_FILE` is correctly mapped if network requests fail.

Example:
Check if port 8000 is busy: `lsof -i :8000`

Reference: .devcontainer/docker-compose.yml
