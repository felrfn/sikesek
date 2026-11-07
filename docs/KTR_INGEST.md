# KTR AI Ingest API

Contract for the YOLOv8 fog-server component (the on-prem CCTV/AI machine)
that reports smoking detections to the SIKESEK backend. This is a
machine-to-machine API - it is **not** used by the browser, the admin
dashboard, or the mobile app. Those consume the recorded detections through
their own authenticated endpoints (`/admin/ktr-monitoring` and
`GET /api/mobile/ktr`).

Source files:

- `src/app/api/ktr/areas/route.ts`
- `src/app/api/ktr/evidence-url/route.ts`
- `src/app/api/ktr/detect/route.ts`
- `src/features/violations/service.ts` (`ingestDetection`)
- `src/lib/validation/ktr.ts` (`detectionIngestSchema`)

## 1. Ownership: who defines areas?

**The application owns the area registry. The AI server never invents an
area id.**

- Admins create/edit/deactivate areas at **`/admin/ktr-areas`** (web
  dashboard). Each area is a `MonitoredArea` row with an `id` (UUID), `name`,
  `locationDescription`, an **optional** `streamUrl` (camera stream
  metadata), an optional default officer, and an `isActive` flag.
- `streamUrl` is not required and the web app never plays it. The AI
  pipeline may own camera/stream configuration itself; SIKESEK only stores
  it as an optional reference.
- The AI server fetches the registry from `GET /api/ktr/areas` and uses the
  returned `id` as `areaId` in every detection it reports.
- An area can only be deleted while it has **zero** detection records.
  Areas with history must be deactivated instead, so past evidence always
  stays attributable to the place it happened in.

A detection whose `areaId` does not exist is rejected (`404 UNKNOWN_AREA`);
one whose area is inactive is rejected (`409 AREA_INACTIVE`).

## 2. Authentication

Every endpoint requires:

```
x-api-key: <KTR_INGEST_API_KEY>
```

`KTR_INGEST_API_KEY` is a shared secret configured in the backend's
environment (see `.env.example`). The comparison is constant-time. If the
variable is missing, every request fails closed with `401 UNAUTHORIZED`.

There is no JWT, cookie, or user account involved. Do not send a mobile
bearer token here.

Base URL: the same Next.js deployment as the rest of the backend, e.g.
`https://sikesek.example.com`. All paths below are relative to it.

All request and response bodies are JSON (`Content-Type: application/json`),
except the optional evidence `PUT` to object storage, which sends raw image bytes.

## 3. Flow

```text
Admin (web dashboard)
  │  creates area → areaId (+ optional streamUrl)
  ▼
GET /api/ktr/areas ──────────────► AI server (knows which camera = which areaId)
                                        │
CCTV ──RTSP──► YOLOv8 detects smoking ──┤
                                        │
                     ┌──────────────────┴───────────────────────────┐
                     │ Evidence storage - pick ONE (storage optional)│
                     │                                              │
                     │ A. External storage (e.g. Cloudinary, today) │
                     │    AI uploads to its own storage              │
                     │    → send that URL as evidenceKey             │
                     │                                              │
                     │ B. SIKESEK storage (recommended, when ready) │
                     │    POST /api/ktr/evidence-url                 │
                     │    PUT <uploadUrl>                            │
                     │    → send the returned key as evidenceKey     │
                     └──────────────────┬───────────────────────────┘
                                        ▼
                          POST /api/ktr/detect
                            { areaId, confidence, evidenceKey, detectedAt }
                                        │
                                        ▼
                    PostgreSQL (SmokingDetection) + Notification rows
                                        │
                                        ▼
                          FCM push → field officers' devices
```

**Object storage is not mandatory.** `SmokingDetection.evidenceKey` is simply
a string reference to the evidence. It can be either:

- a full URL to evidence stored externally by the AI pipeline (e.g.
  Cloudinary) - the current setup, or
- a private object key obtained from `POST /api/ktr/evidence-url` -
  recommended once the pipeline is ready to move.

The backend never receives the image bytes itself either way. The admin and
mobile evidence endpoints pass `http(s)://` URLs through as-is and sign
storage keys on demand (short-lived signed GET URLs), so both storage options
are viewable in the app. External evidence has no private-storage guarantee -
its privacy is entirely up to the external provider. See `docs/STORAGE.md` for
the private-storage convention.

## 4. `GET /api/ktr/areas`

Returns the active monitored areas the AI server may report against.

**Request**

```bash
curl -s "https://sikesek.example.com/api/ktr/areas" \
  -H "x-api-key: $KTR_INGEST_API_KEY"
```

**Response `200 OK`**

```json
{
  "areas": [
    {
      "id": "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
      "name": "Gazebo 01",
      "locationDescription": "North side of the main pool",
      "streamUrl": "rtsp://camera.local/gazebo-01",
      "assignedEmployee": { "id": "e42f1155-3061-4462-b981-e96fd8828b97", "name": "Jane Doe" }
    }
  ]
}
```

- Only `isActive: true` areas are returned. A deactivated area disappears
  from this list and rejects new detections.
- `streamUrl` is optional and may be `null` - the AI pipeline is free to own
  camera/stream configuration itself.
- `assignedEmployee` is the area's **default** officer and is informational
  only. It does **not** auto-assign detections - an admin still assigns KTR
  tasks from the dashboard (`KtrAssignment`).
- `assignedEmployee` is `null` when no default officer is set.

**Errors**: `401 UNAUTHORIZED`.

## 5. `POST /api/ktr/evidence-url`

Issues a short-lived presigned `PUT` URL so the AI server can upload one
evidence image directly to the private storage prefix **without holding
storage credentials**.

**This endpoint is optional.** It exists for when the pipeline is ready to
move evidence into SIKESEK's S3-compatible object-storage bucket. Continuing to store evidence in an
external service (e.g. Cloudinary) is fully supported - see "Alternative:
external evidence storage" below.

**Request**

```json
{
  "areaId": "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
  "contentType": "image/jpeg"
}
```

- `areaId` (required): UUID of an existing, active area.
- `contentType` (required): one of `image/jpeg`, `image/png`, `image/webp`.

**Response `200 OK`**

```json
{
  "uploadUrl": "https://<storage-host>/<bucket>/private/ktr/evidence/...?X-Amz-Signature=...",
  "key": "private/ktr/evidence/aa6f9aee-73e0-4c53-a180-9bd9956b90d0/7f1c...e4.jpg",
  "expiresIn": 300
}
```

Upload the bytes to `uploadUrl` with the **same `Content-Type`** that was
requested (it is part of the signature):

```bash
curl -s -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @frame.jpg
```

Then send the returned `key` as `evidenceKey` to `/api/ktr/detect` - do not
modify or re-prefix it.

**Error responses**

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid `areaId` or unsupported `contentType` |
| 401 | `UNAUTHORIZED` | Missing/invalid API key |
| 404 | `UNKNOWN_AREA` | No monitored area with that id |
| 409 | `AREA_INACTIVE` | Area exists but is deactivated |
| 503 | `STORAGE_NOT_CONFIGURED` | S3-compatible storage credentials are not configured in this environment |
| 500 | `INTERNAL_ERROR` | Could not sign the URL |

The URL expires after 5 minutes. Request a new one per image; never cache it.

### Alternative: external evidence storage

If the AI pipeline already stores evidence on its own (today: Cloudinary),
skip this endpoint entirely and send the public URL as `evidenceKey`:

```json
{
  "areaId": "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
  "confidence": 0.94,
  "evidenceKey": "https://res.cloudinary.com/<account>/image/upload/v.../frame.jpg",
  "detectedAt": "2026-10-31T07:32:00.000Z"
}
```

The backend stores that string as-is. Caveats:

- There is no validation that the URL is reachable.
- External evidence is as public as that provider makes it - it does not get
  the private-storage treatment described in `docs/STORAGE.md`.
- The admin/mobile evidence endpoints pass `http(s)://` URLs through as-is
  (storage keys are still signed), so external evidence is viewable in the
  app - but its privacy is entirely up to the external provider.

## 6. `POST /api/ktr/detect`

Records the detection and notifies field officers.

**Request**

```json
{
  "areaId": "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
  "confidence": 0.94,
  "evidenceKey": "private/ktr/evidence/aa6f9aee-73e0-4c53-a180-9bd9956b90d0/7f1c...e4.jpg",
  "detectedAt": "2026-10-31T07:32:00.000Z"
}
```

| Field | Required | Rules |
|---|---|---|
| `areaId` | Yes | UUID of an existing, **active** area |
| `confidence` | Yes | Number `0`–`1` (e.g. `0.94`, not `94`) |
| `evidenceKey` | Yes | Non-empty evidence reference: a private storage key from `/api/ktr/evidence-url`, **or** a full external URL (e.g. Cloudinary) |
| `detectedAt` | No | ISO 8601 timestamp. Defaults to the server's current time. Send UTC (`Z`) - the dashboard renders it in WIB |

**Response `201 Created`**

```json
{ "id": "99b749f8-e617-4a35-8af5-87d616097d88" }
```

The returned id is the `SmokingDetection.id`. The backend then:

1. Creates the detection with `source: "API"` and `status: "DETECTED"`.
2. Writes one `Notification` row per active field officer.
3. Sends one FCM multicast to every active field officer's active device
   tokens, with this structured `data` payload (all values are strings - an
   FCM constraint):

   ```json
   {
     "type": "KTR_VIOLATION_NEW",
     "violationId": "99b749f8-e617-4a35-8af5-87d616097d88",
     "areaId": "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
     "confidence": "0.94",
     "detectedAt": "2026-10-31T07:32:00.000Z"
   }
   ```

   There is deliberately **no `imageUrl`**: private evidence URLs are short-lived
   (5 minutes), so embedding one would leave broken images when an officer
   opens the notification later. The mobile app fetches a fresh
   `evidenceUrl` from `GET /api/mobile/ktr` when the case is opened. External
   evidence URLs (e.g. Cloudinary) are returned as-is by that same endpoint.

   If Firebase is not configured, the push is skipped but the notification
   rows are still written (mobile polling remains a truthful fallback).
   FCM is best-effort: a push failure never rolls back the detection, and
   tokens Firebase reports as permanently invalid are deactivated.
4. Moves the detection to `status: "NOTIFIED"`.

**Error responses**

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Payload failed validation; `details` carries the Zod issues |
| 401 | `UNAUTHORIZED` | Missing/invalid API key |
| 404 | `UNKNOWN_AREA` | No monitored area with that id |
| 409 | `AREA_INACTIVE` | Area exists but is deactivated |
| 500 | `INTERNAL_ERROR` | Detection could not be recorded |

## 7. End-to-end example

The example below uses the optional object-storage upload path. If the AI
pipeline keeps storing evidence externally, skip steps 2–3 and put the
external URL in `evidenceKey` at step 4 instead.

```bash
export SIKESEK_BASE_URL="https://sikesek.example.com"
export KTR_INGEST_API_KEY="..."

# 1. Find the area's id (match by name or streamUrl)
curl -s "$SIKESEK_BASE_URL/api/ktr/areas" \
  -H "x-api-key: $KTR_INGEST_API_KEY"

# 2. Ask for an upload URL
curl -s -X POST "$SIKESEK_BASE_URL/api/ktr/evidence-url" \
  -H "x-api-key: $KTR_INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"areaId":"aa6f9aee-73e0-4c53-a180-9bd9956b90d0","contentType":"image/jpeg"}'

# 3. Upload the evidence image
curl -s -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @frame.jpg

# 4. Report the detection
curl -s -X POST "$SIKESEK_BASE_URL/api/ktr/detect" \
  -H "x-api-key: $KTR_INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "areaId": "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
    "confidence": 0.94,
    "evidenceKey": "private/ktr/evidence/aa6f9aee-73e0-4c53-a180-9bd9956b90d0/7f1c...e4.jpg",
    "detectedAt": "2026-10-31T07:32:00.000Z"
  }'
```

## 8. Detection lifecycle after ingest

```text
DETECTED → NOTIFIED → ASSIGNED → IN_PROGRESS → RESOLVED
                                              ├─ FALSE_POSITIVE
                                              └─ DISMISSED
```

Ingest only produces `DETECTED` → `NOTIFIED`. Every later transition is a
human action from the admin dashboard or the field-officer mobile app - the
AI server never updates or resolves a detection. A field officer can also
enter `IN_PROGRESS` directly from the mobile app by claiming a case
(`POST /api/mobile/ktr/{id}/claim`) without an admin assignment; that claim
is announced to every other officer.

## 9. Known limitations (deliberate, tracked)

- **No idempotency key yet.** If the AI server retries a `POST /api/ktr/detect`
  after a timeout, a duplicate detection can be created. Ensure the client
  only retries when it received no response (not on a `4xx`), and expect a
  future `externalId` field to close this gap.
- **External evidence has no private-storage guarantees.** An `evidenceKey`
  that is a full `http(s)://` URL (e.g. Cloudinary) is stored and previewed
  as-is; storage keys are signed on demand. External evidence is only as
  private as the provider makes it, and there is no reachability validation.
- **Push is synchronous.** The `201` is returned after FCM delivery is
  attempted; a slow Firebase call can delay the response. Notification rows
  are written first, so a retry risk exists as described above.
- **No rate limiting yet.** Add it before exposing the endpoint to
  untrusted networks.
- `detectedAt` is not bounded - the client is trusted to send sane
  timestamps.
