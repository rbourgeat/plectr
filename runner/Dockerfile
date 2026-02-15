FROM rust:1.93.1-slim AS chef
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    clang \
    lld \
    && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef 
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

COPY . .
RUN cargo build --release

FROM ubuntu:24.04 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y \
    libssl-dev \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/plectr-runner /app/plectr-runner

ENV PLECTR_CORE_URL="ws://plectr-core:3000/api/runner/ws"
ENV RUST_LOG="info"

ENTRYPOINT ["./plectr-runner"]