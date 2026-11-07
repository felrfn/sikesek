# Storage Conventions (S3-compatible object storage)

SIKESEK uses **one S3-compatible bucket** (`S3_BUCKET_NAME`) containing
exactly two top-level folders:

```
sikesek/
├── public/
└── private/
```

The same convention works with Cloudflare R2, AWS S3, MinIO, or any other
S3-compatible service. There is no separate "private bucket" and there must
never be one added - the separation is enforced entirely by which access path
the application code uses for a given prefix within this one bucket. This
document is the source of truth for which prefix new features must use, and
the exact subfolder layout in use today:

```
sikesek/
├── public/
│   └── facilities/
│       ├── aren/                 (Homestay photos - Homestay.imageUrl, FacilityPhoto.url)
│       └── tempat-pertemuan/     (Venue photos - Venue.imageUrl, FacilityPhoto.url)
│
└── private/
    ├── ktr/
    │   └── evidence/<areaId>/    (SmokingDetection.evidenceKey)
    ├── employees/                (FIELD_OFFICER User.profileImageKey - not wired up yet)
    └── admins/                   (ADMIN User.profileImageKey - not wired up yet)
```

New subfolders should follow this same `public/<domain>/...` or
`private/<domain>/...` shape rather than inventing a new top-level prefix.

## `public/` - safe to expose directly

Anyone with the URL can view these. Served via `S3_PUBLIC_URL`, which should
point at a public bucket, CDN, or reverse proxy that maps the bucket root:

```
URL shape: ${S3_PUBLIC_URL}/public/<key>
```

Use for:
- Homestay ('Aren') photos -> `public/facilities/aren/...`
- 'Tempat Pertemuan' (venue) photos -> `public/facilities/tempat-pertemuan/...`
- Any other facility/gallery photo an admin uploads

Written with `putPublicObject()` in
[`src/lib/storage/objectStorage.ts`](../src/lib/storage/objectStorage.ts),
which returns the final public URL to store directly on the record (e.g.
`Homestay.imageUrl`, `FacilityPhoto.url`).

## `private/` - never a direct URL

Objects here are fetched only through the S3 API using our server
credentials. The application **never** stores or renders a direct public link
for these - it always calls `getSignedPrivateUrl()` to mint a short-lived
(default 5 minute) signed GET URL at the moment an authorized user needs to
view the file, after the usual session/role checks for that page or API route
have already passed. The backend enforces that authorization check; the
object itself is never reachable by guessing or sharing a path.

Use for:
- KTR monitoring evidence captures -> `private/ktr/evidence/<areaId>/...`
  (`SmokingDetection.evidenceKey`)
- Field-officer profile pictures -> `private/employees/...`
- Admin profile pictures -> `private/admins/...`
- Any other internal/non-public documentation

Database columns holding a private reference are named `*Key` (an object key),
never `*Url`, to make the distinction obvious at the schema level and prevent a
future developer from accidentally rendering it as a plain `<img src>`.

## Provider configuration

All storage code reads `S3_*` variables first. The legacy `R2_*` names are
still accepted as fallbacks so an existing Cloudflare R2 deployment can move
to the generic configuration without a flag day.

```env
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
S3_PUBLIC_URL=
S3_FORCE_PATH_STYLE=false

# Optional: only needed when the app reaches storage through an internal
# hostname but presigned URLs must be generated for a public hostname.
S3_PUBLIC_ENDPOINT=
```

`S3_ENDPOINT` is optional for AWS S3 (the SDK uses the regional endpoint) and
required for R2/MinIO. `S3_FORCE_PATH_STYLE=true` is normally required for
MinIO. `S3_PUBLIC_ENDPOINT` affects only presigned URLs; uploads and deletes
still use `S3_ENDPOINT`. It must be the public **S3 API** endpoint (for
example, a public MinIO URL), not a CloudFront/CDN domain: CloudFront does not
validate S3 presigned query parameters. Use `S3_PUBLIC_URL` for public assets
served through a CDN.

### Cloudflare R2

```env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_FORCE_PATH_STYLE=false
S3_BUCKET_NAME=sikesek
S3_PUBLIC_URL=https://cdn.example.com
```

Legacy fallback: setting only `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_URL` continues to
work; the endpoint is derived from `R2_ACCOUNT_ID`.

### MinIO

```env
S3_ENDPOINT=https://minio.example.com
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_BUCKET_NAME=sikesek
S3_PUBLIC_URL=https://minio.example.com/sikesek
```

If MinIO is reachable internally at a Docker hostname but the fog-server must
upload from outside the network, set `S3_PUBLIC_ENDPOINT` to the public MinIO
URL. Presigned URLs are signed for the host they are generated with, so an
internal-only endpoint cannot be swapped in later by string replacement.

### AWS S3

```env
# S3_ENDPOINT=                (omit: use the regional AWS endpoint)
S3_REGION=ap-southeast-1
S3_FORCE_PATH_STYLE=false
S3_BUCKET_NAME=sikesek-prod
S3_PUBLIC_URL=https://cdn.example.com
```

For a private bucket, serve `public/` through CloudFront (OAI/OAC) or a
bucket policy that only allows `public/*`. `S3_PUBLIC_URL` should be the CDN
or bucket website URL, not the raw S3 API endpoint.

## Static app assets (not in the bucket at all)

Anything that is genuinely static and ships with the application build -
the SIKESEK logo, other branding, generic UI icons/illustrations - belongs
in [`public/assets/`](../public/assets) (the Next.js static file directory,
not the object-storage bucket - these share the name "public" but are two
different things) referenced via [`src/lib/assets.ts`](../src/lib/assets.ts).
There is no product reason to upload something through an admin form if it
never changes without a code deploy anyway.

## Local development without storage credentials

The storage variables are optional in development. `isStorageConfigured()`
reports whether credentials and a bucket are present, and upload code paths
surface a clear error rather than crashing the whole request when they're
missing. The seeded demo homestay/venue photos point at local
`/public/assets/*.jpg` files precisely so the catalog renders correctly
without any object storage - `imageUrl` columns are plain URLs either way, so
swapping a seed photo for a real admin-uploaded one later is a data change,
not a code change.
