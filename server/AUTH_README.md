# Sistem Login & Role

Role: **user** (biasa), **vip**, **admin**. Hak akses (edit di `RULES` pada `auth.js`):

| Fitur | user | vip | admin |
|---|---|---|---|
| Lihat status & log | ✅ | ✅ | ✅ |
| Lihat daftar sesi, tambah sesi nomor, lihat database, lihat case | ❌ | ✅ | ✅ |
| Start/Restart/Stop bot, pairing, reset session | ❌ | ❌ | ✅ |
| Stop/hapus sesi, ubah database, tambah/edit/hapus case | ❌ | ❌ | ✅ |
| Kelola akun (tab Admin) | ❌ | ❌ | ✅ |

## Pasang di server
1. Salin `auth.js` ke folder yang sama dengan file server API bot.
2. Di file server, SEBELUM route `/api/...` lain, dan HAPUS pengecekan token lama:
   ```js
   require('./auth')(app, { apiToken: TOKEN_LAMA });  // TOKEN_LAMA opsional: token lama tetap jadi admin
   ```
3. Jalankan ulang. Admin pertama dibuat otomatis, passwordnya tercetak di console
   (atau tentukan sendiri: `ADMIN_USER=rizz ADMIN_PASS=rahasia123 node ...`). Segera ganti dari tab Admin.
4. Data akun ada di `users.json` (password di-hash scrypt). Jangan di-commit ke git.

Keamanan: pembatasan sebenarnya dilakukan di server (`403` kalau role kurang). Tampilan app yang menyembunyikan menu hanya kosmetik.
