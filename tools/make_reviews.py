"""스마트스토어 리뷰 엑셀 → reviews.json + reviews.html 정적 영역 갱신.

사용법 (스마트스토어센터 > 리뷰 관리 > 엑셀 다운, 여러 파일이면 모두):
    python -I tools/make_reviews.py 리뷰1.xlsx 리뷰2.xlsx ...

- 리뷰글번호로 중복 제거, 전시상태 '정상'만.
- 통계(개수·평균·별점 분포)는 전체 리뷰 기준으로 계산해 그대로 보여 준다.
- 목록(카드)에는 4~5점 후기만 넣는다(2026-11-27 대표님 결정).
- AI·검색 크롤러는 자바스크립트를 실행하지 않는 경우가 많아서, 후기 글과 구조화 데이터를
  reviews.html 안에 정적으로 써 넣는다(<!-- REVIEWS:... --> 표시 사이를 통째로 바꿈).
- 엑셀 원본(주문번호 포함)은 저장소에 넣지 않는다.
"""
import html
import json
import re
import sys
import warnings
from pathlib import Path

warnings.simplefilter("ignore")
sys.path.insert(1, "C:/yuja-shipping-automation/vendor")
import openpyxl  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MIN_SHOW = 4
SCHEMA_REVIEWS = 20


def category(name):
    if "에이드" in name:
        return "유자에이드"
    if any(k in name for k in ("유자청", "스프레드", "잼")):
        return "유자청"
    if "레드향" in name:
        return "레드향"
    if "유자" in name:
        return "유자 생과"
    return "기타"


def load(paths):
    rows = {}
    for p in paths:
        ws = openpyxl.load_workbook(p).active
        it = ws.iter_rows(values_only=True)
        hdr = next(it)
        for r in it:
            d = dict(zip(hdr, r))
            if d.get("리뷰글번호"):
                rows[d["리뷰글번호"]] = d
    out = []
    for d in rows.values():
        text = (d.get("리뷰상세내용") or "").strip()
        if d.get("전시상태") != "정상" or not text:
            continue
        y, m, dd = re.match(r"(\d{4})\.(\d{2})\.(\d{2})", d["리뷰등록일"]).groups()
        out.append({
            "name": d.get("등록자") or "",
            "platform": "네이버 스마트스토어",
            "rating": int(d["구매자평점"]),
            "text": text,
            "date": f"{y}-{m}-{dd}",
            "product": category(d.get("상품명") or ""),
        })
    out.sort(key=lambda x: x["date"], reverse=True)
    return out


def replace_block(src, tag, body):
    pat = re.compile(rf"(<!-- REVIEWS:{tag} -->).*?(<!-- /REVIEWS:{tag} -->)", re.S)
    if not pat.search(src):
        raise SystemExit(f"reviews.html에 REVIEWS:{tag} 표시가 없습니다")
    return pat.sub(lambda m: m.group(1) + "\n" + body + "\n" + m.group(2), src)


def main(paths):
    allr = load(paths)
    n = len(allr)
    avg = sum(r["rating"] for r in allr) / n
    dist = {s: sum(1 for r in allr if r["rating"] == s) for s in range(5, 0, -1)}
    shown = [r for r in allr if r["rating"] >= MIN_SHOW]
    summary = {
        "count": n,
        "average": round(avg, 2),
        "distribution": dist,
        "shownMinRating": MIN_SHOW,
        "source": "네이버 스마트스토어 구매 후기",
        "updated": allr[0]["date"],
    }
    (ROOT / "reviews.json").write_text(
        json.dumps({"summary": summary, "reviews": shown}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")

    e = html.escape
    schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "순수유자 고흥 유기농 유자",
        "description": "전남 고흥에서 17년 유기농으로 키운 유자 생과와 유자청",
        "brand": {"@type": "Brand", "name": "순수유자"},
        "url": "https://organicyuja.com/reviews",
        "aggregateRating": {"@type": "AggregateRating", "ratingValue": f"{avg:.1f}",
                            "reviewCount": n, "bestRating": 5, "worstRating": 1},
        "review": [{
            "@type": "Review",
            "author": {"@type": "Person", "name": r["name"]},
            "datePublished": r["date"],
            "reviewRating": {"@type": "Rating", "ratingValue": r["rating"], "bestRating": 5},
            "reviewBody": r["text"],
        } for r in shown[:SCHEMA_REVIEWS]],
    }
    schema_html = ('    <script type="application/ld+json">\n    '
                   + json.dumps(schema, ensure_ascii=False).replace("</", "<\\/") + "\n    </script>")

    dist_txt = " · ".join(f"{s}점 {c:,}개" for s, c in dist.items())
    summary_html = (
        f'                <p class="review-static-summary">네이버 스마트스토어 구매 후기 {n:,}개, '
        f'평균 별점 {avg:.1f}점 ({dist_txt}). 아래 목록은 그중 {MIN_SHOW}~5점 후기 {len(shown):,}개입니다. '
        f'(기준일 {summary["updated"]})</p>')

    cards = []
    for r in shown:
        stars = "★" * r["rating"] + "☆" * (5 - r["rating"])
        cards.append(
            '<article class="review-card"><div class="review-card-head">'
            f'<span class="review-card-stars" aria-label="별점 {r["rating"]}점">{stars}</span>'
            f'<span class="review-card-name">{e(r["name"])}</span></div>'
            f'<p class="review-card-body">{e(r["text"])}</p>'
            f'<p class="review-card-date">{e(r["product"])} · <time datetime="{r["date"]}">{r["date"]}</time> · {e(r["platform"])}</p>'
            '</article>')

    p = ROOT / "reviews.html"
    src = p.read_text(encoding="utf-8")
    src = replace_block(src, "SCHEMA", schema_html)
    src = replace_block(src, "SUMMARY", summary_html)
    src = replace_block(src, "LIST", "\n".join(cards))
    p.write_text(src, encoding="utf-8")
    print(f"전체 {n}개 평균 {avg:.2f} / 목록 {len(shown)}개 / {dist}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1:])
