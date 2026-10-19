// Tugas I 11S3133 PABWE - Dea Maranata Siregar (11S24008)
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../reservasi.js");

const NOW = { date: "2026-10-15", time: "10:00" };

function setup() {
  const s = R.emptyState();
  const room = R.addRoom(s, { name: "Lab Komputer 1", capacity: 30 }).room;
  return { s, room };
}
const input = (room, o = {}) => ({
  roomId: room.id, name: "Budi", purpose: "Rapat kelompok",
  date: "2026-10-16", start: "09:00", end: "11:00", people: 10, ...o,
});

// --- Ruangan -----------------------------------------------------------------

test("T1 tambah ruangan valid", () => {
  const s = R.emptyState();
  assert.equal(R.addRoom(s, { name: "Aula", capacity: 100 }).ok, true);
  assert.equal(s.rooms.length, 1);
});

test("T2 ruangan: nama kosong, kapasitas tidak wajar, atau nama ganda ditolak", () => {
  const s = R.emptyState();
  assert.equal(R.addRoom(s, { name: "  ", capacity: 10 }).ok, false);
  for (const capacity of [0, -5, 1.5, 501, "abc", ""]) {
    assert.equal(R.addRoom(s, { name: "X", capacity }).ok, false, `kapasitas ${capacity}`);
  }
  assert.equal(R.addRoom(s, { name: "Aula", capacity: 10 }).ok, true);
  assert.equal(R.addRoom(s, { name: "aula", capacity: 20 }).ok, false);
});

// --- Validasi tanggal dan jam ------------------------------------------------

test("T3 isValidDate menolak tanggal yang tidak ada di kalender", () => {
  assert.equal(R.isValidDate("2026-02-30"), false);
  assert.equal(R.isValidDate("2026-13-01"), false);
  assert.equal(R.isValidDate("2026-2-3"), false);
  assert.equal(R.isValidDate("2024-02-29"), true);  // kabisat
  assert.equal(R.isValidDate("2026-02-29"), false); // bukan kabisat
});

test("T4 toMinutes menolak jam tidak valid dan membandingkan secara numerik", () => {
  assert.ok(Number.isNaN(R.toMinutes("25:00")));
  assert.ok(Number.isNaN(R.toMinutes("10:75")));
  assert.ok(Number.isNaN(R.toMinutes("9:00")));
  assert.ok(R.toMinutes("09:00") < R.toMinutes("10:00"));
  assert.equal(R.fromMinutes(R.toMinutes("13:30")), "13:30");
});

test("T5 reservasi valid disimpan dengan status aktif", () => {
  const { s, room } = setup();
  const r = R.addBooking(s, input(room), NOW);
  assert.equal(r.ok, true);
  assert.equal(r.booking.status, "aktif");
});

test("T6 menolak tanggal tidak valid dan tanggal masa lalu", () => {
  const { s, room } = setup();
  assert.equal(R.addBooking(s, input(room, { date: "2026-02-30" }), NOW).ok, false);
  assert.equal(R.addBooking(s, input(room, { date: "2026-10-14" }), NOW).ok, false);
});

test("T7 hari ini: jam mulai yang sudah lewat ditolak", () => {
  const { s, room } = setup();
  assert.equal(R.addBooking(s, input(room, { date: NOW.date, start: "09:30", end: "10:30" }), NOW).ok, false);
  assert.equal(R.addBooking(s, input(room, { date: NOW.date, start: "10:30", end: "11:30" }), NOW).ok, true);
});

test("T8 menolak jam selesai <= mulai, di luar jam operasional, bukan kelipatan 30", () => {
  const { s, room } = setup();
  const bad = [
    { start: "11:00", end: "09:00" },
    { start: "10:00", end: "10:00" },
    { start: "07:00", end: "09:00" },
    { start: "19:00", end: "21:00" },
    { start: "09:10", end: "10:00" },
    { start: "xx", end: "10:00" },
  ];
  for (const o of bad) assert.equal(R.addBooking(s, input(room, o), NOW).ok, false, JSON.stringify(o));
});

test("T9 durasi maksimum 4 jam", () => {
  const { s, room } = setup();
  assert.equal(R.addBooking(s, input(room, { start: "08:00", end: "12:30" }), NOW).ok, false);
  assert.equal(R.addBooking(s, input(room, { start: "08:00", end: "12:00" }), NOW).ok, true);
});

test("T10 peserta tidak boleh melebihi kapasitas atau tidak valid", () => {
  const { s, room } = setup();
  for (const people of [31, 0, -1, 2.5, "", "abc"]) {
    assert.equal(R.addBooking(s, input(room, { people }), NOW).ok, false, `peserta ${people}`);
  }
  assert.equal(R.addBooking(s, input(room, { people: 30 }), NOW).ok, true);
});

test("T11 nama pemesan dan keperluan wajib diisi", () => {
  const { s, room } = setup();
  assert.equal(R.addBooking(s, input(room, { name: "  " }), NOW).ok, false);
  assert.equal(R.addBooking(s, input(room, { purpose: "" }), NOW).ok, false);
});

// --- Bentrok -----------------------------------------------------------------

test("T12 jadwal yang saling menimpa ditolak", () => {
  const { s, room } = setup();
  R.addBooking(s, input(room, { start: "09:00", end: "11:00" }), NOW);
  const cases = [
    ["09:00", "11:00"], ["10:00", "12:00"], ["08:00", "09:30"], ["09:30", "10:30"], ["08:30", "11:30"],
  ];
  for (const [start, end] of cases) {
    assert.equal(R.addBooking(s, input(room, { name: "Ani", start, end }), NOW).ok, false, `${start}-${end}`);
  }
});

test("T13 jadwal yang hanya bersentuhan boleh (selesai 11:00, mulai 11:00)", () => {
  const { s, room } = setup();
  R.addBooking(s, input(room, { start: "09:00", end: "11:00" }), NOW);
  assert.equal(R.addBooking(s, input(room, { name: "Ani", start: "11:00", end: "12:00" }), NOW).ok, true);
  assert.equal(R.addBooking(s, input(room, { name: "Cici", start: "08:00", end: "09:00" }), NOW).ok, true);
});

test("T14 tanggal atau ruangan berbeda tidak bentrok", () => {
  const { s, room } = setup();
  const other = R.addRoom(s, { name: "Aula", capacity: 100 }).room;
  R.addBooking(s, input(room), NOW);
  assert.equal(R.addBooking(s, input(room, { name: "Ani", date: "2026-10-17" }), NOW).ok, true);
  assert.equal(R.addBooking(s, input(other, { name: "Cici" }), NOW).ok, true);
});

test("T15 pembandingan jam memakai angka, bukan teks (09:00 sampai 10:00 vs 10:00 sampai 11:00)", () => {
  assert.equal(R.overlaps(R.toMinutes("09:00"), R.toMinutes("10:00"), R.toMinutes("10:00"), R.toMinutes("11:00")), false);
  assert.equal(R.overlaps(R.toMinutes("09:30"), R.toMinutes("10:30"), R.toMinutes("10:00"), R.toMinutes("11:00")), true);
});

test("T16 maksimal 2 reservasi aktif per pemesan per hari", () => {
  const { s, room } = setup();
  assert.equal(R.addBooking(s, input(room, { start: "08:00", end: "09:00" }), NOW).ok, true);
  assert.equal(R.addBooking(s, input(room, { start: "10:00", end: "11:00" }), NOW).ok, true);
  assert.equal(R.addBooking(s, input(room, { start: "13:00", end: "14:00" }), NOW).ok, false);
  assert.equal(R.addBooking(s, input(room, { name: "BUDI", start: "13:00", end: "14:00" }), NOW).ok, false);
});

// --- Pembatalan --------------------------------------------------------------

test("T17 pembatalan membebaskan slot", () => {
  const { s, room } = setup();
  const b = R.addBooking(s, input(room), NOW).booking;
  assert.equal(R.addBooking(s, input(room, { name: "Ani" }), NOW).ok, false);
  assert.equal(R.cancelBooking(s, b.id, NOW).ok, true);
  assert.equal(R.addBooking(s, input(room, { name: "Ani" }), NOW).ok, true);
});

test("T18 reservasi yang dibatalkan tidak dihitung pada batas per hari", () => {
  const { s, room } = setup();
  const a = R.addBooking(s, input(room, { start: "08:00", end: "09:00" }), NOW).booking;
  R.addBooking(s, input(room, { start: "10:00", end: "11:00" }), NOW);
  R.cancelBooking(s, a.id, NOW);
  assert.equal(R.addBooking(s, input(room, { start: "13:00", end: "14:00" }), NOW).ok, true);
});

test("T19 reservasi yang sudah dimulai/selesai atau sudah batal tidak dapat dibatalkan", () => {
  const { s, room } = setup();
  const today = R.addBooking(s, input(room, { date: NOW.date, start: "10:30", end: "11:30" }), NOW).booking;
  assert.equal(R.cancelBooking(s, today.id, { date: NOW.date, time: "10:30" }).ok, false); // sedang mulai
  assert.equal(R.cancelBooking(s, today.id, { date: NOW.date, time: "10:15" }).ok, true);
  assert.equal(R.cancelBooking(s, today.id, { date: NOW.date, time: "10:15" }).ok, false); // sudah batal
  assert.equal(R.cancelBooking(s, "tidak-ada", NOW).ok, false);
});

// --- Hapus ruangan -----------------------------------------------------------

test("T20 ruangan dengan reservasi aktif tidak dapat dihapus", () => {
  const { s, room } = setup();
  const b = R.addBooking(s, input(room), NOW).booking;
  assert.equal(R.deleteRoom(s, room.id, NOW).ok, false);
  R.cancelBooking(s, b.id, NOW);
  assert.equal(R.deleteRoom(s, room.id, NOW).ok, true);
  assert.equal(s.rooms.length, 0);
  assert.equal(s.bookings.length, 0);
});

// --- Slot kosong -------------------------------------------------------------

test("T21 availableSlots menghindari bentrok dan menghormati jam operasional", () => {
  const { s, room } = setup();
  R.addBooking(s, input(room, { start: "09:00", end: "11:00" }), NOW);
  const slots = R.availableSlots(s, room.id, "2026-10-16", 60, NOW);
  assert.ok(slots.includes("08:00"));     // 08:00-09:00 muat, bersentuhan
  assert.ok(!slots.includes("08:30"));    // 08:30-09:30 menimpa
  assert.ok(!slots.includes("10:30"));
  assert.ok(slots.includes("11:00"));
  assert.ok(slots.includes("19:00"));     // 19:00-20:00 masih muat
  assert.ok(!slots.includes("19:30"));    // melewati jam tutup
});

test("T22 availableSlots hari ini hanya menampilkan jam yang belum lewat", () => {
  const { s, room } = setup();
  const slots = R.availableSlots(s, room.id, NOW.date, 60, NOW);
  assert.equal(slots[0], "10:30");
});

test("T23 availableSlots mengembalikan kosong untuk masukan tidak valid", () => {
  const { s, room } = setup();
  assert.deepEqual(R.availableSlots(s, room.id, "2026-02-30", 60, NOW), []);
  assert.deepEqual(R.availableSlots(s, room.id, "2026-10-16", 45, NOW), []);
  assert.deepEqual(R.availableSlots(s, room.id, "2026-10-01", 60, NOW), []);
});

// --- Zona waktu dan data -----------------------------------------------------

test("T24 nowParts memakai waktu lokal, bukan UTC", () => {
  // 2026-10-15 05:30 waktu lokal pada komputer ini, apa pun zona waktunya
  const d = new Date(2026, 9, 15, 5, 30);
  assert.deepEqual(R.nowParts(d), { date: "2026-10-15", time: "05:30" });
});

test("T25 normalizeState menangani data null, rusak, atau salah bentuk", () => {
  for (const raw of [null, undefined, 42, "x", [], { rooms: "x", bookings: 3 }]) {
    const st = R.normalizeState(raw);
    assert.ok(Array.isArray(st.rooms) && Array.isArray(st.bookings));
  }
});

test("T26 sortedBookings mengurutkan menurut tanggal lalu jam dan dapat difilter", () => {
  const { s, room } = setup();
  R.addBooking(s, input(room, { name: "A", date: "2026-10-17", start: "09:00", end: "10:00" }), NOW);
  R.addBooking(s, input(room, { name: "B", date: "2026-10-16", start: "13:00", end: "14:00" }), NOW);
  R.addBooking(s, input(room, { name: "C", date: "2026-10-16", start: "09:00", end: "10:00" }), NOW);
  assert.deepEqual(R.sortedBookings(s).map((b) => b.name), ["C", "B", "A"]);
  assert.deepEqual(R.sortedBookings(s, { date: "2026-10-17" }).map((b) => b.name), ["A"]);
});
