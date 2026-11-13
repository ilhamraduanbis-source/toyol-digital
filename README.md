# 🧟 Toyol Digital

**Matlamat kematangan Toyol:** bina kompetensi sehingga mampu menyelesaikan kerja bernilai sekitar **USD200 atau lebih** dengan kualiti, daya saing dan bukti penerimaan yang nyata. Angka ini **bukan nilai minimum bounty**. Tugasan kecil yang sah boleh menjadi latihan lapangan dan sumber pendapatan sebenar. Keupayaan mesti dibuktikan melalui ujian luaran dan penerimaan, bukan jumlah draf atau harga diiklankan.

## Operational checkpoint — 13 November 2026, 20:00 MYT

**Status: externally settled micro-task demonstrated; repeatable income and MYR cashout not demonstrated.** The earlier v0.9 notes below are historical, not the current operational status.

| Evidence | Latest verified state |
|---|---|
| Hourly Radar | 191/191 tests passed; scheduled scan completed |
| Paid Tasks | Scheduled scan completed successfully |
| OpenTask | 8 active offers totaling 762 USDC; 0 contracts; payout blocked at last check |
| Frantic | One delivery pending review; no verified settlement for that delivery |
| Forge / Taskmarket | Five prepared candidates; signature verifier submitted and external check passed; no matching awards; free submission unavailable at last reconciliation |
| SwarmMemo | One external Base USDC settlement independently recorded; no verified MYR cashout |

Evidence links: [scheduled radar and tests](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43404438408), [paid tasks](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43402083162), [OpenTask offers](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43409120515), [Forge reconciliation](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43421456885), [settlement receipt](https://github.com/ilhamraduanbis-source/toyol-digital/issues/5#issuecomment-6844756045).

**Priority:** convert pending work into verified payment, maintain scheduled monitoring, and do not spend owner money or bypass provider submission limits. An active offer, green test, submitted candidate, or advertised reward is not revenue. No changes to MYReady.

---

**Historical status v0.9:** Qwen 3B QUEST-READY (terhad), before the subsequent external settlement and workflow recovery.

**Pembinaan kompetensi bertahap:** [Capability Growth](docs/CAPABILITY_GROWTH.md) menyusun latihan lapangan, cabaran kompetitif dan bukti kenaikan tahap. Tiada penolakan automatik berdasarkan nilai bounty.

**Decision Engine (9 Nov 2026):** [Situation + Value + Learning](docs/DECISION_ENGINE.md) menggabungkan penilaian masalah, pemilihan strategi, carian simbol kod, perbandingan metadata PR pesaing, rekod pembelajaran dan pengasingan ganjaran diiklankan daripada wang yang boleh dikeluarkan di Malaysia. Ini masih percubaan untuk menghasilkan patch luar, bukan sistem pendapatan terjamin.

**Resilience Engine (9 Nov 2026):** Toyol kini boleh cuba membaiki patch yang gagal sehingga **dua kali setiap isu**, memulihkan fail asal, merekod sebab kegagalan, dan menggilir sasaran supaya tidak terperangkap pada lima isu sama. Persaingan bukan alasan automatik untuk berundur, tetapi larangan keselamatan serta syarat penyertaan kekal. Rujuk [Resilience Engine](docs/RESILIENCE_ENGINE.md). Ini belum bukti pekerjaan berbayar berjaya.

**Naik taraf kompetensi (9 Nov 2026):** jumlah komen/PR pesaing tidak lagi menyebabkan penolakan automatik. Toyol membezakan kes keselamatan, keperluan pengesahan dan peluang yang masih boleh dicabar dengan bukti. Lihat [Competency Engine](docs/COMPETENCY_ENGINE.md). Ini **bukan** bukti patch luar sudah diterima.

Toyol menyemak [suapan terbuka Jobbi](https://jobbi.org/gigs.json) secara berkala, mengasingkan tugasan untuk agen digital pada pelbagai nilai ganjaran, dan menyenarai pendek sehingga lapan calon. Ia menapis petunjuk deposit, staking, referral, yuran dan posting media sosial.

Jika ada calon, Toyol membuka atau mengemas kini satu **GitHub Issue** supaya hasil tidak hilang. Bahagian **Quest Progress** pada Issue #1 menyatakan pencetus sebenar, bilangan calon khusus, sebab penolakan dan pendapatan yang disahkan. Semua penyenaraian ialah *petunjuk sahaja* dan perlu disahkan di sumber asal.

**Keputusan keluaran, lima cubaan quest luar dan syarat berhenti:** [QUEST_RELEASE_DECISION_2026-11-09.md](docs/QUEST_RELEASE_DECISION_2026-11-09.md). Pautan bukti model 3B: [run #42566050523](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/42566050523). Model harian telah dinaik taraf kepada Qwen 3B; masih belum ada ganjaran diterima.

## Operasi

- **Tugas automatik**: [Toyol Radar (RM0)](../../actions/workflows/toyol.yml), dijadualkan pada minit 29 setiap jam (UTC), sekali sejam mengikut had Jobbi. Pelaksanaan cron telah dibuktikan oleh run GitHub `schedule`, tertakluk pada kelewatan GitHub Actions.
- **Hasil imbasan**: Actions → run → Summary. Jika ada calon, semak tab Issues.
- **Ujian**: Node.js terbina dalam, tanpa pakej pihak ketiga: `node --test test/*.test.mjs`.
- **Trigger manual**: Actions → Toyol Radar (RM0) → Run workflow.
- **Kod**: `src/toyol.mjs`; jadual: `.github/workflows/toyol.yml`.

Sumber data ialah [Jobbi](https://jobbi.org/docs/mcp/), indeks read-only, bukan pihak yang menerima tugasan atau membayar. Workflow `push` menjalankan ujian sahaja. Feed Jobbi diakses oleh job `scan` yang dijadualkan sekali sejam atau melalui `workflow_dispatch` manual; jangan cetuskan manual berulang kali. Tugasan asal mungkin perlukan akaun, kredit, deposit, perkakasan, atau kelulusan lain yang tidak ditangkap penapis automatik.

## Sempadan Toyol

- **Modal tunai RM0**: tiada langganan, transaksi, staking, iklan atau kredit API berbayar.
- **Tiada tuntutan palsu**: ganjaran diiklankan ≠ tugasan dituntut ≠ kerja selesai ≠ kerja diterima ≠ wang dibayar ≠ wang dikeluarkan.
- **Tiada tindakan kewangan**: tidak cipta dompet, tidak mendaftar bagi pihak pengguna, tidak membuat bayaran atau memindah dana.
- **Tiada spam/penyamaran**: tidak berbalas atau menghantar kerja secara rawak; tidak menjalankan kod daripada kandungan tugasan.
- **Pemisahan penuh**: repositori ini sahaja; MYReady dan projek lain tidak disentuh.
- **Public**: jangan simpan token API, kata laluan, private key atau data peribadi dalam repositori ini.

## Tahap 2: pelaksana kerja kod terhad (v0.3)

Toyol kini menjalankan `src/worker.mjs` selepas setiap imbasan radar. Ia boleh **mencuba pembaikan kod kecil yang dinyatakan secara tepat**, contohnya menamakan semula satu identifier (`Rename oldProp to newProp`) dalam projek sumber terbuka yang mempunyai isu bounty sebenar. Ia:

1. Membaca feed radar tanpa membuat panggilan Jobbi kedua.
2. Memahami tiga kelas arahan yang spesifik: nama semula identifier, penggantian prop JSX boolean tertentu, dan pembetulan typo dokumentasi. Bukan tugasan terbuka yang memerlukan pertimbangan AI.
3. Memeriksa isu asal masih terbuka, belum diberikan kepada pihak lain, bukti persaingan dianalisis tanpa menolak berdasarkan bilangan komen atau PR pesaing semata-mata, dan mempunyai label ganjaran.
4. Memuat turun kod awam ke komputer sementara GitHub; **tidak melaksanakan kod asing**.
5. Menghasilkan pembetulan kecil dalam fail sumber yang dibenarkan dan memeriksa `git diff --check`.
6. Jika berjaya, menyimpan `solution.patch` serta `manifest.json` sebagai artifact pada halaman GitHub Actions. Untuk setiap imbasan, fail `scan-result.json` merekod bilangan calon dan sebab penolakan.

Jika tiada tugas sesuai, ia melaporkan tiada penyelesaian, bukannya mereka-reka kerja atau pendapatan. **Patch automatik belum sama dengan kerja yang benar-benar diuji menyeluruh, diserahkan, diterima atau dibayar.** Tiada penghantaran PR ke repo orang lain, sebarang tuntutan bounty, pendaftaran, token atau pemindahan dana.

Untuk melihat keputusan sebenar: Actions → Toyol Radar and Stage 2 (RM0) → run terbaru → Job summary dan Artifacts (jika ada).

## Audit operasi (8 November 2026)

- Semua ujian terakhir: **19/19 lulus** dalam GitHub Actions.
- Sumber tunggal masih suapan Jobbi, dengan saringan baharu untuk membuang tajuk kosong atau tidak boleh ditindak.
- Pelaksanaan workflow terakhir yang disahkan ialah **push**, bukan **schedule**. GitHub boleh melambatkan atau menggugurkan cron, maka kebolehpercayaan jadual **belum terbukti**.
- Imbasan terakhir: satu calon berkaitan pembetulan kod tetapi ditolak kerana isu sudah bersaing. **0 patch untuk tugasan luar, 0 penerimaan, RM0 diterima.**
- Jadual telah didaftarkan semula melalui perubahan cron. Pantau dalam Actions sama ada run dengan event **schedule** muncul. Jangan anggap aktif hanya kerana ujian **push** hijau.

### Audit peluang sebenar (8 November 2026)

Audit automatik selepas mengimbas 657 listing: 273 lepas penapisan awal; 49 berupa isu GitHub daripada platform yang disokong; hanya **1** sepadan dengan kemahiran Toyol. Calon itu mempunyai tuntutan/persaingan dan ditolak. Ini **jurang kebolehan**, bukannya masalah frekuensi carian. Ujian integrasi turut membuktikan pembetulan typo `README.md` kini dapat dieksport sebagai patch Git sebenar. **23/23 ujian lulus**, tetapi 0 patch tugasan luar, 0 kerja diterima dan RM0 pembayaran terbukti.

**Perlindungan sumber:** `push` hanya menjalankan `node --test`. Hanya `schedule` atau arahan manual boleh mengimbas Jobbi. Jobbi meminta pengguna tidak mengundi feed lebih kerap daripada sekali sejam. Pelaksanaan `schedule` belum diperhatikan, jadi jadual tidak boleh dianggap terbukti walaupun kod workflow telah disahkan.

## Laluan ke pembayaran

Syarat rasmi bagi platform khusus ejen serta halangan dompet, identiti tandatangan, penerimaan tugasan dan pengeluaran MYR telah direkod dalam [PAYOUT_GATE.md](docs/PAYOUT_GATE.md). Ini bukan kebenaran untuk mencipta dompet, membuka akaun berbayar atau menuntut tugasan. Laluan pembayaran masih belum diaktifkan.

## Otak AI tempatan v0.9

Model **Qwen2.5-Coder 1.5B** melalui **llama.cpp** kini berjalan di CPU GitHub Actions tanpa API berbayar. Model sebenar berjaya membetulkan contoh kod yang rosak; lihat [run bukti AI](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/42487867606). Jambatan quest juga telah menyemak lima bounty luar, tetapi semua gagal melepasi gerbang penyertaan; tiada patch luar, serahan, penerimaan atau bayaran. Rujuk [penerangan lengkap AI Brain](docs/AI_BRAIN.md).

Workflow AI dipasang untuk cubaan **sekali sehari (03:37 UTC)** dan manual. Cron belum dibuktikan berjalan sendiri. Pencarian Jobbi kekal di workflow sejam sekali yang berasingan. Kod orang luar tidak dijalankan, dan model tidak boleh menghantar PR atau mengambil wang. Kos tunai sasaran **RM0**.

## Skill Pack v0.6 (11 kemahiran pembetulan yang benar-benar diuji)

3 kemahiran asal: **rename identifier**, **JSX boolean prop**, **typo dokumentasi**.

8 kemahiran tambahan, semuanya memerlukan arahan khusus dan terhad kepada satu fail atau skop jelas:

| Domain | Kemahiran | Contoh arahan tepat |
|---|---|---|
| Dokumentasi | Betulkan destinasi pautan Markdown | Fix broken markdown link https://old.example to https://new.example in README.md |
| Dokumentasi | Tukar tajuk Markdown | Rename markdown heading "Intro" to "Overview" in docs/guide.md |
| Kod | Tukar nama modul import | Replace import old-package with new-package in src/main.ts |
| Kod | Buang satu baris log ringkas | Remove console.log from src/main.ts |
| Pengurusan repo | Tambah corak .gitignore | Add *.log to .gitignore |
| Data JSON | Kemas kini medan asas yang sedia ada | Set enabled to false in data/config.json |
| Data CSV | Tukar nama kolum pada pengepala mudah | Rename CSV column fullname to name in data/list.csv |
| Data/kod/dokumen | Ganti literal tertentu dalam fail yang ditentukan | Replace literal "helloo" with "hello" in README.md |

Pelaksana akan menolak arahan yang kabur atau tidak boleh dibuktikan, cubaan mengubah fail di luar checkout, perubahan terlalu besar, JSON rosak, atau patch Git tidak sah. Ini ialah **automasi pembetulan khusus**, bukan pemahaman umum AI dan bukan bukti bahawa tugasan komersial sudah diterima.

### Dua keupayaan sokongan baharu

- **Quest Intelligence** (`src/quest-intel.mjs`): membaca API isu GitHub awam secara terhad untuk memeriksa status, tuntutan pesaing, tanda bayaran, usia isu, syarat kerja manusia, dan keperluan deposit. Hasil direkod sebagai bukti dalam `out/intelligence/`. Status lulus masih *bersyarat*, bukan kebenaran menghantar kerja.
- **Static Validation** (`src/static-check.mjs`): menyemak sintaks JavaScript, Python dan JSON tanpa menjalankan program atau memasang dependencies daripada repo orang lain. TypeScript/JSX/Markdown hanya diberi pemeriksaan terhad dan tidak didakwa lulus ujian projek.

**Bukti terkini: 49 daripada 49 ujian GitHub Actions lulus.** Workflow `push` menjalankan ujian sahaja, dan `scan` sengaja tidak dijalankan pada push bagi menghormati had suapan. Pemeriksaan penuh quest intelligence hanya boleh dibuktikan selepas run `schedule` atau `workflow_dispatch` berikutnya.

**Penilaian pasaran sebelumnya (659 item, hanya 1 padanan) tidak boleh dianggap bertambah hanya kerana bilangan kemahiran meningkat.** Padanan baharu akan diukur oleh `src/market.mjs` dalam run imbasan seterusnya.

## Apa yang belum ada

Toyol **belum berjaya menyelesaikan tugasan luar yang diterima sebagai kerja siap**, belum mempunyai saluran bayaran, dan belum menghasilkan pendapatan. Tahap 2 sekarang menyokong sebelas pembetulan khusus serta penolakan tugas bersaing; ia tidak menggunakan model AI berbayar; ia tidak menganggap patch sebagai tugasan selesai. Untuk benar-benar berpendapatan, perlu dipilih kelas kerja kecil yang membenarkan automasi, dengan kos sebenar sifar dan kaedah payout sah di Malaysia. Hanya selepas kitaran pembayaran pertama terbukti barulah wajar mengautomasikan pengulangan tugasan itu.

Jika imbasan gagal, lihat log pada Actions. GitHub Actions mungkin lewat atau menghentikan jadual selepas tempoh repositori awam tidak aktif. Sekiranya terma pelan percuma berubah, hentikan pelaksanaan dan jangan beralih kepada pelan berbayar tanpa kebenaran.
