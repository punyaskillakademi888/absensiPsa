# Deploy ke Vercel

## Konfigurasi project

Hubungkan repository ke Vercel. File `vercel.json` mengatur framework Vite, output `dist`, dan meneruskan `/api/*` ke function `api/dispatch.ts` yang menjalankan Express. Endpoint health tetap dilayani `api/health.ts`. Function di-region Singapore (`sin1`) agar dekat dengan cluster TiDB Asia Tenggara.

Frontend (Vite) dan backend (Express di `api/`) harus berada di **satu project Vercel** yang sama agar request `/api/*` memakai domain yang sama.

## Environment variables

Variabel TiDB harus tersedia pada tahap build karena Vercel menjalankan migrasi skema sebelum membangun frontend.

Tambahkan variabel berikut pada Vercel Project Settings → Environment Variables untuk Production **dan** Preview. Isi nilainya di dashboard; jangan commit file `.env`.

Wajib:

- `JWT_SECRET` — secret acak panjang
- `TIDB_HOST`, `TIDB_PORT` (biasanya `4000`), `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE` (atau `DATABASE_URL`)
- `CRON_SECRET` — secret acak untuk mengamankan Vercel Cron

Opsional:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `CLIENT_ORIGIN` hanya jika frontend dan API beda origin; beberapa origin dipisah koma
- `VITE_API_URL` **harus kosong** jika frontend dan API satu domain Vercel. Jangan isi `http://localhost:...` di Production.

Setelah mengubah env, klik **Redeploy** (tanpa cache jika function masih 404).

Vercel Cron memanggil `/api/cron/auto-checkout` setiap pukul 12.00 UTC (19.00 WIB). Record hari itu yang sudah check-in tetapi belum check-out akan ditutup pada pukul 19.00 WIB. Server Express yang berjalan terus juga menjalankan proses yang sama secara berkala setelah pukul 19.00 WIB.

Vercel Cron memanggil `/api/cron/complete-batches` setiap pukul 17.05 UTC (00.05 WIB). Enrollment peserta pada Batch 5 dan batch berikutnya otomatis berstatus selesai setelah tanggal akhir batch terlewati; status batch juga diperbarui menjadi selesai. Server Express yang berjalan terus menjalankan pemeriksaan ini setiap menit dan saat startup.

Vercel Cron juga memanggil `/api/cron/complete-missions` setiap pukul 17.05 UTC (00.05 WIB). Misi yang tenggatnya sudah terlewati otomatis ditandai selesai dan tidak lagi ditampilkan kepada peserta. Pengumpulan tetap perlu divalidasi mentor; setelah disetujui, poin misi diberikan otomatis sesuai nilai saat misi dipublikasikan.

Reward Store memakai tabel `reward_items`, `reward_redemptions`, dan `point_ledger`; migrasi skema aplikasi membuat tabel tersebut otomatis serta menginisialisasi kredit misi yang sudah disetujui. Upload gambar hadiah menggunakan folder Cloudinary `hadirku/rewards`, sehingga konfigurasi Cloudinary diperlukan untuk upload gambar (URL gambar tetap dapat dimasukkan langsung).

## TiDB Cloud

Di dashboard TiDB, izinkan koneksi dari internet / `0.0.0.0/0` (atau setidaknya jangan kunci IP ke laptop saja). Egress IP Vercel berubah-ubah, jadi allowlist IP laptop akan membuat API terasa "mati" setelah di-deploy.

Jalankan `npm run migrate:tidb` sekali dari mesin yang bisa mengakses cluster, supaya tabel siap sebelum traffic production.

## Pemeriksaan setelah deploy

1. Buka `https://<project>.vercel.app/api/health`. Harus JSON `status: "online"` dan `database: "TiDB Cloud"`. Jika HTML halaman login yang muncul, function API gagal di-build — cek log Function di Vercel.
2. Jika JSON `503` dengan `error`, isi env yang disebut, lalu Redeploy.
3. Uji login, data, check-in/out, unggah laporan, foto profil, serta penukaran dan pembatalan hadiah di deployment Preview dulu.
