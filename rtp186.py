#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rtp186.py — เครื่องมือสายพานข้อมูล Dashboard สัญญา รทป.186
--------------------------------------------------------------
หลักการ : ไฟล์ data.js ต้องไม่ถูกอ่านออกมาเป็นข้อความ (never print the payload)
          ทุกคำสั่งพิมพ์เฉพาะ "digest" สรุปผล ทำให้ต้นทุนต่อรอบเป็น O(1)
          ไม่ว่าไฟล์จะโตขึ้นกี่เท่าก็ตาม

คำสั่ง
  pull                     ดึง data.js ล่าสุดจาก GitHub raw มาไว้ในเครื่อง
  inspect                  พิมพ์ digest (records / ช่วงวันที่ / ช่องว่าง / สถานะบ่อ)
  patch  --delta d.json    ผสาน delta เข้าไฟล์ แล้วเขียนผลลัพธ์ + ตรวจสอบอัตโนมัติ
  verify --file f.js       ตรวจความถูกต้องไฟล์ผลลัพธ์
  audit                    รายงานความซ้ำซ้อนของข้อมูล + ประเมินเนื้อที่ที่ลดได้

รูปแบบ delta.json
{
  "confirmed": "23 กรกฎาคม 2569",
  "note": "ข้อความกำกับรุ่น",
  "records": [
    {"iso":"2569-07-24","text":"1. ...","wells":["MH.8"],
     "unconfirmed":false,"holiday":false,"reportUrl":"https://..."}
  ],
  "curated": { "MH.2":[{"date":"24/07/2569","text":"...","stage":"ค้ำยัน"}] },
  "wellStatus": { "MH.2":"progress" },
  "actualMonthly": [0.08,0.03,0.08,3.05,0.24]
}
"""
import argparse, datetime, json, os, re, subprocess, sys

RAW = "https://raw.githubusercontent.com/tinnapoptaweesap-dev/rtp186-dashboard/main/data.js"
TH_MON = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
          "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
TH_FULL = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
           "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]


# ---------------------------------------------------------------- io layer
def load(path):
    """อ่าน data.js -> dict  (ไม่คืนข้อความดิบออกไปไหน)"""
    s = open(path, encoding="utf-8").read()
    i = s.index("const DATA = {")
    j = s.rfind("};")
    return json.loads(s[i + len("const DATA = "):j + 1])


def dump(d, path, gen_date, rev, note):
    n = len(d["daily"])
    ws = len(d.get("wellStatus", {}))
    hdr = (
        "/* ============================================================\n"
        "   รทป.186 — data.js\n"
        f"   Generated : {gen_date} rev{rev}\n"
        f"   Records   : {n}  (last entry: {d['meta']['lastDataDate']})\n"
        f"   Confirmed : {d['meta']['lastConfirmed']}\n"
        f"   reportUrl : {sum(1 for r in d['daily'] if r.get('reportUrl'))}/{n}\n"
        f"   wellStatus overrides: {ws}\n"
        f"   Note      : rev{rev} — {note}\n"
        "   ============================================================ */\n")
    body = "const DATA = " + json.dumps(d, ensure_ascii=False) + ";\n"
    tail = (f'console.log("[รทป.186] data.js build: {gen_date} rev{rev} '
            f'| records: {n} | lastDataDate: {d["meta"]["lastDataDate"]}");\n')
    open(path, "w", encoding="utf-8").write(hdr + body + tail)
    return os.path.getsize(path)


# ------------------------------------------------------------- date helper
def iso_parts(iso):
    y, m, dd = (int(x) for x in iso.split("-"))
    return y, m, dd


def th_short(iso):
    y, m, dd = iso_parts(iso)
    return f"{dd} {TH_MON[m]} {y}"


def th_full(iso):
    y, m, dd = iso_parts(iso)
    return f"{dd} {TH_FULL[m]} {y}"


# ------------------------------------------------------------------ digest
def digest(d, tag="DIGEST"):
    daily = d["daily"]
    iso = [r["iso"] for r in daily]
    out = [f"===== {tag} =====",
           f"records            : {len(daily)}",
           f"range              : {iso[0]} -> {iso[-1]}",
           f"meta.lastConfirmed : {d['meta']['lastConfirmed']}",
           f"meta.lastDataDate  : {d['meta']['lastDataDate']}",
           f"reportUrl coverage : {sum(1 for r in daily if r.get('reportUrl'))}/{len(daily)}",
           f"unconfirmed rows   : {[r['iso'] for r in daily if r.get('unconfirmed')]}",
           f"curated wells      : " +
           ", ".join(f"{k}({len(v)})" for k, v in d["curated"].items())]

    # ตรวจซ้ำ / เรียง / ช่องว่างปฏิทิน
    dup = [x for x in set(iso) if iso.count(x) > 1]
    out.append(f"duplicate iso      : {dup if dup else 'none'}")
    out.append(f"sorted             : {iso == sorted(iso)}")

    def toord(s):
        y, m, dd = iso_parts(s)
        return datetime.date(y - 543, m, dd).toordinal()

    gaps, prev = [], None
    for r in daily:
        cur = toord(r["iso"])
        if prev is not None and cur - prev > 1:
            span = (r.get("dayEnd"), r.get("day"))
            if not (r.get("dayEnd") and r["dayEnd"] > r["day"]):
                gaps.append(f"{prev_iso}->{r['iso']} ({cur-prev-1}d)")
        prev = toord(r["iso"]) + max(0, (r.get("dayEnd", r["day"]) - r["day"]))
        prev_iso = r["iso"]
    out.append(f"calendar gaps      : {gaps if gaps else 'none'}")

    st = {}
    for k, v in d.get("wellStatus", {}).items():
        st.setdefault(v, []).append(k)
    for k in sorted(st):
        out.append(f"wellStatus {k:<9}: {', '.join(st[k])}")
    sc = d["scurve"]
    out.append(f"plan cum (to now)  : {round(sum(sc['planMonthly'][:len(sc['actualMonthly'])]),2)}%")
    out.append(f"actual cum         : {round(sum(sc['actualMonthly']),2)}%")
    out.append(f"actual as-of       : {d['meta'].get('actualAsOf','** ยังไม่ระบุ **')}")
    out.append(f"variance           : {round(sum(sc['actualMonthly'])-sum(sc['planMonthly'][:len(sc['actualMonthly'])]),2)}%")
    return "\n".join(out)


# ------------------------------------------------------------------- patch
def cmd_patch(a):
    d = load(a.file)
    delta = json.load(open(a.delta, encoding="utf-8"))
    log = []

    # ---- daily : upsert by iso
    idx = {r["iso"]: k for k, r in enumerate(d["daily"])}
    for rec in delta.get("records", []):
        y, m, dd = iso_parts(rec["iso"])
        row = {"date": rec.get("date") or th_short(rec["iso"]), "iso": rec["iso"],
               "day": rec.get("day", dd), "dayEnd": rec.get("dayEnd", dd),
               "month": m, "year": y, "text": rec["text"],
               "wells": rec.get("wells", []),
               "holiday": bool(rec.get("holiday", False)),
               "unconfirmed": bool(rec.get("unconfirmed", False))}
        if rec.get("reportUrl"):
            row["reportUrl"] = rec["reportUrl"]
        if rec.get("reportPage"):
            row["reportPage"] = rec["reportPage"]
        if rec["iso"] in idx:
            old = d["daily"][idx[rec["iso"]]]
            row.setdefault("reportUrl", old.get("reportUrl"))
            if row["reportUrl"] is None:
                row.pop("reportUrl")
            d["daily"][idx[rec["iso"]]] = row
            log.append(f"  UPDATE {rec['iso']}  {'(confirm)' if not row['unconfirmed'] else '(plan)'}")
        else:
            d["daily"].append(row)
            log.append(f"  INSERT {rec['iso']}  {'(confirm)' if not row['unconfirmed'] else '(plan)'}")
    d["daily"].sort(key=lambda r: r["iso"])

    # ---- curated : prepend + dedup (date,text)
    for w, items in delta.get("curated", {}).items():
        cur = d["curated"].setdefault(w, [])
        seen = {(c["date"], c["text"]) for c in cur}
        add = [c for c in items if (c["date"], c["text"]) not in seen]
        d["curated"][w] = add + cur
        if add:
            log.append(f"  CURATED {w} += {len(add)}")

    # ---- wellStatus / scurve
    for w, v in delta.get("wellStatus", {}).items():
        if d["wellStatus"].get(w) != v:
            log.append(f"  STATUS {w}: {d['wellStatus'].get(w)} -> {v}")
            d["wellStatus"][w] = v
    if delta.get("actualMonthly"):
        d["scurve"]["actualMonthly"] = delta["actualMonthly"]
        log.append("  SCURVE actualMonthly updated")
    if delta.get("actualAsOf"):
        d["meta"]["actualAsOf"] = delta["actualAsOf"]
        log.append(f"  META actualAsOf -> {delta['actualAsOf']}")

    # ---- meta
    last = d["daily"][-1]["iso"]
    conf = delta.get("confirmed") or th_full(
        max((r["iso"] for r in d["daily"] if not r.get("unconfirmed")), default=last))
    d["meta"]["lastConfirmed"] = conf
    d["meta"]["lastDataDate"] = th_full(last)

    gen = a.gen or datetime.date.today().strftime("%Y-%m-%d").replace(
        str(datetime.date.today().year), str(datetime.date.today().year + 543))
    rev = a.rev
    note = delta.get("note", "routine daily merge")
    n = len(d["daily"])
    d["meta"]["buildInfo"] = {
        "generatedAt": f"{gen} rev{rev}", "recordCount": n,
        "lastDataDate": d["meta"]["lastDataDate"],
        "lastConfirmed": d["meta"]["lastConfirmed"],
        "reportUrlCoverage": f"{sum(1 for r in d['daily'] if r.get('reportUrl'))}/{n}",
        "wellStatusOverrides": len(d["wellStatus"]), "note": note}

    size = dump(d, a.out, gen, rev, note)
    print("===== PATCH LOG =====")
    print("\n".join(log) if log else "  (no change)")
    print(f"\nwritten            : {a.out}  ({size:,} bytes)")
    print(digest(d, "POST-PATCH DIGEST"))
    _node_check(a.out)


def _node_check(path):
    js = ("const fs=require('fs');let c=fs.readFileSync(process.argv[1],'utf8');"
          "eval(c.replace('const DATA','global.DATA').replace(/console\\.log[\\s\\S]*$/,''));"
          "if(!DATA.daily.length)throw new Error('empty');"
          "console.log('js syntax        : OK');")
    r = subprocess.run(["node", "-e", js, path], capture_output=True, text=True)
    print(r.stdout.strip() or "js syntax        : FAIL\n" + r.stderr.strip())


# ------------------------------------------------------------------- other
def cmd_pull(a):
    subprocess.run(["curl", "-sS", "-o", a.out, RAW], check=True)
    print(f"pulled {RAW}\n -> {a.out} ({os.path.getsize(a.out):,} bytes)")
    print(digest(load(a.out), "PULLED DIGEST"))


def cmd_inspect(a):
    print(digest(load(a.file), "DIGEST"))


def cmd_verify(a):
    print(digest(load(a.file), "VERIFY"))
    _node_check(a.file)


def cmd_audit(a):
    d = load(a.file)
    raw = os.path.getsize(a.file)
    b = lambda o: len(json.dumps(o, ensure_ascii=False).encode())
    dl, cu = b(d["daily"]), b(d["curated"])
    dtext = {r["iso"]: r["text"] for r in d["daily"]}
    tot = hit = 0
    for w, items in d["curated"].items():
        for c in items:
            tot += 1
            m = re.match(r"(\d{1,2})/(\d{2})/(\d{4})", c["date"])
            if m:
                iso = f"{m.group(3)}-{m.group(2)}-{int(m.group(1)):02d}"
                if iso in dtext and c["text"] in dtext[iso]:
                    hit += 1
    keysave = tot * len('"date":,"text":,"stage":') // 2
    print("===== AUDIT =====")
    print(f"file size          : {raw:,} bytes")
    print(f"  daily            : {dl:,}  ({dl/raw:.0%})   {len(d['daily'])} rec, {dl//max(1,len(d['daily']))} B/rec")
    print(f"  curated          : {cu:,}  ({cu/raw:.0%})   {tot} items")
    print(f"  other (คงที่)     : {raw-dl-cu:,}")
    print(f"curated ที่ text ซ้ำกับ daily : {hit}/{tot} ({hit/max(1,tot):.0%})")
    print(f"ประหยัดได้ถ้าเก็บเป็น ref index : ~{int(cu*hit/max(1,tot)*0.82):,} bytes ({cu*hit/max(1,tot)*0.82/raw:.0%} ของไฟล์)")
    print(f"ประหยัดจากย่อ key (d/t/s)      : ~{keysave:,} bytes")


def main():
    p = argparse.ArgumentParser(prog="rtp186")
    sub = p.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("pull");    q.add_argument("--out", default="data.js");  q.set_defaults(f=cmd_pull)
    q = sub.add_parser("inspect"); q.add_argument("--file", default="data.js"); q.set_defaults(f=cmd_inspect)
    q = sub.add_parser("verify");  q.add_argument("--file", default="data.js"); q.set_defaults(f=cmd_verify)
    q = sub.add_parser("audit");   q.add_argument("--file", default="data.js"); q.set_defaults(f=cmd_audit)
    q = sub.add_parser("patch")
    q.add_argument("--file", default="data.js"); q.add_argument("--delta", required=True)
    q.add_argument("--out", default="data.new.js"); q.add_argument("--rev", default="1")
    q.add_argument("--gen", default=None); q.set_defaults(f=cmd_patch)
    a = p.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
