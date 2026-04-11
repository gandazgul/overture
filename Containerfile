# Stage 1: Build the Phaser project
FROM docker.io/library/debian:12-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y curl unzip build-essential && rm -rf /var/lib/apt/lists/*

# Install Deno
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Configure Deno cache directory
ENV DENO_DIR=/deno-cache
RUN mkdir -p /deno-cache

WORKDIR /app

# Copy configuration and lock files
COPY deno.json deno.lock ./

# Install dependencies and approve build scripts for native bindings (if any)
RUN deno install --allow-scripts

# Copy the rest of the application
COPY . .

# Build the project
RUN deno task build

# Cache server dependencies to ensure they are available offline
RUN deno cache server.js

# Stage 2: Production runtime using distroless
FROM gcr.io/distroless/cc-debian12

# Copy the Deno binary
COPY --from=denoland/deno:bin --chown=nonroot:nonroot /deno /bin/deno

# This is the UID of the nonroot user in distroless images, ensuring we run without root privileges
USER 65532

WORKDIR /app

# Copy the Deno cache so dependencies are available offline
ENV DENO_DIR=/deno-cache
COPY --from=builder --chown=nonroot:nonroot /deno-cache /deno-cache

# Copy the built output
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist

# Copy Deno configuration for runtime import mappings
COPY --from=builder --chown=nonroot:nonroot /app/deno.json /app/deno.lock ./

# Copy the production server
COPY --from=builder --chown=nonroot:nonroot /app/server.js ./

ENV PORT=8080

EXPOSE 8080

# Run the production server
CMD ["/bin/deno", "run", "-A", "server.js"]
