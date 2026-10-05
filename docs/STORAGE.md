# Storage Conventions ('sikesek' R2 bucket)

SIKESEK uses a **single** Cloudflare R2 bucket (`R2_BUCKET_NAME`), containing
exactly two top-level folders:

```
sikesek/
├── public/
└── private/
```

There is no separate "private bucket" and there must never be one added -
the separation is enforced entirely by which access path the application
code uses for a given prefix within this one bucket. This document is the
source of truth for which prefix new features must use, and the exact
subfolder layout in use today:

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

Anyone with the URL can view these. Served via `R2_PUBLIC_URL` (a custom
domain/public access configuration you set up on the Cloudflare side for
this bucket - that infrastructure step is separate from this app).

URL shape: `${R2_PUBLIC_URL}/public/<key>`

Use for:
- Homestay ('Aren') photos -> `public/facilities/aren/...`
- 'Tempat Pertemuan' (venue) photos -> `public/facilities/tempat-pertemuan/...`
- Any other facility/gallery photo an admin uploads

Written with `putPublicObject()` in [`src/lib/storage/r2.ts`](../src/lib/storage/r2.ts),
which returns the final public URL to store directly on the record (e.g.
`Homestay.imageUrl`, `FacilityPhoto.url`).

## `private/` - never a direct URL

Objects here are fetched only through the R2 S3 API using our server
credentials. The application **never** stores or renders a direct
`R2_PUBLIC_URL` link for these - it always calls `getSignedPrivateUrl()` to
mint a short-lived (default 5 minute) signed GET URL at the moment an
authorized user needs to view the file, after the usual session/role checks
for that page or API route have already passed. The backend enforces that
authorization check; the object itself is never reachable by guessing or
sharing a path.

Use for:
- KTR monitoring evidence captures -> `private/ktr/evidence/<areaId>/...`
  (`SmokingDetection.evidenceKey`)
- Field-officer profile pictures -> `private/employees/...`
- Admin profile pictures -> `private/admins/...`
- Any other internal/non-public documentation

Database columns holding a private reference are named `*Key` (an R2 object
key), never `*Url`, to make the distinction obvious at the schema level and
prevent a future developer from accidentally rendering it as a plain
`<img src>`.

## Static app assets (not in the bucket at all)

Anything that is genuinely static and ships with the application build -
the SIKESEK logo, other branding, generic UI icons/illustrations - belongs
in [`public/assets/`](../public/assets) (the Next.js static file directory,
not the R2 bucket - these share the name "public" but are two different
things) referenced via [`src/lib/assets.ts`](../src/lib/assets.ts). There
is no product reason to upload something through an admin form if it never
changes without a code deploy anyway.

## Local development without R2 credentials

`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
`R2_BUCKET_NAME` / `R2_PUBLIC_URL` are optional in development.
`isStorageConfigured()` reports whether they're present, and upload code
paths surface a clear error rather than crashing the whole request when
they're missing. The seeded demo homestay/venue photos point at local
`/public/assets/*.jpg` files precisely so the catalog renders correctly
without any R2 setup - `imageUrl` columns are plain URLs either way, so
swapping a seed photo for a real admin-uploaded one later is a data change,
not a code change.
