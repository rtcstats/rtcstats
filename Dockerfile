# docker build -t rtcstats-server -f Dockerfile .
# docker run -p 8080:8080 rtcstats-server
# Configuration can be passed via environment variables, e.g.
# docker run -p 8080:8071 -e NODE_CONFIG='{"server": {"httpPort":8071}}' rtcstats-server
FROM node:22-alpine

# tini as PID 1 so SIGTERM reaches node and `docker stop` shuts down promptly.
RUN apk add --no-cache tini

WORKDIR /server

COPY package.json ./
COPY packages/rtcstats-shared/package.json packages/rtcstats-shared/
COPY packages/rtcstats-node-shared/package.json packages/rtcstats-node-shared/
COPY packages/rtcstats-server/package.json packages/rtcstats-server/

RUN npm install --omit=dev \
    --workspace=packages/rtcstats-server \
    --include-workspace-root

COPY packages/rtcstats-shared packages/rtcstats-shared
COPY packages/rtcstats-node-shared packages/rtcstats-node-shared
COPY packages/rtcstats-server packages/rtcstats-server
# Default config only; deploy-time config is injected via NODE_CONFIG or a mount.
COPY config/default.yaml config/default.yaml

RUN chown -R node:node /server
USER node

EXPOSE 8080
WORKDIR /server/packages/rtcstats-server
ENV NODE_CONFIG_DIR=/server/config
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget -qO- http://localhost:8080/healthcheck || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "app.js"]
