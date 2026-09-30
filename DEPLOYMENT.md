# Deploy ke Vercel

## Konfigurasi project

Hubungkan repository ke Vercel. File `vercel.json` mengatur framework Vite, output `dist`, dan meneruskan `/api/*` ke function `api/dispatch.ts` yang menjalankan Express. Endpoint health tetap dilayani `api/health.ts`. Function di-region Singapore (`sin1`) agar dekat dengan cluster TiDB Asia Tenggara.

Frontend (Vite) dan backend (Express di `api/`) harus berada di **satu project Vercel** yang sama agar request `/api/*` memakai domain yang sama.

## Environment variables

Tambahkan variabel berikut pada Vercel Project Settings → Environment Variables untuk Production **dan** Preview. Isi nilainya di dashboard; jangan commit file `.env`.

Wajib:

- `JWT_SECRET` — secret acak panjang
- `TIDB_HOST`, `TIDB_PORT` (biasanya `4000`), `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE` (atau `DATABASE_URL`)

Opsional:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `CLIENT_ORIGIN` hanya jika frontend dan API beda origin; beberapa origin dipisah koma
- `VITE_API_URL` **harus kosong** jika frontend dan API satu domain Vercel. Jangan isi `http://localhost:...` di Production.

Setelah mengubah env, klik **Redeploy** (tanpa cache jika function masih 404).

## TiDB Cloud

Di dashboard TiDB, izinkan koneksi dari internet / `0.0.0.0/0` (atau setidaknya jangan kunci IP ke laptop saja). Egress IP Vercel berubah-ubah, jadi allowlist IP laptop akan membuat API terasa "mati" setelah di-deploy.

Jalankan `npm run migrate:tidb` sekali dari mesin yang bisa mengakses cluster, supaya tabel siap sebelum traffic production.

## Pemeriksaan setelah deploy

1. Buka `https://<project>.vercel.app/api/health`. Harus JSON `status: "online"` dan `database: "TiDB Cloud"`. Jika HTML halaman login yang muncul, function API gagal di-build — cek log Function di Vercel.
2. Jika JSON `503` dengan `error`, isi env yang disebut, lalu Redeploy.
3. Uji login, data, check-in/out, unggah laporan, dan foto profil di deployment Preview dulu.
