(function(){
"use strict";

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
const CATEGORY_BADGE = {
  "รอดำเนินการ": {cls:"badge-pending", color:"var(--red)", label:"ยังไม่เริ่มดำเนินการ"},
  "พื้นบ่อ": {cls:"badge-complete", color:"var(--green)", label:"งานพื้นบ่อ"},
  "จมบ่อพัก": {cls:"badge-caisson", color:"var(--steel)", label:"งานจมบ่อพัก"},
  "โครงสร้างกันดิน": {cls:"badge-progress", color:"var(--amber)", label:"โครงสร้างกันดิน"},
  "สำรวจ": {cls:"badge-early", color:"var(--ink-faint)", label:"สำรวจ"},
  "เตรียมการ": {cls:"badge-early", color:"var(--ink-faint)", label:"เตรียมการ"},
  "ปรับแต่ง": {cls:"badge-early", color:"var(--ink-faint)", label:"ปรับแต่ง"},
};
function categoryBadge(stage){
  return CATEGORY_BADGE[stage] || {cls:"badge-none", color:"var(--grey)", label:stage};
}

const STAGE_PENDING_WORDS  = ["รอดำเนินการ","ยังไม่ดำเนินการ","ยังไม่มีรายงานเริ่มงาน","ยังไม่เริ่ม"];
const STAGE_COMPLETE_WORDS = ["เสร็จ","ครบ"];
const STAGE_PROGRESS_WORDS = ["Guide Wall","จมบ่อพัก","ผูกเหล็ก","Sheet Pile","เทคอนกรีต","ปัก Sheet"];
const STAGE_EARLY_WORDS    = ["Test Pit","กำหนดตำแหน่ง","สำรวจ","ตัด Joint","ตัด joint","สกัด","เตรียมงาน","เติมยาง"];

function classify(text){
  if(!text) return "none";
  if(STAGE_PENDING_WORDS.some(w=>text.includes(w))) return "pending";
  if(STAGE_COMPLETE_WORDS.some(w=>text.includes(w))) return "complete";
  if(STAGE_PROGRESS_WORDS.some(w=>text.includes(w))) return "progress";
  if(STAGE_EARLY_WORDS.some(w=>text.includes(w))) return "early";
  return "early";
}

function stageColor(stage){
  return {complete:"var(--green)", progress:"var(--amber)", early:"var(--steel-soft)", pending:"var(--red)", none:"var(--grey)"}[stage];
}
function stageBadgeClass(stage){
  return {complete:"badge-complete", progress:"badge-progress", early:"badge-early", pending:"badge-pending", none:"badge-none"}[stage];
}
function stageLabel(stage){
  return {complete:"แล้วเสร็จ", progress:"กำลังดำเนินการ", early:"เตรียมการ/สำรวจ", pending:"ยังไม่เริ่มดำเนินการ", none:"ยังไม่มีข้อมูล"}[stage];
}

function wellBaseNum(w){
  const m = w.match(/^MH\.(\d+)/);
  return m ? parseInt(m[1],10) : null;
}

function recordsForWell(baseName){
  // baseName e.g. "MH.9" -> match MH.9 and MH.9/x
  const num = wellBaseNum(baseName);
  return DATA.daily.filter(r => r.wells.some(w => wellBaseNum(w) === num));
}

function curatedStageFor(baseName){
  const items = DATA.curated[baseName];
  if(!items || !items.length) return null;
  const last = items[items.length-1];
  return classify(last.stage + " " + last.text);
}

function autoStageFor(baseName){
  const recs = recordsForWell(baseName);
  if(!recs.length) return "none";
  const last = recs[recs.length-1];
  return classify(last.text);
}

function wellStatus(baseName){
  if(DATA.wellStatus && DATA.wellStatus[baseName]) return DATA.wellStatus[baseName];
  return DATA.curated[baseName] ? curatedStageFor(baseName) : autoStageFor(baseName);
}

/* ---------------------------------------------------------
   Tabs
--------------------------------------------------------- */
function initTabs(){
  const btns = document.querySelectorAll(".tab-btn");
  btns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      btns.forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-selected","false"); });
      btn.classList.add("active"); btn.setAttribute("aria-selected","true");
      document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
      document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
    });
  });
}

window.goToWellsTab = function(wellName){
  document.querySelector('.tab-btn[data-tab="wells"]').click();
  selectWell(wellName);
};

/* ---------------------------------------------------------
   Hero meta
--------------------------------------------------------- */
function renderHeroMeta(){
  document.getElementById("lastConfirmed").textContent = DATA.meta.lastConfirmed;
}

/* ---------------------------------------------------------
   Alignment strip (signature visual)
--------------------------------------------------------- */
function renderAlignmentStrip(){
  const svg = document.getElementById("alignmentSvg");
  const wells = [];
  for(let n=1;n<=27;n++) wells.push("MH."+n);

  const W = 1200, H = 190, padX = 40, y = 90;
  const step = (W - padX*2) / (wells.length - 1);

  let html = "";
  // base line
  html += `<line x1="${padX}" y1="${y}" x2="${W-padX}" y2="${y}" stroke="var(--border)" stroke-width="3"/>`;
  html += `<text x="${padX}" y="${y-28}" font-family="IBM Plex Mono" font-size="11" fill="var(--ink-faint)">ต้นโครงการ (วัดชัยมงคล)</text>`;
  html += `<text x="${W-padX}" y="${y-28}" text-anchor="end" font-family="IBM Plex Mono" font-size="11" fill="var(--ink-faint)">ปลายโครงการ (ซอยเทศบาลบางปู 49)</text>`;

  wells.forEach((w,i)=>{
    const cx = padX + step*i;
    const stage = wellStatus(w);
    const color = stageColor(stage);
    const featured = !!DATA.curated[w];
    const r = featured ? 9 : 6;
    const labelY = (i % 2 === 0) ? y - 20 : y + 34;
    const lineY2 = (i % 2 === 0) ? y - 12 : y + 12;
    html += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${lineY2}" stroke="${color}" stroke-width="1.5" opacity=".6"/>`;
    html += `<g class="mh-marker" data-well="${w}" style="cursor:pointer" tabindex="0" role="button" aria-label="${w} ${stageLabel(stage)}">
      <circle cx="${cx}" cy="${y}" r="${r}" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="${cx}" y="${labelY}" text-anchor="middle" font-family="IBM Plex Mono" font-size="${featured?12:10}" font-weight="${featured?700:500}" fill="var(--navy)">${w.replace('MH.','')}</text>
    </g>`;
  });

  svg.innerHTML = html;
  svg.querySelectorAll(".mh-marker").forEach(g=>{
    g.addEventListener("click", ()=> window.goToWellsTab(g.dataset.well));
    g.addEventListener("keypress", (e)=>{ if(e.key==="Enter") window.goToWellsTab(g.dataset.well); });
    const title = document.createElementNS("http://www.w3.org/2000/svg","title");
    title.textContent = g.dataset.well + " — " + stageLabel(wellStatus(g.dataset.well));
    g.appendChild(title);
  });
}

/* ---------------------------------------------------------
   KPI cards
--------------------------------------------------------- */
function renderKPIs(){
  const plan = DATA.scurve.planMonthly;
  const actual = DATA.scurve.actualMonthly;
  const cumPlan = plan.slice(0, actual.length).reduce((a,b)=>a+b, 0);
  const cumActual = actual.reduce((a,b)=>a+b, 0);

  document.getElementById("kpiPlan").textContent = cumPlan.toFixed(2) + "%";
  document.getElementById("kpiActual").textContent = cumActual.toFixed(2) + "%";
  const delta = cumActual - cumPlan;
  const deltaEl = document.getElementById("kpiDelta");
  deltaEl.textContent = (delta>=0? "เร็วกว่าแผน " : "ล่าช้ากว่าแผน ") + Math.abs(delta).toFixed(2) + "%";
  deltaEl.style.color = delta>=0 ? "var(--green)" : "var(--red)";

  document.getElementById("kpiDays").textContent = DATA.daily.filter(d=>!d.unconfirmed).length + " วัน";

  let complete=0, total=0;
  for(let n=1;n<=27;n++){
    const st = wellStatus("MH."+n);
    if(st !== "none") total++;
    if(st === "complete") complete++;
  }
  document.getElementById("kpiWells").textContent = complete + " / " + total;
}

/* ---------------------------------------------------------
   S-Curve chart (hand-drawn SVG)
--------------------------------------------------------- */
function renderSCurve(){
  const svg = document.getElementById("scurveSvg");
  const labels = DATA.scurve.labels;
  const plan = DATA.scurve.planMonthly;
  const actual = DATA.scurve.actualMonthly;

  const cumPlan = []; let p=0;
  plan.forEach(v=>{ p+=v; cumPlan.push(p); });
  const cumActual = []; let a=0;
  actual.forEach(v=>{ a+=v; cumActual.push(a); });

  const W=1200,H=460, padL=54, padR=30, padT=24, padB=48;
  const plotW = W-padL-padR, plotH = H-padT-padB;
  const maxY = 100;
  const n = labels.length;
  const xAt = i => padL + (plotW/(n-1))*i;
  const yAt = v => padT + plotH - (v/maxY)*plotH;

  let html = "";
  // gridlines + y labels
  for(let g=0; g<=5; g++){
    const val = g*20;
    const yy = yAt(val);
    html += `<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" stroke="var(--paper-line)" stroke-width="1"/>`;
    html += `<text x="${padL-10}" y="${yy+4}" text-anchor="end" font-family="IBM Plex Mono" font-size="11" fill="var(--ink-faint)">${val}%</text>`;
  }
  // x labels
  labels.forEach((lb,i)=>{
    html += `<text x="${xAt(i)}" y="${H-padB+22}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="var(--ink-faint)">${lb}</text>`;
  });

  // plan line (full 18 months)
  let planPath = cumPlan.map((v,i)=> (i===0?"M":"L") + xAt(i) + " " + yAt(v)).join(" ");
  html += `<path d="${planPath}" fill="none" stroke="var(--steel)" stroke-width="2.5" stroke-dasharray="6 4"/>`;

  // actual line (only months with data) + filled area
  let actualPath = cumActual.map((v,i)=> (i===0?"M":"L") + xAt(i) + " " + yAt(v)).join(" ");
  const areaPath = actualPath + ` L ${xAt(cumActual.length-1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
  html += `<path d="${areaPath}" fill="var(--amber)" opacity=".08"/>`;
  html += `<path d="${actualPath}" fill="none" stroke="var(--amber)" stroke-width="3"/>`;
  cumActual.forEach((v,i)=>{
    html += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="4" fill="var(--amber)" stroke="#fff" stroke-width="1.5"/>`;
  });
  // plan marker only up to current point for legend clarity
  cumPlan.forEach((v,i)=>{
    if(i < cumActual.length){
      html += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="3" fill="var(--steel)" stroke="#fff" stroke-width="1"/>`;
    }
  });

  // "today" marker
  const todayIdx = cumActual.length - 1;
  html += `<line x1="${xAt(todayIdx)}" y1="${padT}" x2="${xAt(todayIdx)}" y2="${H-padB}" stroke="var(--red)" stroke-width="1" stroke-dasharray="3 3"/>`;
  html += `<text x="${xAt(todayIdx)+6}" y="${padT+14}" font-family="IBM Plex Mono" font-size="10" fill="var(--red)">ปัจจุบัน</text>`;

  // legend
  html += `<g transform="translate(${padL}, ${padT-4})">
    <line x1="0" y1="0" x2="22" y2="0" stroke="var(--steel)" stroke-width="2.5" stroke-dasharray="6 4"/>
    <text x="28" y="4" font-family="IBM Plex Sans Thai" font-size="12" fill="var(--ink-soft)">แผนงาน (Plan)</text>
    <line x1="150" y1="0" x2="172" y2="0" stroke="var(--amber)" stroke-width="3"/>
    <text x="178" y="4" font-family="IBM Plex Sans Thai" font-size="12" fill="var(--ink-soft)">ผลงานจริง (Actual)</text>
  </g>`;

  svg.innerHTML = html;
}

/* ---------------------------------------------------------
   Recent events
--------------------------------------------------------- */
function renderRecent(){
  const el = document.getElementById("recentList");
  const items = DATA.daily.slice(-8).reverse();
  el.innerHTML = items.map(r=>`
    <div class="recent-item">
      <span class="recent-date">${r.date}${r.unconfirmed?' *':''}</span>
      <span class="recent-wells">${r.wells.slice(0,3).map(w=>`<span class="tag">${w}</span>`).join("")}</span>
      <span class="recent-text">${r.text}</span>
    </div>
  `).join("") + (items.some(i=>i.unconfirmed) ? '<p style="font-size:.76rem;color:var(--ink-faint);margin-top:10px;">* แผนงานที่ยังไม่มีรายงานผลยืนยันในวันถัดไป</p>' : '');
}

/* ---------------------------------------------------------
   Daily tab: filters + table
--------------------------------------------------------- */
function initDailyTab(){
  const monthSel = document.getElementById("filterMonth");
  const wellSel = document.getElementById("filterWell");
  const searchInput = document.getElementById("filterSearch");

  const months = [...new Set(DATA.daily.map(d=>d.month))].sort((a,b)=>a-b);
  const monthNames = {3:"มีนาคม",4:"เมษายน",5:"พฤษภาคม",6:"มิถุนายน",7:"กรกฎาคม"};
  monthSel.innerHTML = `<option value="">ทุกเดือน</option>` + months.map(m=>`<option value="${m}">${monthNames[m]||m} 2569</option>`).join("");

  wellSel.innerHTML = `<option value="">ทุกบ่อพัก</option>` + DATA.wells.map(w=>`<option value="${w}">${w}</option>`).join("");

  [monthSel, wellSel, searchInput].forEach(el=>{
    el.addEventListener("input", renderDailyTable);
    el.addEventListener("change", renderDailyTable);
  });
  document.getElementById("clearFilters").addEventListener("click", ()=>{
    monthSel.value=""; wellSel.value=""; searchInput.value="";
    renderDailyTable();
  });

  renderDailyTable();
}

function renderDailyTable(){
  const month = document.getElementById("filterMonth").value;
  const well = document.getElementById("filterWell").value;
  const search = document.getElementById("filterSearch").value.trim().toLowerCase();

  let rows = DATA.daily.filter(r=>{
    if(month && String(r.month) !== month) return false;
    if(well && !r.wells.includes(well)) return false;
    if(search && !r.text.toLowerCase().includes(search)) return false;
    return true;
  });

  document.getElementById("dailyCount").textContent = `พบ ${rows.length} รายการ`;

  const tbody = document.getElementById("dailyTbody");
  if(!rows.length){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(r=>`
    <tr class="${r.holiday?'is-holiday':''} ${r.unconfirmed?'is-unconfirmed':''}">
      <td class="cell-date">${r.date}${r.unconfirmed?' *':''}</td>
      <td><div class="cell-wells">${r.wells.map(w=>`<span class="tag tag-well" data-well="${w}">${w}</span>`).join("")}</div></td>
      <td>${r.text}${r.reportUrl?` <a class="report-link" href="${r.reportUrl}" target="_blank" rel="noopener">📄 ดูใบรายงาน${r.reportPage?` (หน้า ${r.reportPage})`:'จริง'}</a>`:''}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".tag-well").forEach(t=>{
    t.addEventListener("click", ()=> window.goToWellsTab(t.dataset.well));
  });
}

/* ---------------------------------------------------------
   Wells tab
--------------------------------------------------------- */
function initWellsTab(){
  const chipsEl = document.getElementById("wellChips");
  const wellsWithData = [];
  for(let n=1;n<=27;n++){
    const name = "MH."+n;
    if(recordsForWell(name).length || DATA.curated[name]) wellsWithData.push(name);
  }
  chipsEl.innerHTML = wellsWithData.map(w=>{
    const stage = wellStatus(w);
    return `<button class="well-chip" data-well="${w}"><i class="chip-dot" style="background:${stageColor(stage)}"></i>${w}</button>`;
  }).join("");

  chipsEl.querySelectorAll(".well-chip").forEach(btn=>{
    btn.addEventListener("click", ()=> selectWell(btn.dataset.well));
  });

  selectWell(wellsWithData.includes("MH.11") ? "MH.11" : wellsWithData[0]);
}

const WELL_SUBTITLES = {
  "MH.1": "ใช้วิธีก่อสร้างแบบปัก Sheet Pile — งานปัก Sheet Pile (กันดิน) แล้วเสร็จปลาย พ.ค. 2569 แต่ยังไม่ได้ขุดดิน ติดตั้งค้ำยัน และเทคอนกรีตพื้นบ่อ สถานะ: อยู่ระหว่างดำเนินการ",
  "MH.2": "ใช้วิธีก่อสร้างแบบปัก Sheet Pile — เริ่มสำรวจ 24 มี.ค. 2569 อยู่ระหว่างดำเนินการปัก Sheet Pile ยังไม่เข้าสู่ขั้นขุดดิน/เทพื้นบ่อ",
  "MH.9": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — งานโครงสร้างพื้นบ่อแล้วเสร็จ 19 มิ.ย. 2569 (บ่อแรกที่ดำเนินงานครบทุกขั้นตอนจนถึงงานพื้นบ่อ)",
  "MH.10": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — งานโครงสร้างพื้นบ่อแล้วเสร็จ 22 มิ.ย. 2569 (บ่อที่สอง ห่างจาก MH.9 เพียง 3 วัน)",
  "MH.11": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — บ่อล่าสุดที่ดำเนินงานครบทุกขั้นตอนจนถึงงานพื้นบ่อ (3 ก.ค. 2569) ต่อจาก MH.9 และ MH.10",
  "MH.12": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — เทคอนกรีต Guide Wall ครบ 4 ด้าน และรื้อแบบหล่อแล้ว (4 ก.ค. 2569) ยังไม่เริ่มงานพื้นบ่อ คาดว่าจะเป็นบ่อสุดท้ายในกลุ่มที่แล้วเสร็จ",
};

function selectWell(name){
  if(!name) return;
  document.querySelectorAll(".well-chip").forEach(c=>c.classList.toggle("active", c.dataset.well===name));

  const detail = document.getElementById("wellDetail");
  const stage = wellStatus(name);
  const curated = DATA.curated[name];
  const auto = recordsForWell(name);

  let timelineHtml = "";
  if(curated){
    timelineHtml = curated.map(it=>{
      const b = categoryBadge(it.stage);
      return `
      <div class="timeline-item">
        <span class="timeline-date mono">${it.date}</span>
        <span class="timeline-text">${it.text}</span>
        <span class="timeline-stage"><span class="badge ${b.cls}">${it.stage}</span></span>
      </div>
    `;}).join("");
  } else if(auto.length){
    timelineHtml = auto.map(r=>`
      <div class="timeline-item">
        <span class="timeline-date mono">${r.date}${r.unconfirmed?' *':''}</span>
        <span class="timeline-text">${r.text}</span>
        <span class="timeline-stage"><span class="badge ${stageBadgeClass(classify(r.text))}">${stageLabel(classify(r.text))}</span></span>
      </div>
    `).join("");
  } else {
    timelineHtml = `<p style="color:var(--ink-faint);padding:20px 0;">ยังไม่มีข้อมูลรายงานสำหรับบ่อนี้</p>`;
  }

  detail.innerHTML = `
    <div class="well-detail-head">
      <div>
        <div class="well-detail-title">${name}</div>
        <p class="well-detail-sub">${WELL_SUBTITLES[name] || (curated ? "" : "ข้อมูลนี้ประมวลผลอัตโนมัติจากคำสำคัญในรายงานหน้างาน อาจไม่ครอบคลุมทุกรายละเอียด")}</p>
      </div>
      <span class="badge ${stageBadgeClass(stage)}" style="font-size:.85rem;padding:6px 16px;">${stageLabel(stage)}</span>
    </div>
    <div class="timeline">${timelineHtml}</div>
  `;
}

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  initTabs();
  renderHeroMeta();
  renderAlignmentStrip();
  renderKPIs();
  renderSCurve();
  renderRecent();
  initDailyTab();
  initWellsTab();
});

})();
