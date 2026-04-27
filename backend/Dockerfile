# ─── Stage 1: dependency cache ────────────────────────────────────────────────
# Build a throw-away binary with only Cargo manifests so Docker can cache the
# compiled dependency layer separately from application source changes.
# 1.88+ required: current lockfile pulls darling/serde_with/time (rust-version 1.88) and ICU/idna (1.86+).
FROM rust:1.88-slim-bookworm AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY crates/kanflow-server/Cargo.toml ./crates/kanflow-server/

# Stub source so cargo can resolve and compile all deps
RUN mkdir -p crates/kanflow-server/src && \
    echo 'fn main() {}' > crates/kanflow-server/src/main.rs && \
    cargo build --release --bin kanflow-server && \
    rm -rf crates/kanflow-server/src

# ─── Stage 2: application build ───────────────────────────────────────────────
FROM deps AS builder

COPY crates/ ./crates/
COPY migrations/ ./migrations/
# Touch main.rs so cargo sees the source as newer than the cached stub
RUN touch crates/kanflow-server/src/main.rs && \
    cargo build --release --bin kanflow-server

# ─── Stage 3: minimal runtime image ───────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/kanflow-server ./kanflow-server
COPY migrations/ ./migrations/

EXPOSE 8080

CMD ["./kanflow-server"]
