from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import COL_CASE_CODE, COL_IMPORTANCE, COL_ISSUE_DETAIL, COL_REG_DATE, COL_STATUS, COL_TITLE  # type: ignore
from kpi import calculate_all_kpis, filter_keyword_issues, get_status_masks, prepare_issue_details  # type: ignore
from preprocessing import preprocess_data, read_uploaded_file  # type: ignore

PROMPT_FILE = ROOT / "prompt.txt"

BUSINESS_CONFIG = {
    "MX": {
        "keywords": {
            "system": [r"system", r"crash", r"hang", r"kernel", r"reset", r"reboot"],
            "battery": [r"battery", r"charging", r"sleep current", r"soc"],
            "connectivity": [r"call", r"roaming", r"network", r"wifi", r"gps"],
        }
    },
    "VD": {
        "keywords": {
            "panel": [r"panel", r"brightness", r"flicker", r"color", r"screen"],
            "connectivity": [r"hdmi", r"cec", r"network", r"wifi", r"bluetooth"],
            "app_ux": [r"app", r"ui", r"ux", r"voice", r"smart hub"],
        }
    },
    "DA": {
        "keywords": {
            "cooling": [r"cool", r"freeze", r"temperature", r"defrost"],
            "drive_noise": [r"motor", r"noise", r"vibration", r"compressor"],
            "connectivity": [r"smartthings", r"wifi", r"pairing", r"connection"],
        }
    },
}


def _read_json(path: str) -> pd.DataFrame:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict):
        if isinstance(data.get("rows"), list):
            return pd.DataFrame(data["rows"])
        return pd.DataFrame([data])
    return pd.DataFrame(data)


def _read_with_xlwings(path: str) -> pd.DataFrame:
    try:
        import xlwings as xw
    except Exception as exc:
        raise RuntimeError(
            "Protected XLSX fallback requires local Excel and xlwings."
        ) from exc

    app = xw.App(visible=False, add_book=False)
    app.display_alerts = False
    app.screen_updating = False
    workbook = None
    try:
        workbook = app.books.open(path, update_links=False, read_only=True)
        sheet = workbook.sheets[0]
        values = sheet.used_range.value
        if not values:
            raise ValueError("Excel data is empty.")
        raw_df = pd.DataFrame(values if isinstance(values[0], list) else [values])
        from preprocessing import detect_header_row, promote_header_row  # type: ignore

        return promote_header_row(raw_df, detect_header_row(raw_df))
    finally:
        if workbook is not None:
            try:
                workbook.close()
            except Exception:
                pass
        app.quit()


def load_source(source_path: str, original_file_name: str) -> pd.DataFrame:
    suffix = Path(original_file_name or source_path).suffix.lower()
    if suffix == ".json":
        return _read_json(source_path)

    raw = Path(source_path).read_bytes()
    try:
        return read_uploaded_file(original_file_name or source_path, raw)
    except Exception:
        if suffix == ".xlsx":
            return _read_with_xlwings(source_path)
        raise


def build_keyword_masks(df: pd.DataFrame, business: str) -> dict[str, pd.Series]:
    config = BUSINESS_CONFIG.get(business, BUSINESS_CONFIG["MX"])
    search_cols = [column for column in (COL_TITLE, COL_ISSUE_DETAIL) if column in df.columns]
    if not search_cols:
        return {}
    search_text = df[search_cols].fillna("").astype(str).agg(" ".join, axis=1)
    masks: dict[str, pd.Series] = {}
    for label, patterns in config["keywords"].items():
        pattern = re.compile("|".join(patterns), re.IGNORECASE)
        masks[label] = search_text.str.contains(pattern, regex=True, na=False)
    return masks


def build_trend(df: pd.DataFrame, business: str) -> tuple[list[dict[str, object]], list[str]]:
    if COL_REG_DATE not in df.columns:
        return [], []
    valid = df.copy()
    valid[COL_REG_DATE] = pd.to_datetime(valid[COL_REG_DATE], errors="coerce")
    valid = valid.dropna(subset=[COL_REG_DATE])
    if valid.empty:
        return [], []

    masks = build_keyword_masks(valid, business)
    if not masks:
        return [], []

    base = pd.DataFrame({"date": pd.date_range(valid[COL_REG_DATE].min(), valid[COL_REG_DATE].max(), freq="D")})
    base = base.set_index("date")
    for label, mask in masks.items():
        counts = valid.loc[mask].set_index(COL_REG_DATE).resample("D").size()
        base[label] = counts
    base = base.fillna(0).astype(int).reset_index()
    base["date"] = base["date"].dt.strftime("%Y-%m-%d")
    return base.to_dict(orient="records"), list(masks.keys())


def build_issue_rows(
    current: pd.DataFrame, df_a: pd.DataFrame, df_system: pd.DataFrame, business: str
) -> tuple[list[dict[str, object]], dict[str, int], list[str]]:
    long_unresolved = current.loc[
        get_status_masks(current)["active"]
        & current[COL_REG_DATE].notna()
        & current[COL_REG_DATE].le(pd.Timestamp.now().normalize() - pd.Timedelta(days=7))
    ].copy()
    keyword_issues = prepare_issue_details(filter_keyword_issues(current), recent_days=7)
    masks = build_keyword_masks(current, business)

    categories: list[tuple[str, pd.DataFrame]] = [
        ("A_always", prepare_issue_details(df_a)),
        ("system", prepare_issue_details(df_system)),
        ("long_unresolved", prepare_issue_details(long_unresolved)),
        ("watchlist", keyword_issues),
    ]
    for label, mask in masks.items():
        categories.append((label, prepare_issue_details(current.loc[mask].copy())))

    issues: list[dict[str, object]] = []
    counts: dict[str, int] = {}
    for category, frame in categories:
        counts[category] = len(frame)
        if frame.empty:
            continue
        for _, row in frame.head(20).iterrows():
            raw_date = pd.to_datetime(row.get(COL_REG_DATE), errors="coerce")
            status = str(row.get(COL_STATUS, "")).strip()
            tone = "success"
            if re.search(r"open", status, re.IGNORECASE):
                tone = "critical"
            elif re.search(r"resolve", status, re.IGNORECASE):
                tone = "warning"
            issues.append(
                {
                    "id": str(row.get(COL_CASE_CODE, "")).strip() or "-",
                    "title": str(row.get(COL_TITLE) or row.get(COL_ISSUE_DETAIL) or "Untitled issue").strip(),
                    "keyword": category,
                    "grade": str(row.get(COL_IMPORTANCE, "")).strip() or "-",
                    "status": status or "-",
                    "date": raw_date.strftime("%Y-%m-%d") if pd.notna(raw_date) else "-",
                    "count": 1,
                    "tone": tone,
                    "category": category,
                    "detail": str(row.get(COL_ISSUE_DETAIL, "")).strip(),
                    "cause": str(row.get("root_cause", "")).strip(),
                    "action": str(row.get("action", "")).strip(),
                }
            )

    deduped: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()
    for issue in issues:
        key = (str(issue["id"]), str(issue["category"]))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(issue)
    return deduped, counts, list(counts.keys())


def summarize_signals(df: pd.DataFrame, business: str, kpis: dict[str, float | int]) -> list[dict[str, str]]:
    trend, series_names = build_trend(df, business)
    signals: list[dict[str, str]] = []
    if trend and series_names:
        trend_df = pd.DataFrame(trend)
        for label in series_names[:2]:
            recent = int(trend_df[label].tail(7).sum())
            previous = int(trend_df[label].iloc[max(len(trend_df) - 14, 0): max(len(trend_df) - 7, 0)].sum())
            delta = recent - previous
            signals.append(
                {
                    "title": f"{label} issue delta",
                    "description": f"Recent 7d {recent} / Previous 7d {previous}",
                    "value": f"{delta:+d}",
                    "tone": "rose" if delta > 0 else "mint",
                }
            )
    signals.append(
        {
            "title": "Close ratio",
            "description": f"Close {int(kpis['closeCount'])} / Total {int(kpis['totalCount'])}",
            "value": f"{float(kpis['closeRatio']):.1f}%",
            "tone": "mint" if float(kpis["closeRatio"]) >= 90 else "amber",
        }
    )
    return signals[:3]


def build_prompt_text(
    base_prompt: str, business: str, product: str, kpis: dict[str, float | int], issues: list[dict[str, object]]
) -> str:
    highlight_lines = "\n".join(
        f"- {issue['id']} | {issue['category']} | {issue['status']} | {issue['title']}"
        for issue in issues[:12]
    )
    return (
        f"[business]\n{business}\n\n"
        f"[product]\n{product}\n\n"
        f"[kpi]\n"
        f"- close_ratio: {float(kpis['closeRatio']):.1f}%\n"
        f"- a_always_open: {int(kpis['openCountA'])}\n"
        f"- system_open: {int(kpis['openCountSystem'])}\n\n"
        f"[top_issues]\n{highlight_lines}\n\n"
        f"[base_prompt]\n{base_prompt}"
    )


def build_downloads(preprocessed: pd.DataFrame, prompt_text: str, issues: list[dict[str, object]]) -> dict[str, str]:
    preprocessed_bytes = preprocessed.to_csv(index=False, date_format="%Y-%m-%d").encode("utf-8-sig")
    prompt_bytes = prompt_text.encode("utf-8")
    issues_bytes = pd.DataFrame(issues).to_csv(index=False).encode("utf-8-sig")
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("preprocessed_data.csv", preprocessed_bytes)
        archive.writestr("report_prompt.txt", prompt_bytes)
        archive.writestr("issue_table.csv", issues_bytes)
    return {
        "zipFileName": "for-q-report-assets.zip",
        "zipBase64": base64.b64encode(zip_buffer.getvalue()).decode("ascii"),
        "promptFileName": "report_prompt.txt",
        "promptBase64": base64.b64encode(prompt_bytes).decode("ascii"),
        "preprocessedFileName": "preprocessed_data.csv",
        "preprocessedBase64": base64.b64encode(preprocessed_bytes).decode("ascii"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    source_path = str(payload["sourcePath"])
    business = str(payload["business"])
    product = str(payload["product"])
    original_file_name = str(payload.get("originalFileName") or Path(source_path).name)

    source_df = load_source(source_path, original_file_name)
    current, _failed_dates = preprocess_data(source_df)
    kpis_raw, df_a, df_system = calculate_all_kpis(current)
    kpis = {
        "closeRatio": float(kpis_raw["close_ratio"]),
        "closeCount": int(kpis_raw["close_count"]),
        "totalCount": int(kpis_raw["total_count"]),
        "openCountA": int(kpis_raw["open_count_A"]),
        "activeCountA": int(kpis_raw["active_count_A"]),
        "openCountSystem": int(kpis_raw["open_count_System"]),
        "activeCountSystem": int(kpis_raw["active_count_System"]),
    }
    issues, category_counts, keyword_options = build_issue_rows(current, df_a, df_system, business)
    trend, trend_series = build_trend(current, business)
    base_prompt = PROMPT_FILE.read_text(encoding="utf-8", errors="ignore") if PROMPT_FILE.exists() else ""
    prompt_text = build_prompt_text(base_prompt, business, product, kpis, issues)
    downloads = build_downloads(current, prompt_text, issues)

    dates = pd.to_datetime(current[COL_REG_DATE], errors="coerce")
    min_date = dates.min()
    max_date = dates.max()
    date_range = (
        f"{pd.Timestamp(min_date):%Y.%m.%d} - {pd.Timestamp(max_date):%Y.%m.%d}"
        if pd.notna(min_date) and pd.notna(max_date)
        else "No date info"
    )

    Path(args.output).write_text(
        json.dumps(
            {
                "business": business,
                "product": product,
                "sourceLabel": original_file_name,
                "rowCount": int(len(current)),
                "dateRangeLabel": date_range,
                "kpis": kpis,
                "signals": summarize_signals(current, business, kpis),
                "trendSeries": trend_series,
                "trend": trend,
                "issues": issues,
                "categoryCounts": category_counts,
                "promptText": prompt_text,
                "downloads": downloads,
                "geminiReady": True,
                "geminiHint": "Gemini CLI can be attached through the desktop launcher environment.",
                "keywordOptions": keyword_options,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
