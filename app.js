// Tugas I 11S3133 PABWE - Dea Maranata Siregar (11S24008)
// app.js - lapisan antarmuka (DOM) Reservasi Ruangan.
// Seluruh aturan bisnis ada di reservasi.js; berkas ini hanya menghubungkan UI dan data.

const STORAGE_KEY = "reservasi-ruangan-v1";
const $ = (id) => document.getElementById(id);

let state = load();

// --- Penyimpanan -------------------------------------------------------------

function load() {
  try {
    return Reservasi.normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch (err) {
    console.warn("Data tersimpan tidak valid, memulai dari kosong.", err);
    return Reservasi.emptyState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Gagal menyimpan data.", err);
  }
}

// --- Helper tampilan ---------------------------------------------------------

const now = () => Reservasi.nowParts();

function el(tag, props = {}, ...children) {
  // Perbaikan #7 (keamanan): elemen dibangun lewat DOM API dan textContent,
  // bukan innerHTML, sehingga masukan pengguna tidak pernah dieksekusi sebagai HTML.
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => c && node.append(c));
  return node;
}

function showMsg(target, text, type) {
  target.textContent = text;
  target.className = "msg " + type;
  target.hidden = false;
}

const roomName = (id) => (state.rooms.find((r) => r.id === id) || { name: "(ruangan dihapus)" }).name;

// --- Render ------------------------------------------------------------------

function renderRooms() {
  const list = $("room-list");
  list.replaceChildren();
  if (state.rooms.length === 0) {
    list.append(el("li", { class: "empty", text: "Belum ada ruangan." }));
    return;
  }
  state.rooms.forEach((r) => {
    list.append(
      el("li", {},
        el("span", {}, el("strong", { text: r.name }), el("span", { class: "cap", text: `kapasitas ${r.capacity}` })),
        el("button", { class: "small danger", type: "button", text: "Hapus", onclick: () => removeRoom(r.id) })
      )
    );
  });
}

function fillRoomSelect(sel, withAll) {
  const prev = sel.value;
  sel.replaceChildren(el("option", { value: "", text: withAll ? "Semua ruangan" : "-- pilih ruangan --" }));
  state.rooms.forEach((r) => sel.append(el("option", { value: r.id, text: `${r.name} (maks ${r.capacity})` })));
  sel.value = state.rooms.some((r) => r.id === prev) ? prev : "";
}

function renderSchedule() {
  const body = $("sched-body");
  body.replaceChildren();
  const list = Reservasi.sortedBookings(state, { date: $("f-date").value, roomId: $("f-room").value });
  if (list.length === 0) {
    body.append(el("tr", {}, el("td", { class: "empty", colspan: "8", text: "Belum ada reservasi." })));
    return;
  }
  const n = now();
  list.forEach((b) => {
    const status = Reservasi.statusOf(b, n);
    const label = { aktif: "Aktif", selesai: "Selesai", batal: "Dibatalkan" }[status];
    const action = el("td");
    const canCancel = status === "aktif" &&
      (b.date > n.date || (b.date === n.date && Reservasi.toMinutes(b.start) > Reservasi.toMinutes(n.time)));
    if (canCancel) {
      action.append(el("button", { class: "small danger", type: "button", text: "Batalkan", onclick: () => doCancel(b.id) }));
    }
    body.append(
      el("tr", {},
        el("td", { text: b.date }),
        el("td", { text: `${b.start}-${b.end}` }),
        el("td", { text: roomName(b.roomId) }),
        el("td", { text: b.name }),
        el("td", { text: b.purpose }),
        el("td", { text: String(b.people) }),
        el("td", {}, el("span", { class: "badge " + status, text: label })),
        action
      )
    );
  });
}

function renderAll() {
  renderRooms();
  fillRoomSelect($("b-room"), false);
  fillRoomSelect($("f-room"), true);
  renderSchedule();
}

// --- Aksi --------------------------------------------------------------------

function removeRoom(id) {
  const room = state.rooms.find((r) => r.id === id);
  if (!room || !window.confirm(`Hapus ruangan "${room.name}"?`)) return;
  const res = Reservasi.deleteRoom(state, id, now());
  if (!res.ok) {
    showMsg($("room-msg"), res.error, "error");
    return;
  }
  save();
  showMsg($("room-msg"), "Ruangan dihapus.", "success");
  renderAll();
}

function doCancel(id) {
  const res = Reservasi.cancelBooking(state, id, now());
  if (!res.ok) {
    showMsg($("book-msg"), res.error, "error");
    return;
  }
  save();
  showMsg($("book-msg"), "Reservasi dibatalkan.", "success");
  renderAll();
}

function showSlots() {
  const box = $("slot-list");
  box.replaceChildren();
  const roomId = $("b-room").value;
  if (!roomId) {
    box.append(el("span", { class: "none", text: "Pilih ruangan terlebih dahulu." }));
    return;
  }
  const date = $("b-date").value;
  const dur = Number($("s-dur").value);
  const slots = Reservasi.availableSlots(state, roomId, date, dur, now());
  if (slots.length === 0) {
    box.append(el("span", { class: "none", text: "Tidak ada slot kosong (atau tanggal belum diisi)." }));
    return;
  }
  slots.forEach((s) => {
    box.append(el("button", {
      class: "chip", type: "button", text: s,
      onclick: () => {
        $("b-start").value = s;
        $("b-end").value = Reservasi.fromMinutes(Reservasi.toMinutes(s) + dur);
      },
    }));
  });
}

// --- Event -------------------------------------------------------------------

$("room-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const res = Reservasi.addRoom(state, { name: $("r-name").value, capacity: $("r-cap").value });
  if (!res.ok) {
    showMsg($("room-msg"), res.error, "error");
    return;
  }
  save();
  $("room-form").reset();
  showMsg($("room-msg"), "Ruangan ditambahkan.", "success");
  renderAll();
});

$("book-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const res = Reservasi.addBooking(state, {
    roomId: $("b-room").value,
    name: $("b-name").value,
    purpose: $("b-purpose").value,
    date: $("b-date").value,
    start: $("b-start").value,
    end: $("b-end").value,
    people: $("b-people").value,
  }, now());
  if (!res.ok) {
    showMsg($("book-msg"), res.error, "error");
    return;
  }
  save();
  showMsg($("book-msg"), `Reservasi berhasil: ${res.booking.date} ${res.booking.start}-${res.booking.end}.`, "success");
  $("b-purpose").value = "";
  $("b-start").value = "";
  $("b-end").value = "";
  $("slot-list").replaceChildren();
  renderAll();
});

$("btn-slots").addEventListener("click", showSlots);
$("f-room").addEventListener("change", renderSchedule);
$("f-date").addEventListener("change", renderSchedule);
$("f-clear").addEventListener("click", () => {
  $("f-room").value = "";
  $("f-date").value = "";
  renderSchedule();
});

$("b-date").value = now().date;
renderAll();
