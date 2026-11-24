# TeslaMate Mobile

A standalone, mobile-first PWA and read-only API for TeslaMate. It does not modify TeslaMate core. The Today, Trips, Charging and Trends views use UTC dates and kilometers; currency is displayed in USD. Browser authentication is supplied by the existing Traefik middleware.

## Local demo

Requires Node.js 22 through 26. From `mobile`:

```powershell
npm ci
$env:TESLAMATE_MOBILE_DEMO="true"
npm start
```

Open `http://localhost:4000/mobile/`. Demo data is synthetic. Run `npm run validate` for JavaScript checks, tests (including the report SQL against an embedded PostgreSQL engine), and a production-file build.

## Reports and limitations

The API uses parameterized SQL with a maximum 366-day inclusive UTC range and a 100-row maximum for recent lists; aggregates cover the entire selected range. It never downloads position history. Set `HOME_GEOFENCE_IDS` to a comma-separated list of TeslaMate geofence IDs; all other locations include public **and unknown**. Cost is a sum of recorded costs only; the count of priced sessions indicates missing data.

Efficiency is distance divided by rated range consumed, not energy consumption. Parked loss compares consecutive completed drive/charge events separated by at least two hours; range changes due to temperature, missing events, or calibration can distort it. Battery range uses charge sessions ending at 50% or above, normalized to 100%; it is a directional estimate, not a diagnosis or original-capacity comparison.

`/mobile/api/health` is liveness; `/mobile/api/ready` tests database connectivity. Reports accept `from` and `to` in `YYYY-MM-DD` and `carId=all` or an integer. The PWA caches only its static shell, not personal report data; reports need a network connection.

## Azure deployment

The following assumes the existing Compose file is `docker-compose.yml` in `/home/teslamate/docker/teslamate`. If its name differs, substitute the actual file. Copy this directory to `mobile/` inside that project. Do not copy secrets into Git.

1. Choose a long random password restricted to letters and digits, then create the database role. The password appears briefly as a `psql` argument inside the container; use a private admin session.

   ```bash
   cd /home/teslamate/docker/teslamate
   read -rsp 'Mobile DB password: ' MOBILE_PASSWORD; echo
   docker compose exec -T database psql -U teslamate -d teslamate \
     --set=mobile_password="$MOBILE_PASSWORD" --file=/dev/stdin < mobile/deploy/create-readonly-role.sql
   unset MOBILE_PASSWORD
   ```

2. Add `TESLAMATE_MOBILE_DB_PASSWORD=...` and, optionally, `TESLAMATE_MOBILE_HOME_GEOFENCE_IDS=1,2` to the existing protected project `.env`. Find home IDs without disclosing credentials:

   ```bash
   docker compose exec -T database psql -U teslamate -d teslamate -c 'SELECT id, name FROM geofences ORDER BY name;'
   ```

3. Compose resolves the override's build context relative to the first Compose file. Validate and start only the additive service:

   ```bash
   docker compose -f docker-compose.yml -f mobile/deploy/compose.mobile.yml config --quiet
   docker compose -f docker-compose.yml -f mobile/deploy/compose.mobile.yml build mobile
   docker compose -f docker-compose.yml -f mobile/deploy/compose.mobile.yml up -d --no-deps mobile
   docker compose -f docker-compose.yml -f mobile/deploy/compose.mobile.yml ps mobile
   ```

Visit `https://teslamate1111.westus.cloudapp.azure.com/mobile/` and authenticate. Confirm `/mobile/api/ready` in the same authenticated browser. The service has no published host port and joins the existing Compose default network; Traefik uses `websecure`, `tmhttpchallenge`, and `teslamate-auth@docker`.

The role has SELECT grants only on required tables and defaults to read-only transactions; verify it has no inherited privileges or unexpected PUBLIC write grants in the live database. This package assumes TeslaMate's database schema is in `public`.

## Rollback

```bash
docker compose -f docker-compose.yml -f mobile/deploy/compose.mobile.yml stop mobile
docker compose -f docker-compose.yml -f mobile/deploy/compose.mobile.yml rm -f mobile
```

Core services and data are untouched. Restore the previous mobile directory and rebuild to roll back a version. If permanently removing the role, first revoke its table/schema/database grants or run `DROP OWNED BY teslamate_mobile; DROP ROLE teslamate_mobile;` as an administrator in the `teslamate` database.

## Compatibility

Queries use columns verified in this repository's TeslaMate schema and PostgreSQL features supported by PostgreSQL 18. The stated live TeslaMate 4.4.0 schema was not accessible from this workspace; verify `/mobile/api/ready` and each report against a database snapshot before production use. Grafana 13 is not queried. Date indexes and the bounded ranges should be checked with `EXPLAIN (ANALYZE, BUFFERS)` on a representative snapshot; statement timeouts prevent runaway queries.

## Android APK

`android/` is a small HTTPS WebView wrapper pinned to the specified host and `/mobile` path. It requests Basic Auth interactively, uses Android's normal TLS validation, and does not embed credentials. Android Studio with JDK 17, Android SDK 35 and Gradle 8.9 is required. Open `mobile/android` as a project and sync. Build an installable debug APK with `gradle :app:assembleDebug` or Android Studio's **Build APK(s)**, then install `android/app/build/outputs/apk/debug/app-debug.apk` with `adb install -r ...`. Debug APKs are not suitable for distribution.

For distribution, generate and securely back up a signing keystore outside the repository. Set `MOBILE_KEYSTORE` (absolute path), `MOBILE_KEYSTORE_PASSWORD`, `MOBILE_KEY_ALIAS`, and `MOBILE_KEY_PASSWORD` in the build environment, then run `gradle :app:assembleRelease`. Verify the signature with `apksigner verify --verbose app/build/outputs/apk/release/app-release.apk` before distribution. Never commit signing keys or passwords. The wrapper and APK build have not been validated against a physical device or this deployment.
