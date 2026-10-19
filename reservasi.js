// Tugas I 11S3133 PABWE - Dea Maranata Siregar (11S24008)
// reservasi.js - logika bisnis Reservasi Ruangan (tanpa akses DOM).
// Dipisah dari UI agar mudah diuji otomatis dengan Node.js.
//
// Konvensi waktu:
//   tanggal = "YYYY-MM-DD", jam = "HH:MM" (waktu lokal pengguna).
//   "sekarang" selalu dikirim sebagai parameter { date, time } agar dapat diuji.

const Reservasi = (function () {
  const OPEN_MIN = 8 * 60;       // jam buka 08:00
  const CLOSE_MIN = 20 * 60;     // jam tutup 20:00
  const STEP_MIN = 30;           // jam mulai/selesai kelipatan 30 menit
  const MIN_DURATION = 30;       // durasi minimum (menit)
  const MAX_DURATION = 240;      // durasi maksimum (menit)
  const MAX_PER_DAY = 2;         // maksimum reservasi aktif per pemesan per hari
  const MAX_CAPACITY = 500;

  // --- Utilitas tanggal dan jam ---------------------------------------------

  const pad = (n) => String(n).padStart(2, "0");

  // Perbaikan #4: tanggal lokal diambil dari komponen Date, bukan toISOString()
  // yang memakai UTC (di UTC+7, sebelum pukul 07:00 hasilnya masih "kemarin").
  function nowParts(d = new Date()) {
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }

  // Perbaikan #1: new Date("2026-02-30") tidak error, melainkan "melompat" ke
  // 2 Maret. Karena itu tanggal divalidasi dengan mencocokkan ulang komponennya.
  function isValidDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  }

  // Perbaikan #2: jam dibandingkan sebagai menit (angka), bukan teks.
  // Sebagai teks, "9:00" > "10:00" bernilai benar.
  function toMinutes(hhmm) {
    const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm));
    if (!m) return NaN;
    const h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return NaN;
    return h * 60 + mi;
  }

  const fromMinutes = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

  // Perbaikan #3: dua rentang bentrok jika saling menimpa, tetapi rentang yang
  // hanya "bersentuhan" (selesai 10:00, mulai 10:00) tidak dianggap bentrok.
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

  function newId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // --- State ----------------------------------------------------------------

  function emptyState() {
    return { rooms: [], bookings: [] };
  }

  function normalizeState(raw) {
    // Perbaikan #8: bentuk data dari penyimpanan tidak boleh dipercaya begitu saja.
    if (!raw || typeof raw !== "object") return emptyState();
    return {
      rooms: Array.isArray(raw.rooms) ? raw.rooms : [],
      bookings: Array.isArray(raw.bookings) ? raw.bookings : [],
    };
  }

  const toNum = (v) => (typeof v === "string" && v.trim() === "" ? NaN : Number(v));

  // --- Ruangan --------------------------------------------------------------

  function addRoom(state, input) {
    const name = String(input.name ?? "").trim();
    const capacity = toNum(input.capacity);
    if (!name) return { ok: false, error: "Nama ruangan wajib diisi." };
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
      return { ok: false, error: `Kapasitas harus bilangan bulat antara 1 dan ${MAX_CAPACITY}.` };
    }
    if (state.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: "Nama ruangan sudah ada." };
    }
    const room = { id: newId(), name, capacity };
    state.rooms.push(room);
    return { ok: true, room };
  }

  function isUpcoming(b, now) {
    // belum selesai: tanggal di masa depan, atau hari ini dengan jam selesai belum lewat
    return b.date > now.date || (b.date === now.date && toMinutes(b.end) > toMinutes(now.time));
  }

  function deleteRoom(state, id, now) {
    // Perbaikan #6: ruangan yang masih punya reservasi aktif tidak boleh dihapus.
    const pending = state.bookings.some(
      (b) => b.roomId === id && b.status === "aktif" && isUpcoming(b, now)
    );
    if (pending) return { ok: false, error: "Ruangan masih memiliki reservasi aktif, tidak dapat dihapus." };
    const before = state.rooms.length;
    state.rooms = state.rooms.filter((r) => r.id !== id);
    state.bookings = state.bookings.filter((b) => b.roomId !== id);
    return before === state.rooms.length
      ? { ok: false, error: "Ruangan tidak ditemukan." }
      : { ok: true };
  }

  // --- Reservasi ------------------------------------------------------------

  function activeBookings(state, roomId, date) {
    return state.bookings.filter(
      // Perbaikan #5: reservasi yang dibatalkan tidak boleh memblokir slot.
      (b) => b.status === "aktif" && b.roomId === roomId && b.date === date
    );
  }

  function validateBooking(state, input, now) {
    const room = state.rooms.find((r) => r.id === input.roomId);
    if (!room) return "Pilih ruangan terlebih dahulu.";

    const name = String(input.name ?? "").trim();
    const purpose = String(input.purpose ?? "").trim();
    if (!name) return "Nama pemesan wajib diisi.";
    if (!purpose) return "Keperluan wajib diisi.";

    if (!isValidDate(input.date)) return "Tanggal tidak valid.";
    if (input.date < now.date) return "Tanggal tidak boleh di masa lalu.";

    const start = toMinutes(input.start);
    const end = toMinutes(input.end);
    if (Number.isNaN(start) || Number.isNaN(end)) return "Format jam tidak valid (HH:MM).";
    if (start % STEP_MIN !== 0 || end % STEP_MIN !== 0) {
      return `Jam harus kelipatan ${STEP_MIN} menit.`;
    }
    if (start >= end) return "Jam selesai harus setelah jam mulai.";
    if (start < OPEN_MIN || end > CLOSE_MIN) {
      return `Reservasi hanya pada jam operasional ${fromMinutes(OPEN_MIN)} sampai ${fromMinutes(CLOSE_MIN)}.`;
    }
    if (input.date === now.date && start <= toMinutes(now.time)) {
      return "Jam mulai sudah lewat.";
    }
    const duration = end - start;
    if (duration < MIN_DURATION || duration > MAX_DURATION) {
      return `Durasi harus antara ${MIN_DURATION} menit dan ${MAX_DURATION / 60} jam.`;
    }

    const people = toNum(input.people);
    if (!Number.isInteger(people) || people < 1) return "Jumlah peserta harus bilangan bulat minimal 1.";
    if (people > room.capacity) return `Jumlah peserta melebihi kapasitas ruangan (${room.capacity}).`;

    const sameDay = activeBookings(state, room.id, input.date);
    const mine = state.bookings.filter(
      (b) => b.status === "aktif" && b.date === input.date &&
             b.name.toLowerCase() === name.toLowerCase()
    );
    if (mine.length >= MAX_PER_DAY) {
      return `Satu pemesan maksimal ${MAX_PER_DAY} reservasi aktif per hari.`;
    }

    const clash = sameDay.find((b) => overlaps(start, end, toMinutes(b.start), toMinutes(b.end)));
    if (clash) return `Bentrok dengan reservasi ${clash.start}-${clash.end} atas nama ${clash.name}.`;

    return null;
  }

  function addBooking(state, input, now) {
    const error = validateBooking(state, input, now);
    if (error) return { ok: false, error };
    const booking = {
      id: newId(),
      roomId: input.roomId,
      name: String(input.name).trim(),
      purpose: String(input.purpose).trim(),
      date: input.date,
      start: input.start,
      end: input.end,
      people: toNum(input.people),
      status: "aktif",
    };
    state.bookings.push(booking);
    return { ok: true, booking };
  }

  function cancelBooking(state, id, now) {
    const b = state.bookings.find((x) => x.id === id);
    if (!b) return { ok: false, error: "Reservasi tidak ditemukan." };
    if (b.status !== "aktif") return { ok: false, error: "Reservasi sudah dibatalkan." };
    const notStarted =
      b.date > now.date || (b.date === now.date && toMinutes(b.start) > toMinutes(now.time));
    if (!notStarted) return { ok: false, error: "Reservasi sudah dimulai atau selesai, tidak dapat dibatalkan." };
    b.status = "batal";
    return { ok: true, booking: b };
  }

  // Slot mulai yang masih kosong untuk durasi tertentu pada ruangan dan tanggal.
  function availableSlots(state, roomId, date, durationMin, now) {
    if (!isValidDate(date) || !Number.isInteger(durationMin) ||
        durationMin < MIN_DURATION || durationMin > MAX_DURATION || durationMin % STEP_MIN !== 0) {
      return [];
    }
    if (date < now.date) return [];
    const busy = activeBookings(state, roomId, date).map((b) => [toMinutes(b.start), toMinutes(b.end)]);
    const slots = [];
    for (let s = OPEN_MIN; s + durationMin <= CLOSE_MIN; s += STEP_MIN) {
      if (date === now.date && s <= toMinutes(now.time)) continue;
      if (!busy.some(([bs, be]) => overlaps(s, s + durationMin, bs, be))) slots.push(fromMinutes(s));
    }
    return slots;
  }

  function sortedBookings(state, filter = {}) {
    return state.bookings
      .filter((b) => (!filter.date || b.date === filter.date) &&
                     (!filter.roomId || b.roomId === filter.roomId))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  function statusOf(b, now) {
    if (b.status === "batal") return "batal";
    return isUpcoming(b, now) ? "aktif" : "selesai";
  }

  return {
    OPEN_MIN, CLOSE_MIN, STEP_MIN, MIN_DURATION, MAX_DURATION, MAX_PER_DAY,
    nowParts, isValidDate, toMinutes, fromMinutes, overlaps,
    emptyState, normalizeState, addRoom, deleteRoom,
    validateBooking, addBooking, cancelBooking, availableSlots,
    sortedBookings, statusOf, isUpcoming,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Reservasi;
