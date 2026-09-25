FROM node:24.19.0-bookworm-slim AS node
FROM mcr.microsoft.com/playwright:v1.58.2-noble
USER root
ARG OBS_VERSION=32.2.2
ARG OBS_DEB_SHA256=b6557ca2059287210332accc94c267094050489cffffc5c832e746e3a418dab0
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl ffmpeg xvfb x11-utils fluxbox dbus-x11 supervisor pulseaudio \
 && curl -fL --retry 3 -o /tmp/obs-studio.deb \
    "https://github.com/obsproject/obs-studio/releases/download/${OBS_VERSION}/OBS-Studio-${OBS_VERSION}-Ubuntu-24.04-x86_64.deb" \
 && echo "${OBS_DEB_SHA256}  /tmp/obs-studio.deb" | sha256sum -c - \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends /tmp/obs-studio.deb \
 && rm -f /tmp/obs-studio.deb \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src ./src
COPY server-ui ./server-ui
COPY deploy ./deploy
RUN npm run build:server \
 && npm prune --omit=dev --ignore-scripts \
 && mkdir -p /data/projects /data/home \
 && chown -R pwuser:pwuser /data \
 && dpkg-query -W > /app/deploy/installed-packages.txt
USER pwuser
ENV HOME=/data/home DISPLAY=:99 XDG_RUNTIME_DIR=/tmp/runtime-obs \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright DATA_ROOT=/data/projects \
    BIND_ADDRESS=0.0.0.0 PORT=8787 SERVER_OBS=1 LIBGL_ALWAYS_SOFTWARE=1
EXPOSE 8787
CMD ["node", "deploy/entrypoint.cjs"]
