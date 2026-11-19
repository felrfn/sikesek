# Deploy ke VPS

Panduan operasional untuk deployment VPS (Docker + GHCR + Caddy). Vercel tetap
berjalan dari branch `main` dan tidak diubah oleh pipeline ini.

```
main      ──► Vercel (build Vercel, tanpa perubahan)
vps       ──► GitHub Actions ──► GHCR ──► VPS dev  (environment: dev)
vps-prod  ──► GitHub Actions ──► GHCR ──► VPS prod (environment: prod)
```

Image yang dipakai sama untuk dev dan prod. Perbedaan hanya ada di `.env` VPS,
GitHub Environment, DNS, dan dashboard Midtrans/R2.

## 1. Bootstrap VPS (sekali)

Target: Debian 12, 1 vCPU, 1 GB RAM, 20 GB SSD.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"   # logout/login setelah ini

# Swap 2 GB: jaring pengaman untuk Next + Caddy di RAM 1 GB.
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable

sudo mkdir -p /opt/sikesek
sudo chown "$USER":"$USER" /opt/sikesek
```

Jangan menjalankan dev dan prod bersamaan di VPS 1 GB ini. Satu stack per VPS
(atau prod pindah ke VPS lain saat cutover).

## 2. DNS di Cloudflare

Pastikan zone `aqiissh.my.id` sudah **Active** di Cloudflare (nameserver di
registrar sudah diarahkan ke NS Cloudflare).

| Nama | Tipe | Isi | Proxy | Untuk |
|---|---|---|---|---|
| `@` (apex) | A | IP VPS | **DNS only** (abu-abu) | app |
| `dns` | AAAA | `100::` | Proxied (oranye) | Worker R2 |

- Apex sengaja DNS-only supaya Caddy bisa menerbitkan sertifikat Let's Encrypt
  lewat HTTP-01. Setelah sertifikat terbit, proxy boleh diaktifkan dengan SSL
  mode **Full (strict)** + Origin Certificate.
- Kalau lebih suka memakai subdomain (misalnya `dev.aqiissh.my.id`), ganti nama
  record A di atas dan ubah `APP_DOMAIN` / `APP_URL` di `.env` — tidak ada kode
  yang perlu diubah.
- `dns.aqiissh.my.id` dipakai sebagai hostname publik storage (Worker). Kalau
  Anda ingin nama lain, ganti `S3_PUBLIC_URL` dan route Worker-nya.

Catatan: `r2.dev` tidak dipakai. Hostname storage memakai domain sendiri,
sehingga tidak terkena blokir.

## 3. R2 + Worker untuk `public/*`

Bucket menyimpan `public/` dan `private/` (evidence KTR). Custom domain R2
mengekspos **seluruh** bucket, jadi jangan pasang custom domain langsung.
Gunakan Worker yang hanya meneruskan `public/*`.

1. Buat bucket R2, misalnya `sikesek-dev`.
2. Buat R2 API token (Object Read & Write) → simpan Access Key ID + Secret.
3. Buat Worker, isi dengan [`r2-public-worker.js`](./r2-public-worker.js).
4. Tambahkan R2 binding bernama `BUCKET` ke bucket tersebut.
5. Tambahkan route `dns.aqiissh.my.id/*`.
6. Pastikan DNS `dns` (AAAA `100::`, proxied) sudah ada.

Hasil URL publik:

```
https://dns.aqiissh.my.id/public/facilities/aren/<file>
https://dns.aqiissh.my.id/public/facilities/tempat-pertemuan/<file>
```

`private/*` akan dijawab 404 oleh Worker.

Kalau ingin memindahkan isi MinIO lokal ke R2 (opsional):

```bash
mc alias set local http://localhost:9000 <user> <pass>
mc alias set r2 https://<account-id>.r2.cloudflarestorage.com <key> <secret>
mc mirror local/sikesek-bucket/public r2/sikesek-dev/public
```

## 4. File `.env` di VPS

`deploy/.env.vps` sudah dibuat dari `.env` lokal Anda dengan domain dev dan
Neon direct URL. **Isi nilai R2** (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`) lalu kirim ke VPS:

```bash
scp deploy/.env.vps user@IP_VPS:/opt/sikesek/.env
ssh user@IP_VPS 'chmod 600 /opt/sikesek/.env'
```

Nilai penting:

```env
APP_DOMAIN=aqiissh.my.id          # dibaca Caddy
APP_URL=https://aqiissh.my.id     # runtime, redirect Midtrans
DIRECT_URL=...                        # Neon tanpa "-pooler", untuk migrate
S3_PUBLIC_URL=https://dns.aqiissh.my.id
S3_BUCKET_NAME=sikesek-dev
```

`.env` tidak pernah masuk git (`deploy/.env*` di-ignore).

## 5. GitHub Environment

Buat dua environment di **Settings → Environments**: `dev` dan `prod`.

### Secrets (per environment)

| Secret | Isi |
|---|---|
| `VPS_HOST` | IP atau hostname VPS |
| `VPS_USER` | user deploy (bukan root) |
| `VPS_SSH_KEY` | private key SSH (ed25519) |
| `VPS_KNOWN_HOSTS` | hasil `ssh-keyscan -H IP_VPS` |
| `GHCR_TOKEN` | classic PAT dengan scope `read:packages` |

### Variables (per environment)

| Variable | Dev | Prod (nanti) |
|---|---|---|
| `APP_URL` | `https://aqiissh.my.id` | `https://app.aqiissh.my.id` |
| `S3_PUBLIC_URL` | `https://dns.aqiissh.my.id` | `https://cdn.aqiissh.my.id` |
| `MIDTRANS_CLIENT_KEY` | sandbox client key | production client key |
| `MIDTRANS_IS_PRODUCTION` | `false` | `true` |
| `DEPLOY_DIR` | `/opt/sikesek` | `/opt/sikesek` di VPS prod |
| `GHCR_USERNAME` | username GitHub | username GitHub |

`S3_PUBLIC_URL` dan `MIDTRANS_IS_PRODUCTION` ikut di-bake saat build, jadi
setelah mengubahnya jalankan workflow **Deploy VPS** lewat `Run workflow`
(tidak perlu commit).

## 6. Deploy

Promosikan `main` ke VPS dev:

```bash
git push origin main:vps
```

Atau jalankan manual: **Actions → Deploy VPS → Run workflow → dev**.

Alur di VPS (`deploy/deploy.sh`):

1. `docker compose pull app migrate`
2. `docker compose run --rm migrate` (`prisma migrate deploy` via `DIRECT_URL`)
3. `docker compose up -d --no-deps app`
4. tunggu `/api/health` healthy (maks ±90 detik)
5. apply Caddy + reload
6. hapus image lama, sisakan 3 terbaru
7. kalau health gagal → otomatis kembali ke image sebelumnya

Cek manual:

```bash
ssh user@IP_VPS
cd /opt/sikesek
docker compose ps
docker compose logs -f app
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
```

## 7. Cron

Untuk sekarang **Vercel Cron tetap menjadi penjadwal** (`vercel.json` tidak
diubah) dan memakai Neon yang sama. VPS tidak perlu cron.

Kalau nanti ingin reminder/expiry lebih tepat waktu, tambahkan systemd timer
atau crontab yang memanggil endpoint lokal, misalnya tiap 10 menit:

```bash
# /usr/local/bin/sikesek-cron.sh
#!/usr/bin/env bash
set -a
. /opt/sikesek/.env
set +a
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/payments
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/bookings
```

Kedua endpoint idempotent, jadi aman walau Vercel dan VPS sama-sama memanggil.

## 8. Cutover ke domain produksi

Tidak ada perubahan kode. Urutannya:

1. DNS: buat `app` (A → VPS prod) dan `cdn`/`dns` untuk storage prod.
2. R2: buat bucket prod + Worker route.
3. VPS prod: isi `.env` dengan domain dan kredensial prod.
4. GitHub: isi Environment `prod` (secrets + vars di atas), buat branch
   `vps-prod`, lalu `git push origin main:vps-prod`.
5. Midtrans: ganti notification URL ke
   `https://app.aqiissh.my.id/api/midtrans/webhook` dan pakai production key.
6. Karena Vercel memakai Neon yang sama, jangan biarkan Vercel tetap menulis
   data prod dengan Midtrans sandbox. Arahkan Vercel ke Neon branch terpisah
   atau jadikan read-only.
7. Rollback aplikasi: `APP_IMAGE=<sha lama> docker compose up -d --no-deps app`.

Migrasi harus tetap aditif (tambah kolom/tabel) sampai Vercel dan VPS benar-
benar menjalankan versi kode yang sama. Ini yang membuat rollback image aman.

## 9. Troubleshooting

- **Caddy gagal dapat sertifikat**: DNS `dev` harus mengarah ke IP VPS dan
  proxy Cloudflare harus DNS-only saat penerbitan pertama. Cek
  `docker compose logs caddy`.
- **App unhealthy**: `docker compose logs --tail=100 app`. Biasanya env wajib
  kosong (`AUTH_SECRET`, `DATABASE_URL`, `S3_*`) atau migrasi belum jalan.
- **Migrasi gagal**: pastikan `DIRECT_URL` memakai host Neon tanpa `-pooler`.
- **Gambar tidak muncul**: `S3_PUBLIC_URL` harus sama antara build arg dan
  runtime `.env`; Worker harus mengizinkan `public/*`.
- **`docker compose pull` 401**: `GHCR_TOKEN` salah/kedaluwarsa atau package
  private dan VPS belum login.
