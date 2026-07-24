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
  "Test Pit": {cls:"badge-testpit", color:"var(--testpit)", label:"Test Pit อุปสรรคใต้ดิน"},
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
const STAGE_TESTPIT_WORDS  = ["Test Pit","test pit"];
const STAGE_EARLY_WORDS    = ["กำหนดตำแหน่ง","สำรวจ","ตัด Joint","ตัด joint","สกัด","เตรียมงาน","เติมยาง"];

function classify(text){
  if(!text) return "none";
  if(STAGE_PENDING_WORDS.some(w=>text.includes(w))) return "pending";
  if(STAGE_COMPLETE_WORDS.some(w=>text.includes(w))) return "complete";
  if(STAGE_PROGRESS_WORDS.some(w=>text.includes(w))) return "progress";
  if(STAGE_TESTPIT_WORDS.some(w=>text.includes(w))) return "testpit";
  if(STAGE_EARLY_WORDS.some(w=>text.includes(w))) return "early";
  return "early";
}

function stageColor(stage){
  return {complete:"var(--green)", progress:"var(--amber)", testpit:"var(--testpit)", early:"var(--steel-soft)", pending:"var(--red)", none:"var(--grey)"}[stage];
}
function stageBadgeClass(stage){
  return {complete:"badge-complete", progress:"badge-progress", testpit:"badge-testpit", early:"badge-early", pending:"badge-pending", none:"badge-none"}[stage];
}
function stageLabel(stage){
  return {complete:"ก่อสร้างบ่อแล้วเสร็จ", progress:"อยู่ระหว่างก่อสร้างบ่อ", testpit:"Test Pit อุปสรรคใต้ดินแล้ว", early:"เตรียมการ/สำรวจ", pending:"ยังไม่เริ่มดำเนินการ", none:"ไม่มีข้อมูล"}[stage];
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
// สถานะช่วงดันท่อ (override รายช่วง key = บ่อต้นทาง) — default "none" เพราะงานดันท่อยังไม่เริ่ม
function segStatus(fromW){
  return (DATA.segmentStatus && DATA.segmentStatus[fromW]) || "none";
}

function renderAlignmentStrip(){
  const svg = document.getElementById("alignmentSvg");
  const net = DATA.network;
  if(!net){ svg.innerHTML=""; return; }

  const W = 1200, padX = 54;
  const yMain = 205, sq = 15, sqSub = 10, pipeTh = 3.2;
  const SUB_FILL = "#FBEE9C", SUB_STROKE = "#C9B04A", SUB_INK = "#8A7420";
  const SCP = "#D23B2A", OPEN_INK = "#3D5468";

  // สเกล √ ร่วมทุกทิศ (px ต่อ √เมตร) — ช่วงสั้นยังอ่านได้ ไม่จมช่วงยาว
  const dists = net.main.slice(0,-1).map(m=>m.distTo);
  const roots = dists.map(Math.sqrt);
  const sum = roots.reduce((a,b)=>a+b,0);
  const availW = W - padX*2 - 30;
  const k = availW / sum;
  const toPx = m => Math.sqrt(m)*k;
  const crossPx = Math.max(toPx(net.crossLen || 40), 42);
  const yBranch = yMain - sq - crossPx;

  // ตำแหน่ง x ตามระยะดันสะสม
  const X = {}; let x = padX + 20;
  net.main.forEach((m,i)=>{ X[m.w]=x; if(i<net.main.length-1) x += roots[i]*k; });

  function wellRect(cx,cy,s,fill,type,label,clickWell){
    let stroke, sw, dash="";
    if(type==="sub"){ stroke=SUB_STROKE; sw=1.4; fill=SUB_FILL; }
    else if(type==="csl"){ stroke="var(--navy-deep)"; sw=2.6; }
    else { stroke="var(--ink-faint)"; sw=1.6; dash='stroke-dasharray="2.5 2"'; }
    const g0 = clickWell ? `<g class="mh-marker" data-well="${clickWell}" style="cursor:pointer" tabindex="0" role="button" aria-label="${label}">` : `<g>`;
    return `${g0}<rect x="${cx-s/2}" y="${cy-s/2}" width="${s}" height="${s}" rx="2.4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash}/><title>${label}</title></g>`;
  }

  let html = "";
  html += `<text x="${padX}" y="22" font-family="IBM Plex Mono" font-size="11" fill="var(--ink-faint)">ต้นโครงการ (วัดชัยมงคล)</text>`;
  html += `<text x="${W-padX}" y="22" text-anchor="end" font-family="IBM Plex Mono" font-size="11" fill="var(--ink-faint)">ปลายโครงการ (ซอยเทศบาลบางปู 49)</text>`;
  html += `<text x="${padX}" y="${yBranch-20}" font-family="IBM Plex Sans Thai" font-size="10.5" fill="var(--ink-soft)" font-weight="600">ฝั่งขาออก (branch)</text>`;

  // ── ช่วงท่อแนวประธาน (สี = สถานะช่วง, เลข = ระยะดันจริง) ──
  for(let i=0;i<net.main.length-1;i++){
    const a=net.main[i], b=net.main[i+1];
    const x1=X[a.w]+sq/2+3, x2=X[b.w]-sq/2-3;
    const color=stageColor(segStatus(a.w));
    const isSCP=a.pipe==="scp";
    html += `<line x1="${x1}" y1="${yMain}" x2="${x2}" y2="${yMain}" stroke="${color}" stroke-width="${pipeTh}"><title>${a.w} → ${b.w} · ${isSCP?'SCP':'RCP'} · ดันท่อลอด ${a.distTo} ม. · ${stageLabel(segStatus(a.w))}</title></line>`;
    const mx=(X[a.w]+X[b.w])/2;
    html += `<text x="${mx}" y="${yMain+24}" text-anchor="middle" font-family="IBM Plex Mono" font-size="8.5" fill="var(--ink-soft)">${a.distTo}</text>`;
    if(isSCP) html += `<text x="${mx}" y="${yMain-9}" text-anchor="middle" font-family="IBM Plex Mono" font-size="7.5" fill="${SCP}" font-weight="700">SCP</text>`;
  }

  // ── tie-in บนแนวประธาน: ไม่วาดสี่เหลี่ยม (เลี่ยงสับสนกับสีเหลือง Test Pit) — คงข้อมูลไว้ใน DATA.network ──


  // ── branch ฝั่งขาออก (SCP ข้ามถนน ≈40 ม.) ──
  net.branches.forEach(br=>{
    const cx=X[br.junction]; if(cx==null) return;
    const color=stageColor(wellStatus(br.w));
    html+=`<line x1="${cx}" y1="${yMain-sq/2}" x2="${cx}" y2="${yBranch+sq/2}" stroke="${SCP}" stroke-width="2.4" stroke-dasharray="4 3"/>`;
    html+=`<text x="${cx+5}" y="${(yMain+yBranch)/2+2}" font-family="IBM Plex Mono" font-size="7.5" fill="${SCP}" font-weight="700">SCP</text>`;
    html+=wellRect(cx,yBranch,sq,color,br.type,br.w+" · "+br.size+" · "+stageLabel(wellStatus(br.w)),br.w);
    html+=`<text x="${cx}" y="${yBranch-sq/2-6}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="700" fill="var(--navy)">${br.w.replace('MH.','')}</text>`;
    // tie-in ข้างบ่อ branch: ไม่วาดสี่เหลี่ยม (เลี่ยงสับสนกับสีเหลือง Test Pit)
    if(br.open){
      const oLen=toPx(br.open.len);
      const ox=cx-sq/2-oLen;
      html+=`<line x1="${cx-sq/2}" y1="${yBranch}" x2="${ox}" y2="${yBranch}" stroke="${OPEN_INK}" stroke-width="2.8" stroke-dasharray="1.5 2.5"/>`;
      html+=`<circle cx="${ox}" cy="${yBranch}" r="2.6" fill="${OPEN_INK}"><title>${br.open.w} · ตัดบรรจบ (ปลายงานขุดเปิด)</title></circle>`;
      html+=`<text x="${(cx-sq/2+ox)/2}" y="${yBranch-8}" text-anchor="middle" font-family="IBM Plex Sans Thai" font-size="7.5" fill="${OPEN_INK}" font-weight="600">ขุดเปิด ${br.open.len}ม.</text>`;
    }
  });

  // ── บ่อแนวประธาน (วาดบนสุด) ──
  net.main.forEach(m=>{
    const cx=X[m.w];
    html+=wellRect(cx,yMain,sq,stageColor(wellStatus(m.w)),m.type,m.w+" · "+m.size+" · "+stageLabel(wellStatus(m.w)),m.w);
    html+=`<text x="${cx}" y="${yMain-sq/2-6}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="700" fill="var(--navy)">${m.w.replace('MH.','')}</text>`;
  });

  svg.innerHTML = html;
  svg.querySelectorAll(".mh-marker").forEach(g=>{
    g.addEventListener("click", ()=> window.goToWellsTab(g.dataset.well));
    g.addEventListener("keypress", (e)=>{ if(e.key==="Enter") window.goToWellsTab(g.dataset.well); });
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
  const planSub = document.getElementById("kpiPlanSub");
  if(planSub){
    const lb = (DATA.scurve.labels||[])[actual.length-1];
    planSub.textContent = lb ? ("ณ สิ้นเดือน " + lb + " 2569") : "ณ สิ้นเดือนล่าสุด";
  }
  document.getElementById("kpiActual").textContent = cumActual.toFixed(2) + "%";
  const delta = cumActual - cumPlan;
  const deltaEl = document.getElementById("kpiDelta");
  deltaEl.textContent = (delta>=0? "เร็วกว่าแผน " : "ล่าช้ากว่าแผน ") + Math.abs(delta).toFixed(2) + "%";
  deltaEl.style.color = delta>=0 ? "var(--green)" : "var(--red)";

  /* วันที่ที่ % ผลงานจริงถูกวัด — แจ้งเป็นครั้ง ๆ จากงวดงาน ไม่ใช่วันที่ของบันทึกประจำวัน */
  const asOfEl = document.getElementById("kpiActualAsOf");
  if(asOfEl){
    const TH = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    const a = DATA.meta.actualAsOf;
    if(a){
      const [yy,mm,dd] = a.split("-").map(Number);
      asOfEl.textContent = "ความก้าวหน้าถึงวันที่ " + dd + " " + TH[mm] + " " + yy;
      asOfEl.style.color = "var(--ink-soft)";
    } else {
      asOfEl.textContent = "ยังไม่ระบุวันที่วัดผลงาน";
      asOfEl.style.color = "var(--red)";
    }
  }

  /* วันตามสัญญาที่ล่วงไปแล้ว — นับรวมวันหยุดและวันที่ไม่มีรายงาน
     ฐาน: meta.startDate (3 มี.ค. 2569) ถึงวันที่ข้อมูลล่าสุด / meta.durationDays (540 วัน) */
  const beToDate = iso => { const [y,m,dd] = iso.split("-").map(Number);
                            return new Date(Date.UTC(y-543, m-1, dd)); };
  const cStart   = beToDate(DATA.meta.startDate);
  const cNow     = beToDate(DATA.daily[DATA.daily.length-1].iso);
  const cTotal   = DATA.meta.durationDays;
  const cElapsed = Math.min(cTotal, Math.round((cNow - cStart)/86400000) + 1);
  document.getElementById("kpiDays").textContent = cElapsed + " / " + cTotal + " วัน";
  const daysSub = document.getElementById("kpiDaysSub");
  if(daysSub) daysSub.textContent = "ล่วงไปแล้ว " + (cElapsed/cTotal*100).toFixed(1) + "% ของอายุสัญญา";

  let complete=0, total=0;
  for(let n=1;n<=27;n++){
    const st = wellStatus("MH."+n);
    total++;                       // นับตามขอบเขตสัญญาเสมอ (ตัวหารคงที่ 27 บ่อ)
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
      <td>${r.text}${r.reportUrl?` <a class="report-link" href="${r.reportUrl}" target="_blank" rel="noopener" title="${r.reportPage?`เปิดไฟล์รายเดือนแล้วไปที่หน้า ${r.reportPage}`:'เปิดใบรายงานของวันนี้'}">📄 ${r.reportPage?`ดูใบรายงาน → ไปหน้า ${r.reportPage}`:'ดูใบรายงานจริง'}</a>`:''}</td>
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
  "MH.1": "ใช้วิธีก่อสร้างแบบปัก Sheet Pile — งานปัก Sheet Pile (กันดิน) แล้วเสร็จปลาย พ.ค. 2569 เริ่มงานขุดดิน/ติดตั้งค้ำยัน (Bracing ชั้น 1) 19–20 ก.ค. 2569 ยังไม่เทคอนกรีตพื้นบ่อ สถานะ: อยู่ระหว่างดำเนินการ",
  "MH.2": "ใช้วิธีก่อสร้างแบบปัก Sheet Pile — งานปัก Sheet Pile (กันดิน) แล้วเสร็จ 18 ก.ค. 2569 เริ่มติดตั้งค้ำยัน (Bracing ชั้น 1) 20 ก.ค. 2569 ยังไม่เทคอนกรีตพื้นบ่อ สถานะ: อยู่ระหว่างดำเนินการ",
  "MH.9": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — งานโครงสร้างพื้นบ่อแล้วเสร็จ 19 มิ.ย. 2569 (บ่อแรกที่ดำเนินงานครบทุกขั้นตอนจนถึงงานพื้นบ่อ)",
  "MH.10": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — งานโครงสร้างพื้นบ่อแล้วเสร็จ 22 มิ.ย. 2569 (บ่อที่สอง ห่างจาก MH.9 เพียง 3 วัน)",
  "MH.11": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — บ่อล่าสุดที่ดำเนินงานครบทุกขั้นตอนจนถึงงานพื้นบ่อ (3 ก.ค. 2569) ต่อจาก MH.9 และ MH.10",
  "MH.12": "ใช้วิธีก่อสร้างแบบจมบ่อพัก (Caisson) — จมบ่อพักครบ E1–E7 (10 ก.ค. 2569) งานโครงสร้างพื้นบ่อแล้วเสร็จ 16 ก.ค. 2569 (บ่อล่าสุดที่ครบขั้นพื้นบ่อ ต่อจาก MH.9, MH.10 และ MH.11)",
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
