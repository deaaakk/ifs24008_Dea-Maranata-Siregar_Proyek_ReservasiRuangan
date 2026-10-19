**Nama:** Dea Maranata Siregar
**NIM:** 11S24008
**Program Studi:** Informatika, Fakultas Informatika dan Teknik Elektro, Institut Teknologi Del
**Mata Kuliah:** 11S3133 - Pengembangan Aplikasi Berbasis Web
**Dosen:** Arie Satia Dharma, S.T, M.Kom.

# Reservasi Ruangan (AI-Assisted Development)

Tugas I Mata Kuliah **11S3133 - Pengembangan Aplikasi Berbasis Web**.

Aplikasi web sederhana untuk memesan ruangan (lab, aula, ruang rapat) tanpa jadwal bentrok. Ditulis dengan **JavaScript murni** (tanpa framework dan tanpa server) dengan bantuan AI generatif (Claude) sebagai asisten pemrograman. Seluruh keluaran AI direview, diuji, dan diperbaiki secara manual. Proses lengkapnya ada pada dokumen proposal di folder `docs/`.

## Fitur

- Kelola ruangan (nama unik, kapasitas 1-500)
- Buat reservasi: ruangan, pemesan, peserta, keperluan, tanggal, jam mulai dan selesai
- Deteksi jadwal bentrok (jadwal yang hanya bersentuhan, misalnya selesai 11:00 dan mulai 11:00, diperbolehkan)
- Aturan: jam operasional 08:00-20:00, kelipatan 30 menit, durasi 30 menit sampai 4 jam, peserta tidak melebihi kapasitas, maksimal 2 reservasi aktif per pemesan per hari
- Cek slot kosong dan klik jam untuk mengisi formulir
- Batalkan reservasi (hanya yang belum dimulai); reservasi batal membebaskan slot
- Ruangan yang masih punya reservasi aktif tidak dapat dihapus
- Jadwal dengan filter ruangan dan tanggal, status Aktif/Selesai/Dibatalkan
- Data tersimpan otomatis di `localStorage`
- Aman dari XSS (tampilan dibuat dengan `textContent`)

## Cara Menjalankan

1. Clone repository:
   ```bash
   git clone https://github.com/<username>/<nama-repo>.git
   cd <nama-repo>
   ```
2. Buka `index.html` di browser. Tidak perlu instalasi apa pun.

## Menjalankan Pengujian Otomatis

Memerlukan Node.js 18 atau lebih baru (tanpa dependensi tambahan):

```bash
npm test
```

Terdapat 26 uji untuk validasi tanggal dan jam, bentrok, kapasitas, pembatalan, slot kosong, zona waktu, dan data rusak.

## Struktur Folder

```
.
├── index.html          # struktur halaman
├── style.css           # tampilan
├── reservasi.js        # logika bisnis (tanpa DOM, dapat diuji di Node)
├── app.js              # antarmuka: render dan event
├── tests/
│   └── reservasi.test.js  # 26 uji otomatis (node:test)
├── docs/               # proposal dan screenshot
├── package.json
└── README.md
```

## Catatan Penggunaan AI

| # | Masalah pada keluaran AI awal | Perbaikan |
|---|---|---|
| 1 | `new Date("2026-02-30")` tidak error (melompat ke Maret), jam "25:99" lolos | Validasi ketat dengan mencocokkan ulang komponen tanggal dan jam |
| 2 | Jam dibandingkan sebagai teks ("9:00" > "10:00") | Dikonversi ke menit |
| 3 | Pengecekan bentrok salah: jadwal bersentuhan ditolak atau tumpang tindih sebagian lolos | `aStart < bEnd && aEnd > bStart` |
| 4 | `toISOString()` memakai UTC; di UTC+7 sebelum 07:00 "hari ini" menjadi kemarin | Tanggal lokal dari komponen `Date` |
| 5 | Reservasi yang dibatalkan tetap memblokir slot | Hanya reservasi berstatus aktif yang dihitung |
| 6 | Ruangan dengan reservasi aktif dapat dihapus | Ditolak jika masih ada reservasi aktif |
| 7 | `innerHTML` rentan XSS | `createElement` dan `textContent` |
| 8 | `JSON.parse` pada data kosong/rusak menyebabkan crash | `try/catch` dan `normalizeState` |

## Lisensi

Dibuat untuk keperluan akademik.
