
/* ==========================================
   SMARTPARK - SUPABASE CONFIGURATION
========================================== */

// Replace these two values with your existing
// Supabase Project URL and Publishable/Anon key.

const SUPABASE_URL = "https://qvkarwxqtogfdxdkkxbo.supabase.co";

const SUPABASE_KEY = "sb_publishable_OXBJUx_RkbKeqn7gIqGVMw_VAwJ-kc1";


const EXPECTED_SLOTS = ["P1", "P2", "P3", "P4", "P5", "EV1"];

let supabaseClient = null;
let parkingData = [];
let activityData = [];
let realtimeChannel = null;
let realtimeStarted = false;


/* ==========================================
   PRELOADER - EXACTLY 12 SECONDS
========================================== */

const PRELOADER_DURATION = 12000;

let loaderStartTime = Date.now();

const preloader = document.getElementById("preloader");
const loaderStatus = document.getElementById("loaderStatus");
const loaderCountdown = document.getElementById("loaderCountdown");

function hidePreloader() {

    if (!preloader) return;

    preloader.classList.add("hide");

    if (loaderCountdown) {
        loaderCountdown.textContent = "Dashboard opened";
    }
}

// Start timer immediately.
// This does NOT wait for Supabase.

const countdownTimer = setInterval(() => {

    const elapsed = Date.now() - loaderStartTime;

    const remaining = Math.max(
        0,
        Math.ceil((PRELOADER_DURATION - elapsed) / 1000)
    );

    if (loaderCountdown) {
        loaderCountdown.textContent =
            remaining > 0 ? `${remaining} seconds` : "Opening dashboard...";
    }

    if (remaining <= 0) {

        clearInterval(countdownTimer);

        hidePreloader();

    }

}, 250);


// Safety fallback: hide the preloader after 12 seconds
// even if another part of the application fails.

setTimeout(() => {

    hidePreloader();

}, PRELOADER_DURATION);


/* ==========================================
   INITIALIZE SUPABASE
========================================== */

function initializeSupabase() {

    try {

        if (!window.supabase) {
            throw new Error("Supabase library did not load. Check your internet connection.");
        }

        if (
            SUPABASE_URL.includes("YOUR_SUPABASE") ||
            SUPABASE_KEY.includes("YOUR_SUPABASE")
        ) {
            throw new Error("Please enter your Supabase Project URL and public key in script.js.");
        }

        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        return true;

    } catch (error) {

        console.error("Supabase initialization error:", error);

        updateConnectionStatus(false);

        showDatabaseMessage(error.message);

        return false;

    }
}


/* ==========================================
   DATE AND TIME
========================================== */

function updateDate() {

    document.getElementById("currentDate").textContent =
        new Date().toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        });

}


/* ==========================================
   CONNECTION STATUS
========================================== */

function updateConnectionStatus(connected) {

    const dot = document.getElementById("connectionDot");
    const text = document.getElementById("connectionText");

    if (connected) {

        dot.className = "connection-dot connected";
        text.textContent = "Connected";

    } else {

        dot.className = "connection-dot disconnected";
        text.textContent = "Disconnected";

    }

}


/* ==========================================
   DATABASE ERROR MESSAGE
========================================== */

function showDatabaseMessage(message) {

    const safeMessage = escapeHTML(message);

    parkingGrid.innerHTML = `
        <div class="empty-state">
            <strong>Database connection unavailable</strong>
            <br><br>
            ${safeMessage}
            <br><br>
            Your dashboard is still available.
            Check your Supabase credentials and connection.
        </div>
    `;

}


/* ==========================================
   NORMALIZE PARKING STATUS
========================================== */

function getSlotStatus(slot) {

    if (!slot || !slot.status) {
        return "unknown";
    }

    const status = String(slot.status).toLowerCase().trim();

    if (["available", "vacant", "free"].includes(status)) {
        return "available";
    }

    if (["occupied", "booked", "reserved"].includes(status)) {
        return "occupied";
    }

    return "unknown";

}


/* ==========================================
   LOAD PARKING DATA
========================================== */

async function loadParkingData() {

    if (!supabaseClient) {
        return false;
    }

    try {

        const { data, error } = await supabaseClient
            .from("parking_slots")
            .select("slot_id, slot_type, status, distance_cm, updated_at, last_updated");

        if (error) {
            throw error;
        }

        const receivedSlots = data || [];

        parkingData = EXPECTED_SLOTS.map(slotId => {

            return receivedSlots.find(
                slot => slot.slot_id === slotId
            ) || {
                slot_id: slotId,
                slot_type: slotId === "EV1" ? "electric" : "regular",
                status: null,
                distance_cm: null,
                updated_at: null,
                last_updated: null
            };

        });

        // Initialize activity from existing database records.
        activityData = [];

        parkingData.forEach(slot => {

            if (slot.status !== null) {
                addActivity(slot);
            }

        });

        updateDashboard();

        updateConnectionStatus(true);

        return true;

    } catch (error) {

        console.error("Database loading error:", error);

        updateConnectionStatus(false);

        showDatabaseMessage(error.message);

        return false;

    }

}


/* ==========================================
   UPDATE COMPLETE DASHBOARD
========================================== */

function updateDashboard() {

    renderParkingSlots();

    updateStatistics();

    updateAnalytics();

    renderActivity();

}


/* ==========================================
   PARKING SLOT CARDS
========================================== */

function renderParkingSlots() {

    parkingGrid.innerHTML = "";

    parkingData.forEach(slot => {

        const status = getSlotStatus(slot);

        const isEV = slot.slot_id === "EV1";

        const badgeText = {
            available: "Available",
            occupied: "Occupied",
            unknown: "Unknown"
        }[status];

        const icon = isEV
            ? "⚡"
            : status === "occupied"
                ? "🚗"
                : "🅿️";

        const distance =
            slot.distance_cm !== null &&
            slot.distance_cm !== undefined &&
            slot.distance_cm !== ""
                ? `${slot.distance_cm} cm`
                : "Not available";

        const card = document.createElement("div");

        card.className = "parking-card";

        card.innerHTML = `

            <div class="parking-card-top">

                <div>

                    <div class="slot-number">
                        ${escapeHTML(slot.slot_id)}
                    </div>

                    <div class="slot-type">
                        ${isEV ? "Electric Vehicle Parking" : "Regular Parking"}
                    </div>

                </div>

                <span class="status-badge ${status}">
                    ${badgeText}
                </span>

            </div>

            <div class="car-illustration">
                ${icon}
            </div>

            <div class="parking-card-bottom">

                <div>
                    <span>Sensor Distance</span>
                    <br>
                    <strong>${escapeHTML(distance)}</strong>
                </div>

                <div>
                    <span>Slot Type</span>
                    <br>
                    <strong>${isEV ? "EV" : "Regular"}</strong>
                </div>

            </div>

        `;

        parkingGrid.appendChild(card);

    });

}


/* ==========================================
   STATISTICS
========================================== */

function updateStatistics() {

    const available = parkingData.filter(
        slot => getSlotStatus(slot) === "available"
    ).length;

    const occupied = parkingData.filter(
        slot => getSlotStatus(slot) === "occupied"
    ).length;

    const evSlot = parkingData.find(
        slot => slot.slot_id === "EV1"
    );

    const evStatus = evSlot
        ? getSlotStatus(evSlot)
        : "unknown";

    document.getElementById("totalSlots").textContent =
        EXPECTED_SLOTS.length;

    document.getElementById("availableSlots").textContent =
        available;

    document.getElementById("occupiedSlots").textContent =
        occupied;

    document.getElementById("evStatus").textContent =
        evStatus === "available"
            ? "Free"
            : evStatus === "occupied"
                ? "Occupied"
                : "Unknown";

}


/* ==========================================
   ANALYTICS
========================================== */

function updateAnalytics() {

    const available = parkingData.filter(
        slot => getSlotStatus(slot) === "available"
    ).length;

    const occupied = parkingData.filter(
        slot => getSlotStatus(slot) === "occupied"
    ).length;

    const unknown = parkingData.length - available - occupied;

    const total = parkingData.length;

    const percentage = total
        ? Math.round((occupied / total) * 100)
        : 0;

    const occupiedDegrees = total
        ? (occupied / total) * 360
        : 0;

    const availableDegrees = total
        ? (available / total) * 360
        : 0;

    const donut = document.getElementById("occupancyDonut");

    donut.style.background = `
        conic-gradient(
            #e7a17d 0deg ${occupiedDegrees}deg,
            #69bb91 ${occupiedDegrees}deg ${occupiedDegrees + availableDegrees}deg,
            #aeb8c8 ${occupiedDegrees + availableDegrees}deg 360deg
        )
    `;

    document.getElementById("occupancyPercentage").textContent =
        percentage + "%";

    document.getElementById("chartAvailable").textContent =
        available;

    document.getElementById("chartOccupied").textContent =
        occupied;

    document.getElementById("chartUnknown").textContent =
        unknown;

}


/* ==========================================
   RECENT ACTIVITY
========================================== */

function addActivity(slot) {

    const activity = {
        slot_id: slot.slot_id,
        status: getSlotStatus(slot),
        distance_cm: slot.distance_cm,
        updated_at: slot.updated_at ||
            slot.last_updated ||
            new Date().toISOString()
    };

    activityData = [
        activity,
        ...activityData.filter(
            item => item.slot_id !== slot.slot_id
        )
    ].slice(0, 6);

}


function renderActivity() {

    activityList.innerHTML = "";

    if (activityData.length === 0) {

        activityList.innerHTML = `
            <div class="empty-state">
                No parking updates received yet.
            </div>
        `;

        return;

    }

    activityData.forEach(item => {

        const row = document.createElement("div");

        row.className = "activity-row";

        const distance =
            item.distance_cm !== null &&
            item.distance_cm !== undefined
                ? `${item.distance_cm} cm`
                : "N/A";

        const time = item.updated_at
            ? new Date(item.updated_at).toLocaleString("en-IN")
            : "N/A";

        row.innerHTML = `

            <strong>${escapeHTML(item.slot_id)}</strong>

            <span class="status-badge ${item.status}">
                ${item.status}
            </span>

            <span>${escapeHTML(distance)}</span>

            <span>${escapeHTML(time)}</span>

        `;

        activityList.appendChild(row);

    });

}


/* ==========================================
   SUPABASE REALTIME
========================================== */

function subscribeToRealtime() {

    if (!supabaseClient || realtimeStarted) {
        return;
    }

    realtimeStarted = true;

    realtimeChannel = supabaseClient

        .channel("smartpark-live-updates")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "parking_slots"
            },

            (payload) => {

                console.log("Realtime update:", payload);

                if (payload.eventType === "DELETE") {

                    parkingData = parkingData.filter(
                        slot => slot.slot_id !== payload.old.slot_id
                    );

                } else {

                    const updatedSlot = payload.new;

                    if (!EXPECTED_SLOTS.includes(updatedSlot.slot_id)) {
                        return;
                    }

                    const index = parkingData.findIndex(
                        slot => slot.slot_id === updatedSlot.slot_id
                    );

                    if (index !== -1) {

                        parkingData[index] = updatedSlot;

                    } else {

                        parkingData.push(updatedSlot);

                    }

                    addActivity(updatedSlot);

                }

                updateDashboard();

            }
        )

        .subscribe((status) => {

            console.log("Supabase Realtime:", status);

            if (status === "SUBSCRIBED") {

                updateConnectionStatus(true);

            } else if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
            ) {

                updateConnectionStatus(false);

            }

        });

}


/* ==========================================
   SAFE HTML TEXT
========================================== */

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];

    });

}


/* ==========================================
   REFRESH BUTTON
========================================== */

document.getElementById("refreshButton")
    .addEventListener("click", async () => {

        const button = document.getElementById("refreshButton");

        button.disabled = true;
        button.textContent = "Refreshing...";

        await loadParkingData();

        button.disabled = false;
        button.textContent = "↻ Refresh";

    });


/* ==========================================
   NAVIGATION
========================================== */

document.querySelectorAll(".nav-link").forEach(link => {

    link.addEventListener("click", () => {

        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");

    });

});


/* ==========================================
   START DASHBOARD
========================================== */

async function initializeDashboard() {

    updateDate();

    // Initialize Supabase without blocking the page.
    const connected = initializeSupabase();

    if (!connected) {
        return;
    }

    // Load database data.
    // The independent 12-second timer continues running.
    await loadParkingData();

    // Start live updates even if initial data loading failed.
    subscribeToRealtime();

}


// Start the dashboard application.
initializeDashboard();
