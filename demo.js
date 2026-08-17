// ============================================================
// Glasshouse Reservations — simplified script
// This file does 3 things:
//   1. Shows available time slots for a chosen date
//   2. Saves a new reservation when the form is submitted
//   3. Lets the user view / cancel their reservations
// Data is stored in the browser's localStorage as plain JSON.
// ============================================================

// ---- Settings ----
const TABLE_CAPACITY = 8;      // tables per 30-min seating
const OPEN_HOUR = 17;          // 5:00 PM
const CLOSE_HOUR = 21;         // last seating 9:30 PM
const CLOSE_MIN = 30;

// ---- Shortcuts to page elements ----
const dateInput   = document.getElementById('resDate');
const slotsGrid    = document.getElementById('slotsGrid');
const partyCount   = document.getElementById('partyCount');
const resForm      = document.getElementById('resForm');
const submitBtn    = document.getElementById('submitBtn');
const formStatus   = document.getElementById('formStatus');
const summaryBox   = document.getElementById('selectedSummary');
const toastEl      = document.getElementById('toast');

let party = 2;            // how many guests
let selectedSlot = null;  // chosen time, e.g. "18:30"

// ============================================================
// STORAGE (localStorage helpers)
// Reservations for one date are stored under key: "slots-2026-08-17"
// All of the user's own bookings are stored under key: "my-reservations"
// ============================================================

function loadJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getSlotsForDate(dateISO) {
  return loadJSON('slots-' + dateISO, {});   // { "18:00": 3, "18:30": 8, ... }
}

function saveSlotsForDate(dateISO, data) {
  saveJSON('slots-' + dateISO, data);
}

function getMyReservations() {
  return loadJSON('my-reservations', []);
}

function saveMyReservations(list) {
  saveJSON('my-reservations', list);
}

// ============================================================
// SMALL HELPERS
// ============================================================

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime12(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return h12 + ':' + String(minute).padStart(2, '0') + ' ' + period;
}

function formatDateLong(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

// build the list of every seating time, e.g. ["17:00","17:30",...,"21:30"]
function allSeatingTimes() {
  const times = [];
  let hour = OPEN_HOUR, min = 0;
  while (hour < CLOSE_HOUR || (hour === CLOSE_HOUR && min <= CLOSE_MIN)) {
    times.push(String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0'));
    min += 30;
    if (min === 60) { min = 0; hour++; }
  }
  return times;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function makeReservationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return 'GLH-' + code;
}

// ============================================================
// PARTY SIZE STEPPER (+ / − buttons)
// ============================================================

function renderParty() {
  partyCount.textContent = party;
  document.getElementById('partyMinus').disabled = party <= 1;
  document.getElementById('partyPlus').disabled = party >= 12;
}

document.getElementById('partyMinus').addEventListener('click', () => {
  if (party > 1) { party--; renderParty(); }
});
document.getElementById('partyPlus').addEventListener('click', () => {
  if (party < 12) { party++; renderParty(); }
});

// ============================================================
// TIME SLOT GRID
// ============================================================

function loadSlots() {
  selectedSlot = null;
  updateSummary();

  const dateISO = dateInput.value;
  if (!dateISO) {
    slotsGrid.innerHTML = '<div class="slots-empty">Choose a date to see seatings.</div>';
    return;
  }

  const booked = getSlotsForDate(dateISO);
  renderSlots(dateISO, booked);
}

function renderSlots(dateISO, booked) {
  slotsGrid.innerHTML = '';
  const isToday = dateISO === todayISO();
  const now = new Date();
  let shown = 0;

  allSeatingTimes().forEach(time => {
    const [hour, min] = time.split(':').map(Number);

    // hide times that already passed today
    if (isToday) {
      const slotTime = new Date();
      slotTime.setHours(hour, min, 0, 0);
      if (slotTime < now) return;
    }
    shown++;

    const bookedCount = booked[time] || 0;
    const remaining = TABLE_CAPACITY - bookedCount;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    if (remaining <= 0) { btn.classList.add('full'); btn.disabled = true; }
    else if (remaining <= 2) { btn.classList.add('low'); }

    btn.innerHTML =
      '<div class="time">' + formatTime12(hour, min) + '</div>' +
      '<div class="avail">' + (remaining <= 0 ? 'full' : remaining + ' left') + '</div>';

    btn.addEventListener('click', () => {
      selectedSlot = time;
      slotsGrid.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
      btn.classList.add('selected');
      updateSummary();
    });

    slotsGrid.appendChild(btn);
  });

  if (shown === 0) {
    slotsGrid.innerHTML = '<div class="slots-empty">No more seatings today — try another date.</div>';
  }
}

function updateSummary() {
  if (!selectedSlot) {
    summaryBox.textContent = 'No seating selected yet.';
    return;
  }
  const [hour, min] = selectedSlot.split(':').map(Number);
  summaryBox.innerHTML = 'Table for <b>' + party + '</b> · <b>' +
    formatTime12(hour, min) + '</b> · ' + formatDateLong(dateInput.value);
}

dateInput.min = todayISO();
dateInput.value = todayISO();
dateInput.addEventListener('change', loadSlots);

// ============================================================
// FORM SUBMIT (create a reservation)
// ============================================================

function formIsValid() {
  const name = document.getElementById('guestName').value.trim();
  const email = document.getElementById('guestEmail').value.trim();
  const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  document.getElementById('hintName').textContent = name.length < 2 ? 'Enter your full name.' : '';
  document.getElementById('hintEmail').textContent = emailOK ? '' : 'Enter a valid email address.';
  formStatus.textContent = '';

  if (!selectedSlot) formStatus.textContent = 'Please select an available seating time.';

  return name.length >= 2 && emailOK && selectedSlot;
}

resForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!formIsValid()) return;

  const dateISO = dateInput.value;
  const slots = getSlotsForDate(dateISO);
  const bookedCount = slots[selectedSlot] || 0;

  if (bookedCount >= TABLE_CAPACITY) {
    formStatus.textContent = 'That seating just filled up — please choose another.';
    loadSlots();
    return;
  }

  // 1. mark one more table as booked for that time
  slots[selectedSlot] = bookedCount + 1;
  saveSlotsForDate(dateISO, slots);

  // 2. build the reservation record
  const reservation = {
    id: Date.now(),
    code: makeReservationCode(),
    date: dateISO,
    time: selectedSlot,
    party: party,
    name: document.getElementById('guestName').value.trim(),
    notes: document.getElementById('guestNotes').value.trim()
  };

  // 3. save it to "my reservations"
  const mine = getMyReservations();
  mine.unshift(reservation);
  saveMyReservations(mine);

  showConfirmation(reservation);
  resForm.reset();
  party = 2; renderParty();
  loadSlots();
  renderReservationList(mine);
});

// ============================================================
// CONFIRMATION POP-UP
// ============================================================

const modalOverlay = document.getElementById('modalOverlay');

function showConfirmation(r) {
  const [hour, min] = r.time.split(':').map(Number);
  document.getElementById('modalCode').textContent = r.code;
  document.getElementById('modalDetails').innerHTML =
    '<div><span>Date</span><b>' + formatDateLong(r.date) + '</b></div>' +
    '<div><span>Time</span><b>' + formatTime12(hour, min) + '</b></div>' +
    '<div><span>Party</span><b>' + r.party + ' guests</b></div>' +
    '<div><span>Name</span><b>' + r.name + '</b></div>';
  modalOverlay.classList.add('open');
}

document.getElementById('modalCloseBtn').addEventListener('click', () => {
  modalOverlay.classList.remove('open');
});
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('open');
});

// ============================================================
// "MY RESERVATIONS" SIDE PANEL
// ============================================================

const sidePanel = document.getElementById('sidePanel');
const panelOverlay = document.getElementById('panelOverlay');
const panelBody = document.getElementById('panelBody');

document.getElementById('openPanelBtn').addEventListener('click', () => {
  sidePanel.classList.add('open');
  panelOverlay.classList.add('open');
  renderReservationList(getMyReservations());
});

document.getElementById('panelCloseBtn').addEventListener('click', closePanel);
panelOverlay.addEventListener('click', closePanel);

function closePanel() {
  sidePanel.classList.remove('open');
  panelOverlay.classList.remove('open');
}

function renderReservationList(mine) {
  if (mine.length === 0) {
    panelBody.innerHTML = '<div class="panel-empty">No reservations yet.<br>Book a table and it will show up here.</div>';
    return;
  }

  panelBody.innerHTML = '';
  mine.forEach(r => {
    const [hour, min] = r.time.split(':').map(Number);

    const item = document.createElement('div');
    item.className = 'res-item';
    item.innerHTML =
      '<div class="res-item-top"><span>' + r.name + '</span><span class="code">' + r.code + '</span></div>' +
      '<div class="res-item-when">' + formatDateLong(r.date) + ' · ' + formatTime12(hour, min) + '</div>' +
      '<div class="res-item-meta">Party of ' + r.party + (r.notes ? ' · ' + r.notes : '') + '</div>';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'res-cancel';
    cancelBtn.textContent = 'Cancel reservation';
    cancelBtn.addEventListener('click', () => cancelReservation(r));
    item.appendChild(cancelBtn);

    panelBody.appendChild(item);
  });
}

function cancelReservation(r) {
  // remove it from "my reservations"
  const mine = getMyReservations().filter(x => x.id !== r.id);
  saveMyReservations(mine);

  // free up the table slot
  const slots = getSlotsForDate(r.date);
  if (slots[r.time]) {
    slots[r.time] = Math.max(0, slots[r.time] - 1);
    saveSlotsForDate(r.date, slots);
  }

  renderReservationList(mine);
  showToast('Reservation ' + r.code + ' cancelled.');
  if (dateInput.value === r.date) loadSlots();
}

// ============================================================
// MOBILE NAV MENU
// ============================================================

document.getElementById('navToggle').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

// ============================================================
// START
// ============================================================
renderParty();
loadSlots();