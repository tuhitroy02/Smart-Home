/* enhanced script.js
   All features: modal schedule/add device, dark mode, charts, voice control,
   notifications, room filtering, avatar upload, device animations.
*/
(function(){
  const KEYS = {
    DEVICES: "smarthome_devices_v2",
    LOGS: "smarthome_logs_v2",
    SCHEDULES: "smarthome_schedules_v2",
    USER: "smarthome_user_v2",
    THEME: "smarthome_theme_v2"
  };

  // small helpers
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const now = () => new Date().toISOString().replace("T"," ").split(".")[0];

  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  function load(key, fallback){ const v=localStorage.getItem(key); if(!v) return fallback; try{return JSON.parse(v);}catch{return fallback;}}

  // notification queue
  const notifyQueue = [];
  function pushNotify(text){
    notifyQueue.unshift({t: now(), text});
    renderNotifs();
    addLog("Notification", text);
  }
  function renderNotifs(){
    const dd = $("#notify-dropdown");
    const count = $("#notify-count");
    if(!dd) return;
    const q = notifyQueue.slice(0,50);
    dd.innerHTML = q.length ? q.map(n => `<div class="notify-item"><strong>${n.t}</strong><div>${n.text}</div></div>`).join("") : `<div class="notify-item">No notifications</div>`;
    if(count) {
      if(q.length) { count.classList.remove("hidden"); count.textContent = q.length; }
      else { count.classList.add("hidden"); }
    }
  }

  // generic logging
  function addLog(device, action){
    const logs = load(KEYS.LOGS, []);
    logs.unshift({time: now(), device, action, user: "Owner"});
    save(KEYS.LOGS, logs);
    if(document.querySelector(".log-table tbody")) renderLogsTable();
  }

  // render logs table
  function renderLogsTable(){
    const tbody = document.querySelector(".log-table tbody");
    if(!tbody) return;
    const logs=load(KEYS.LOGS, []);
    tbody.innerHTML = logs.map(l => `<tr><td>${l.time}</td><td>${l.device}</td><td>${l.action}</td><td>${l.user}</td></tr>`).join("");
  }

  // devices
  function getDevices(){ return load(KEYS.DEVICES, defaultDevices()); }
  function saveDevices(devs){ save(KEYS.DEVICES, devs); }
  function defaultDevices(){
    // provide a couple of sample devices if none present
    return {
      living_room_light: { id:"living_room_light", name:"Living Room Light", type:"Light", room:"living", on:true, lastSeen: "Last seen 2m" },
      thermostat_hall: { id:"thermostat_hall", name:"Thermostat • Hall", type:"Thermostat", room:"hall", on:false, temp:22, lastSeen:"Last seen 10m" },
      front_door_lock: { id:"front_door_lock", name:"Front Door Lock", type:"Lock", room:"living", on:false, lastSeen:"Last seen 1m" }
    };
  }

  // populate device selects for schedule modal
  function fillDeviceSelects(){
    const devs = Object.values(getDevices());
    const sel = $("#schedule-device");
    if(!sel) return;
    sel.innerHTML = devs.map(d => `<option value="${d.id}">${d.name}</option>`).join("");
  }

  // Inject dynamic device cards (optional) - we keep static html cards but update states
  function applyDeviceStates(){
    const stored = getDevices();
    $$(".device-card").forEach(card => {
      const id = card.dataset.deviceId;
      if(!id || !stored[id]) return;
      const s = stored[id];
      const checkbox = card.querySelector('input[type="checkbox"]');
      const statusImg = card.querySelector('.status-img');
      const infoDiv = card.querySelector('.device-info div');
      const last = card.querySelector('.device-info .small-muted');
      if(checkbox) checkbox.checked = !!s.on;
      if(statusImg) statusImg.src = s.on ? "https://cdn-icons-png.flaticon.com/512/190/190411.png" : "https://cdn-icons-png.flaticon.com/512/463/463612.png";
      if(s.on) card.classList.add("on"); else card.classList.remove("on");
      if(infoDiv){
        if(/Power:/i.test(infoDiv.textContent)) infoDiv.innerHTML = `Power: <strong>${s.on ? "On" : "Off"}</strong>`;
        if(/State:/i.test(infoDiv.textContent)) infoDiv.innerHTML = `State: <strong>${s.on ? "Unlocked" : "Locked"}</strong>`;
      }
      if(last) last.textContent = s.lastSeen || `Last seen ${now()}`;
      // camera recording effect
      if(s.type && s.type.toLowerCase()==="camera" && s.on){
        const photo = card.querySelector('.device-photo');
        if(photo) photo.classList.add("camera-recording");
      }
    });
  }

  // attach device toggle handlers
  function attachDeviceHandlers(){
    const stored = getDevices();
    $$(".device-card").forEach(card => {
      const id = card.dataset.deviceId;
      if(!id) return;
      const checkbox = card.querySelector('input[type="checkbox"]');
      const statusImg = card.querySelector('.status-img');
      const infoDiv = card.querySelector('.device-info div');
      const last = card.querySelector('.device-info .small-muted');
      const deviceName = card.querySelector("h3")?.textContent || id;
      if(!checkbox) return;
      checkbox.addEventListener("change", () => {
        const isOn = checkbox.checked;
        stored[id] = stored[id] || { id, name: deviceName, type: "" };
        stored[id].on = isOn;
        stored[id].lastSeen = "Last seen " + now();
        saveDevices(stored);
        if(statusImg) statusImg.src = isOn ? "https://cdn-icons-png.flaticon.com/512/190/190411.png" : "https://cdn-icons-png.flaticon.com/512/463/463612.png";
        if(infoDiv){
          if(/Power:/i.test(infoDiv.textContent)) infoDiv.innerHTML = `Power: <strong>${isOn ? "On" : "Off"}</strong>`;
          if(/State:/i.test(infoDiv.textContent)) infoDiv.innerHTML = `State: <strong>${isOn ? "Unlocked" : "Locked"}</strong>`;
        }
        if(isOn) {
          card.classList.add("on");
          pushNotify(`${deviceName} turned on`);
        } else {
          card.classList.remove("on");
          pushNotify(`${deviceName} turned off`);
        }
        // animation (brief pulse)
        card.animate([{ transform:"scale(1)" }, { transform:"scale(1.02)" }, { transform:"scale(1)" }], {duration:220, easing:"ease-out"});
        addLog(deviceName, isOn ? "Turned On" : "Turned Off");
      });
    });
  }

  // Schedules
  function getSchedules(){ return load(KEYS.SCHEDULES, []); }
  function saveSchedules(s){ save(KEYS.SCHEDULES, s); }
  function renderSchedules(){
    const lists = $$(".panel .compact-list");
    if(!lists.length) return;
    const schedules = getSchedules();
    // place in first .compact-list
    const list = lists[0];
    list.innerHTML = schedules.map(s => `<li><img class="small-inline" src="https://cdn.jsdelivr.net/npm/feather-icons/dist/icons/clock.svg"> ${s.time} — ${s.action}</li>`).join("");
  }

  // Modal helpers
  function openModal(id){ const m = $(id); if(!m) return; m.classList.remove("hidden"); m.setAttribute("aria-hidden","false"); }
  function closeModal(el){
    const parent = el.closest(".modal");
    if(parent) { parent.classList.add("hidden"); parent.setAttribute("aria-hidden","true"); }
  }
  function attachModalCloseButtons(){
    $$('[data-close]').forEach(btn => btn.addEventListener("click", e => closeModal(btn)));
    // close on background click
    $$(".modal").forEach(mod => {
      mod.addEventListener("click", (e) => {
        if(e.target === mod) mod.classList.add("hidden");
      });
    });
  }

  // Add Device form
  function initAddDeviceForm(){
    const form = $("#form-add-device");
    const openBtn = $("#open-add-device");
    if(openBtn) openBtn.addEventListener("click", e => { e.preventDefault(); openModal("#modal-add-device"); });
    if(!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get("name").trim();
      const type = data.get("type");
      const room = data.get("room");
      if(!name) { alert("Provide a device name"); return; }
      const devs = getDevices();
      const id = name.toLowerCase().replace(/\s+/g,"_");
      devs[id] = { id, name, type, room, on:false, lastSeen: "Last seen " + now() };
      saveDevices(devs);
      pushNotify(`Device added: ${name}`);
      addLog("Device", `Added ${name}`);
      closeModal(form);
      // re-render selects and states
      fillDeviceSelects();
      applyDeviceStates();
      attachDeviceHandlers();
      renderDevicesDomIfNeeded(); // optional function defined below
      form.reset();
    });
  }

  // Add Schedule form
  function initScheduleForm(){
    const openScheduleBtns = $$(".btn-primary").filter(b => b.textContent && /New Schedule|New Schedule/i.test(b.textContent));
    openScheduleBtns.forEach(b => b.addEventListener("click", e => { e.preventDefault(); fillDeviceSelects(); openModal("#modal-schedule"); }));
    const form = $("#form-schedule");
    if(!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const time = fd.get("time").trim();
      const deviceId = fd.get("device");
      const action = fd.get("action");
      if(!time || !deviceId || !action) { alert("Fill all fields"); return; }
      const devs = getDevices();
      const deviceName = devs[deviceId] ? devs[deviceId].name : deviceId;
      const schedules = getSchedules();
      schedules.unshift({ time, deviceId, action, actionLabel: action.replace("_"," ").toUpperCase(), created: now() });
      saveSchedules(schedules);
      pushNotify(`Created schedule: ${time} — ${deviceName} — ${actionLabelFrom(action)}`);
      addLog("Schedule", `Created: ${time} — ${deviceName} — ${actionLabelFrom(action)}`);
      renderSchedules();
      closeModal(form);
      form.reset();
    });
  }

  function actionLabelFrom(a){
    if(a === "turn_on") return "TURN ON";
    if(a === "turn_off") return "TURN OFF";
    if(a === "lock") return "LOCK";
    if(a === "unlock") return "UNLOCK";
    return a.toUpperCase();
  }

  // CSV Export handler (improved)
  function initCSVExport(){
    const btn = document.querySelector('.app-header .btn-ghost');
    if(!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const logs = load(KEYS.LOGS, []);
      if(!logs.length){ alert("No logs to export"); return; }
      const csv = ["Time,Device,Action,User", ...logs.map(l => `"${l.time}","${l.device}","${l.action}","${l.user}"`)].join("\n");
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `smarthome_logs_${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,"")}.csv`; a.click(); URL.revokeObjectURL(url);
    });
  }

  // Chart (energy usage) - dynamic load Chart.js and render a small line chart
  let energyChart = null;
  function loadChartJsAndRender(){
    if(typeof Chart === "undefined"){
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = renderEnergyChart;
      document.head.appendChild(s);
    } else renderEnergyChart();
  }
  function renderEnergyChart(){
    const ctx = $("#energyChart");
    if(!ctx) return;
    // synthetic sample data: last 7 days
    const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const data = { labels, datasets: [{ label:"kWh/day", data: [2.1,2.6,2.3,2.8,3.0,2.4,2.7], fill:true, tension:0.3, backgroundColor: "rgba(99,102,241,0.08)", borderColor:"#6366F1" }]};
    if(energyChart) { energyChart.data = data; energyChart.update(); return; }
    energyChart = new Chart(ctx, { type:"line", data, options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}});
  }

  // Voice Control - Web Speech API
  function initVoice(){
    if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Speech();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;

    // simple voice button
    const voiceBtn = document.createElement("button");
    voiceBtn.className = "btn-ghost";
    voiceBtn.style.marginLeft = "8px";
    voiceBtn.textContent = "Voice";
    voiceBtn.title = "Click and say a command: 'Turn on living room light'";
    const headerActions = document.querySelector(".header-actions");
    if(headerActions) headerActions.appendChild(voiceBtn);

    voiceBtn.addEventListener("click", () => {
      rec.start();
      pushNotify("Listening for voice command...");
    });

    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript.toLowerCase();
      pushNotify(`Voice recognized: ${text}`);
      interpretVoice(text);
    };
    rec.onerror = (e) => pushNotify("Voice error: " + (e.error || "unknown"));
  }

  function interpretVoice(text){
    // simplistic matching: find device and action
    const devs = getDevices();
    const names = Object.values(devs).map(d => ({id:d.id, name:d.name.toLowerCase()}));
    let found = null;
    for(const n of names) if(text.includes(n.name)) { found = n; break; }
    if(!found){
      pushNotify("Device not found in voice command.");
      return;
    }
    const id = found.id;
    // actions
    if(/turn on|switch on|on the/i.test(text)){
      toggleDeviceId(id, true);
    } else if(/turn off|switch off|off the/i.test(text)){
      toggleDeviceId(id, false);
    } else if(/lock/i.test(text)){
      toggleDeviceLock(id, true);
    } else if(/unlock/i.test(text)){
      toggleDeviceLock(id, false);
    } else {
      pushNotify("Could not parse voice action.");
    }
  }

  function toggleDeviceId(id, state){
    const devs = getDevices();
    if(!devs[id]) { pushNotify("Device not found"); return; }
    devs[id].on = state;
    devs[id].lastSeen = "Last seen " + now();
    saveDevices(devs);
    addLog(devs[id].name, state ? "Turned On (voice)" : "Turned Off (voice)");
    pushNotify(`${devs[id].name} ${state ? "turned on" : "turned off"} (voice)`);
    applyDeviceStates();
  }
  function toggleDeviceLock(id, locked){
    const devs = getDevices();
    if(!devs[id]) { pushNotify("Lock device not found"); return; }
    devs[id].on = !locked; // roughly reflect
    devs[id].lastSeen = "Last seen " + now();
    saveDevices(devs);
    addLog(devs[id].name, locked ? "Locked (voice)" : "Unlocked (voice)");
    pushNotify(`${devs[id].name} ${locked ? "locked" : "unlocked"} (voice)`);
    applyDeviceStates();
  }

  // Profile avatar upload
  function initProfile(){
    const form = $("#form-profile");
    if(!form) return;
    const avatarInput = $("#avatarInput");
    const user = load(KEYS.USER, {name:"Home Owner", email:"you@example.com", avatar:null});
    // load into form
    form.name.value = user.name || "";
    form.email.value = user.email || "";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get("name") || "Home Owner";
      const email = fd.get("email") || "you@example.com";
      const file = avatarInput.files && avatarInput.files[0];
      if(file){
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result;
          save(KEYS.USER, {name, email, avatar: base64});
          pushNotify("Profile saved (avatar uploaded)");
          applyProfile();
          closeModal(form);
        };
        reader.readAsDataURL(file);
      } else {
        save(KEYS.USER, {name, email, avatar: user.avatar});
        pushNotify("Profile saved");
        applyProfile();
        closeModal(form);
      }
    });
    applyProfile();
  }
  function applyProfile(){
    const user = load(KEYS.USER, {name:"Home Owner", email:"you@example.com", avatar:null});
    const avatarEls = $$(".avatar-img");
    avatarEls.forEach(a => { if(user.avatar) a.src = user.avatar; });
    const nameEls = $$(".name");
    nameEls.forEach(n => { if(n) n.textContent = user.name || "Home Owner"; });
  }

  // Dark mode
  function initTheme(){
    const btn = $("#dark-toggle");
    const stored = localStorage.getItem(KEYS.THEME) || "light";
    applyTheme(stored);
    if(btn) btn.addEventListener("click", () => { const t = (document.documentElement.dataset.theme === "dark") ? "light" : "dark"; applyTheme(t); localStorage.setItem(KEYS.THEME, t); });
  }
  function applyTheme(t){
    if(t === "dark") { document.documentElement.dataset.theme = "dark"; document.body.dataset.theme = "dark"; $("#dark-toggle")?.setAttribute("aria-pressed","true"); }
    else { delete document.documentElement.dataset.theme; delete document.body.dataset.theme; $("#dark-toggle")?.setAttribute("aria-pressed","false"); }
  }

  // Room filter
  function initRoomFilter(){
    const sel = $("#room-filter");
    if(!sel) return;
    sel.addEventListener("change", () => {
      const val = sel.value;
      $$(".device-card").forEach(card => {
        const id = card.dataset.deviceId;
        const dev = getDevices()[id];
        if(!dev) { card.style.display = ""; return; }
        if(!val || dev.room === val) card.style.display = ""; else card.style.display = "none";
      });
    });
  }

  // optionally render devices DOM if you want to create cards dynamically (kept minimal)
  function renderDevicesDomIfNeeded(){
    // Not strictly necessary — we updated device states in existing static cards.
  }

  // notifications dropdown toggle
  function initNotifUI(){
    const btn = $("#notify-btn");
    const dd = $("#notify-dropdown");
    if(!btn || !dd) return;
    btn.addEventListener("click", (e) => { e.preventDefault(); dd.classList.toggle("hidden"); btn.setAttribute("aria-expanded", String(!dd.classList.contains("hidden"))); });
    // click outside to close
    document.addEventListener("click",(e)=> {
      if(!e.target.closest(".notify-wrap")) dd.classList.add("hidden");
    });
  }

  // init on DOM
  function init(){
    // initial data
    if(!localStorage.getItem(KEYS.DEVICES)) saveDevices(defaultDevices());
    fillDeviceSelects();
    applyDeviceStates();
    attachDeviceHandlers();
    attachModalCloseButtons();
    initAddDeviceForm();
    initScheduleForm();
    initCSVExport();
    renderLogsTable();
    renderSchedules();
    initNotifUI();
    loadChartJsAndRender();
    initVoice();
    initProfile();
    initTheme();
    initRoomFilter();
    renderNotifs();
    // small keyboard shortcut: press "n" to open notifs
    document.addEventListener("keydown",(e)=>{ if(e.key==="n") $("#notify-dropdown")?.classList.toggle("hidden"); });
    // progressive enhancements
    pushNotify("Welcome back — UI enhanced");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
