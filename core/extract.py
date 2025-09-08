#!/usr/bin/env python3
import argparse
import csv
import gzip
import io
import os
import sys
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

MIRRORS = [
    "https://data-argo.ifremer.fr/",
    "https://ftp.ifremer.fr/ifremer/argo/",
    "http://ftp.ifremer.fr/ifremer/argo/",
    "https://nrlgodae1.nrlmry.navy.mil/ftp/outgoing/argo/",
    "http://nrlgodae1.nrlmry.navy.mil/ftp/outgoing/argo/",
]

INDEX_CORE = "ar_index_global_prof.txt.gz"
INDEX_BGC  = "argo_synthetic-profile_index.txt.gz"

def log(msg):
    print(msg, flush=True)

def http_get(url: str, timeout=120, insecure=False) -> bytes:
    import urllib.request, urllib.error, ssl
    ctx = None
    if url.lower().startswith("https") and insecure:
        ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers={"User-Agent": "argo-nc-fetch/1.3"})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return r.read()

def try_download_from_servers(servers, relpath, timeout, insecure, max_tries=3, backoff=2.0):
    last_err = None
    for base in servers:
        url = urljoin(base, relpath)
        for k in range(max_tries):
            try:
                log(f"FETCH: {url} (attempt {k+1}/{max_tries})")
                blob = http_get(url, timeout=timeout, insecure=insecure)
                log(f"FETCH OK: {url} ({len(blob)//1024} KB)")
                return base, blob
            except Exception as e:
                last_err = e
                log(f"FETCH FAIL: {url} -> {e}")
                time.sleep(min(1.0 * (backoff ** k), 8.0))
    raise last_err if last_err else RuntimeError("All mirrors failed.")

def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def save_bytes(path: str, data: bytes):
    ensure_dir(os.path.dirname(path))
    with open(path, "wb") as f:
        f.write(data)
    log(f"SAVED: {path} ({len(data)//1024} KB)")

def _decompress_to_text(raw: bytes, filename_hint: str | None) -> str:
    is_gz = False
    if filename_hint and filename_hint.endswith(".gz"):
        is_gz = True
    elif raw[:2] == b"\x1f\x8b":
        is_gz = True
    if is_gz:
        log("DECOMPRESS: gzip")
        bio = io.BytesIO(raw)
        with gzip.GzipFile(fileobj=bio) as gz:
            return gz.read().decode("utf-8", errors="replace")
    log("DECOMPRESS: plain text")
    return raw.decode("utf-8", errors="replace")

def _sniff_delim(sample_text: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample_text[:8192], delimiters=",;\t")
        log(f"CSV: sniffed delimiter '{dialect.delimiter}'")
        return dialect.delimiter
    except Exception:
        log("CSV: delimiter sniff failed, default ','")
        return ","

def _strip_hash_preamble(lines):
    i = 0
    while i < len(lines):
        if lines[i].lstrip().startswith("#") or lines[i].strip() == "":
            i += 1
        else:
            break
    if i:
        log(f"CSV: stripped {i} comment/preamble lines")
    return lines[i:]

def _find_header_idx(lines, delim):
    for idx, line in enumerate(lines):
        parts = [p.strip().lower() for p in line.split(delim)]
        if "file" in parts:
            log(f"CSV: header line at index {idx}")
            return idx
    log("CSV: header not found explicitly; using first line")
    return 0

def load_index_csv_any(path_or_bytes, filename_hint: str | None = None):
    if isinstance(path_or_bytes, (bytes, bytearray)):
        raw = path_or_bytes
        src = f"<bytes:{filename_hint or 'unknown'}>"
    else:
        src = path_or_bytes
        log(f"READ: {src}")
        with open(path_or_bytes, "rb") as f:
            raw = f.read()
        log(f"READ OK: {src} ({len(raw)//1024} KB)")
    text = _decompress_to_text(raw, filename_hint)
    lines = text.splitlines()
    lines_wo_comments = _strip_hash_preamble(lines)
    if not lines_wo_comments:
        log("CSV: no data after preamble")
        return [], []
    delim = _sniff_delim("\n".join(lines_wo_comments[:200]))
    hdr_idx = _find_header_idx(lines_wo_comments, delim)
    data_lines = lines_wo_comments[hdr_idx:]
    if not data_lines:
        log("CSV: empty after header detection")
        return [], []
    sio = io.StringIO("\n".join(data_lines))
    rdr = csv.reader(sio, delimiter=delim)
    try:
        header = next(rdr)
    except StopIteration:
        log("CSV: header missing")
        return [], []
    norm_header = [(h or "").strip().lower() for h in header]
    rows = []
    for row in rdr:
        if not row:
            continue
        if len(row) < len(norm_header):
            row = row + [""] * (len(norm_header) - len(row))
        d = {norm_header[i]: (row[i].strip() if i < len(norm_header) else "") for i in range(len(norm_header))}
        rows.append(d)
    log(f"CSV: loaded {len(rows):,} rows with {len(norm_header)} columns from {src}")
    return rows, norm_header

def index_date_in_range(idx_str: str, start_iso: str, end_iso: str) -> bool:
    s = (idx_str or "").strip()
    if not s:
        return False
    s = s.replace("T", "").replace("Z", "").replace("-", "").replace(":", "")
    try:
        dt = datetime.strptime(s[:14], "%Y%m%d%H%M%S")
        a = datetime.fromisoformat(start_iso.replace("Z", ""))
        b = datetime.fromisoformat(end_iso.replace("Z", ""))
        return (dt >= a) and (dt < b)
    except Exception:
        return False

def download_file_from_any(base_servers, rel_path, dest_root, timeout, insecure, retries_each=2):
    out_path = os.path.join(dest_root, "dac", rel_path.replace("/", os.sep))
    if os.path.exists(out_path):
        return (rel_path, True, "exists", None)
    ensure_dir(os.path.dirname(out_path))
    last_err = ""
    server_used = None
    try:
        server_used, blob = try_download_from_servers(
            base_servers, urljoin("dac/", rel_path), timeout=timeout, insecure=insecure, max_tries=retries_each
        )
        save_bytes(out_path, blob)
        return (rel_path, True, f"ok ({len(blob)//1024} KB)", server_used)
    except Exception as e:
        last_err = str(e)
    return (rel_path, False, last_err, server_used)

def main():
    log("START: Argo downloader")
    ap = argparse.ArgumentParser(description="Fetch Argo NetCDF by date range and ocean letter (core + optional BGC).")
    ap.add_argument("--start", required=True, help="Start date (YYYY-MM-DD, inclusive, UTC)")
    ap.add_argument("--end",   required=True, help="End date (YYYY-MM-DD, exclusive, UTC)")
    ap.add_argument("--ocean", required=True, help="Ocean letter (e.g., I, A, P)")
    ap.add_argument("--bgc", action="store_true", help="Include BGC Sprof files")
    ap.add_argument("--dest", default="./argo_nc", help="Destination root directory")
    ap.add_argument("--server", default=None, help="Force a single GDAC root URL")
    ap.add_argument("--index-dir", default="indexes", help="Directory to cache index files")
    ap.add_argument("--workers", type=int, default=4, help="Parallel download workers")
    ap.add_argument("--timeout", type=int, default=180, help="HTTP timeout seconds")
    ap.add_argument("--insecure", action="store_true", help="Skip TLS certificate verification")
    args = ap.parse_args()

    start_iso = args.start + "T00:00:00Z"
    end_iso   = args.end   + "T00:00:00Z"
    ocean_letter = (args.ocean or "").strip().upper()
    if not ocean_letter or len(ocean_letter) != 1:
        log("ERROR: --ocean must be a single letter like I, A, or P.")
        sys.exit(2)

    log(f"ARGS: start={start_iso} end={end_iso} ocean={ocean_letter} bgc={args.bgc} dest={args.dest}")
    ensure_dir(args.index_dir)
    servers = [args.server] if args.server else MIRRORS
    log(f"SERVERS: {';'.join(servers)}")
    log(f"INDEX DIR: {args.index_dir}")

    core_index_path = os.path.join(args.index_dir, INDEX_CORE)
    if os.path.exists(core_index_path):
        log(f"INDEX CORE: using cache {core_index_path}")
        with open(core_index_path, "rb") as f:
            core_bytes = f.read()
        log(f"INDEX CORE: cache size {len(core_bytes)//1024} KB")
    else:
        log("INDEX CORE: downloading")
        _, core_bytes = try_download_from_servers(
            servers, INDEX_CORE, timeout=args.timeout, insecure=args.insecure
        )
        save_bytes(core_index_path, core_bytes)
    log("INDEX CORE: parsing")
    core_rows, core_header = load_index_csv_any(core_bytes, INDEX_CORE)

    bgc_rows = []
    if args.bgc:
        bgc_index_path = os.path.join(args.index_dir, INDEX_BGC)
        if os.path.exists(bgc_index_path):
            log(f"INDEX BGC: using cache {bgc_index_path}")
            with open(bgc_index_path, "rb") as f:
                bgc_bytes = f.read()
            log(f"INDEX BGC: cache size {len(bgc_bytes)//1024} KB")
        else:
            log("INDEX BGC: downloading")
            _, bgc_bytes = try_download_from_servers(
                servers, INDEX_BGC, timeout=args.timeout, insecure=args.insecure
            )
            save_bytes(bgc_index_path, bgc_bytes)
        log("INDEX BGC: parsing")
        bgc_rows, bgc_header = load_index_csv_any(bgc_bytes, INDEX_BGC)
    else:
        log("INDEX BGC: skipped")

    def build_colmap(header_keys):
        aliases = {
            "file":  ["file", "filepath", "path", "ncfile", "nc_file"],
            "date":  ["date", "date_update", "date_creation", "datefile", "date_time", "filedate"],
            "ocean": ["ocean", "basin"],
        }
        colmap = {}
        for want, opts in aliases.items():
            for cand in opts:
                if cand in header_keys:
                    colmap[want] = cand
                    break
        return colmap

    core_map = build_colmap(core_header)
    log(f"CORE COLUMNS: mapped {core_map}")
    bgc_map  = build_colmap(bgc_header) if args.bgc else {}

    if "ocean" not in core_map:
        log("ERROR: core index missing 'ocean' column; cannot filter by ocean.")
        sys.exit(3)

    def keep_row(row, cmap):
        dkey = cmap.get("date")
        if dkey and not index_date_in_range(row.get(dkey, ""), start_iso, end_iso):
            return False
        okey = cmap.get("ocean")
        if not okey:
            return False
        oc = (row.get(okey, "") or "").strip().upper()
        if oc != ocean_letter:
            return False
        return True

    log("FILTER: scanning core rows")
    selected = []
    kept_core = 0
    for r in core_rows:
        if keep_row(r, core_map):
            f = (r.get(core_map.get("file", ""), "") or "").strip()
            if f:
                selected.append(f)
                kept_core += 1
    log(f"FILTER: kept core {kept_core} rows")

    if args.bgc and bgc_rows:
        if "ocean" not in bgc_map:
            log("WARN: BGC index missing 'ocean' column; skipping BGC")
        else:
            log("FILTER: scanning BGC rows")
            kept_bgc = 0
            for r in bgc_rows:
                if keep_row(r, bgc_map):
                    f = (r.get(bgc_map.get("file", ""), "") or "").strip()
                    if f:
                        selected.append(f)
                        kept_bgc += 1
            log(f"FILTER: kept BGC {kept_bgc} rows")

    log("DEDUP: building unique list")
    rel_paths = []
    seen = set()
    for f in selected:
        if f and f not in seen:
            seen.add(f)
            rel_paths.append(f)
    log(f"SELECTED: {len(rel_paths)} files to download")

    if not rel_paths:
        log("EMPTY: no matches. Adjust --start/--end or --ocean.")
        return

    servers_to_use = [args.server] if args.server else MIRRORS
    ensure_dir(os.path.join(args.dest, "dac"))

    ok = 0
    fail = 0
    log(f"DOWNLOAD: start with workers={args.workers}, timeout={args.timeout}s")
    with ThreadPoolExecutor(max_workers=max(1, int(args.workers))) as ex:
        futs = [ex.submit(download_file_from_any, servers_to_use, rp, args.dest, args.timeout, args.insecure) for rp in rel_paths]
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                rp, success, msg, srv = fut.result()
            except Exception as e:
                success, msg, srv, rp = False, str(e), None, "<unknown>"
            origin = f" [{srv}]" if srv else ""
            if success:
                ok += 1
                log(f"[OK {ok}] {rp}{origin}  {msg}")
            else:
                fail += 1
                log(f"[FAIL {fail}] {rp}{origin}  {msg}")

    log(f"DONE: OK={ok} FAIL={fail} PATH={os.path.join(args.dest, 'dac')}")

if __name__ == "__main__":
    main()
