# Run KNUCKLETAT with Docker

The repository contains a multi-stage Next.js image and a Compose stack for the dashboard, cache, and intelligence service.

```sh
cp .env.example .env
# Add only the optional provider credentials you use.
docker network inspect umami_default >/dev/null 2>&1 || docker network create umami_default
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000). The container listens on port 3000. The Compose file publishes that port to the host and can be adjusted for a different host port.

```sh
docker compose logs -f
docker compose up -d --build
docker compose down
```

Most public feeds work without credentials. The Signals workspace labels HDX HAPI, ReliefWeb, and Global Fishing Watch lookups as needing setup until their server-side values in `.env` are configured. The RECON scanner and some map layers also require optional service credentials. See [.env.example](.env.example) for the current configuration surface.

The application keeps its required upstream licensing and copyright terms in [LICENSE](LICENSE).
