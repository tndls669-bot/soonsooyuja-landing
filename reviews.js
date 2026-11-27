/*
    reviews.json = { "summary": {count, average, distribution, shownMinRating, source, updated},
                     "reviews": [ 아래 항목 ... ] }
    tools/make_reviews.py 가 스마트스토어 리뷰 엑셀로 만든다(reviews.html 정적 영역·구조화 데이터도 함께).
    항목 형식:
    {
        "name": "작성자명(네이버처럼 가린 아이디)",
        "platform": "네이버 스마트스토어 / 인스타그램 등 출처",
        "rating": 5,          // 1~5 정수
        "text": "후기 본문",
        "date": "2026-07-31", // YYYY-MM-DD
        "product": "유자 생과" // 상품 분류(필터 버튼에 쓰임)
    }
    통계는 전체 리뷰 기준, 목록은 4~5점 후기만(최신순).
*/
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('review-grid');
    const emptyState = document.getElementById('review-empty-state');
    const summaryEl = document.getElementById('review-summary');
    const filtersEl = document.getElementById('review-filters');
    const moreBtn = document.getElementById('btn-review-more');
    if (!grid) return;

    const PAGE = 12;
    let all = [];
    let filtered = [];
    let shown = 0;
    let currentProduct = '전체';
    let summary = null;

    fetch('reviews.json?v=3')
        .then(res => res.json())
        .then(data => {
            const list = Array.isArray(data) ? data : (data && data.reviews) || [];
            all = list.filter(r => r && r.text);
            summary = data && data.summary ? data.summary : null;
            if (all.length === 0) return showEmpty();
            const staticSummary = document.querySelector('.review-static-summary');
            if (staticSummary) staticSummary.style.display = 'none';
            renderSummary();
            renderFilters();
            applyFilter();
        })
        .catch(err => {
            console.error('후기 데이터를 불러오지 못했습니다:', err);
            showEmpty();
        });

    function clampRating(r) {
        return Math.max(1, Math.min(5, Math.round(r) || 0));
    }

    function showEmpty() {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        if (moreBtn) moreBtn.style.display = 'none';
    }

    function average(list) {
        return list.reduce((s, r) => s + clampRating(r.rating), 0) / list.length;
    }

    function renderSummary() {
        if (!summaryEl) return;
        let count, avg, dist;
        if (summary) {
            count = summary.count; avg = summary.average; dist = summary.distribution;
        } else {
            count = all.length; avg = average(all); dist = {};
            all.forEach(r => { const k = clampRating(r.rating); dist[k] = (dist[k] || 0) + 1; });
        }

        summaryEl.innerHTML = '';
        const left = document.createElement('div');
        left.className = 'review-summary-score';
        const big = document.createElement('strong');
        big.textContent = Number(avg).toFixed(1);
        const stars = document.createElement('div');
        stars.className = 'review-card-stars';
        stars.textContent = '★★★★★';
        const cnt = document.createElement('p');
        cnt.textContent = `네이버 스마트스토어 구매 후기 ${Number(count).toLocaleString()}개 전체 평균`;
        left.append(big, stars, cnt);

        const right = document.createElement('div');
        right.className = 'review-summary-bars';
        for (let s = 5; s >= 1; s--) {
            const c = Number(dist[s] || 0);
            const pct = count ? Math.round(c / count * 100) : 0;
            const row = document.createElement('div');
            row.className = 'review-bar-row';
            row.innerHTML = `<span class="review-bar-label">${s}점</span><span class="review-bar-track"><span class="review-bar-fill" style="width:${pct}%"></span></span><span class="review-bar-count">${c.toLocaleString()}</span>`;
            right.appendChild(row);
        }
        summaryEl.append(left, right);
        summaryEl.style.display = '';
    }

    function renderFilters() {
        if (!filtersEl) return;
        const byProduct = {};
        all.forEach(r => { const p = r.product || '기타'; byProduct[p] = (byProduct[p] || 0) + 1; });
        const names = ['전체', ...Object.keys(byProduct).sort((a, b) => byProduct[b] - byProduct[a])];
        filtersEl.innerHTML = '';
        names.forEach(name => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'review-filter-btn';
            b.dataset.product = name;
            b.textContent = name === '전체' ? `전체 ${all.length.toLocaleString()}` : `${name} ${byProduct[name].toLocaleString()}`;
            b.addEventListener('click', () => {
                currentProduct = name;
                updateActive();
                applyFilter();
            });
            filtersEl.appendChild(b);
        });
        filtersEl.style.display = '';
        updateActive();
    }

    function updateActive() {
        if (filtersEl) filtersEl.querySelectorAll('.review-filter-btn').forEach(b =>
            b.classList.toggle('is-active', b.dataset.product === currentProduct));
    }

    function applyFilter() {
        filtered = all.filter(r =>
            currentProduct === '전체' || (r.product || '기타') === currentProduct);
        grid.innerHTML = '';
        shown = 0;
        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        if (filtered.length === 0) {
            const none = document.createElement('p');
            none.className = 'review-card-date';
            none.style.gridColumn = '1 / -1';
            none.style.textAlign = 'center';
            none.textContent = '이 조건에 해당하는 후기가 없습니다.';
            grid.appendChild(none);
        }
        renderMore();
    }

    function renderMore() {
        const next = filtered.slice(shown, shown + PAGE);
        next.forEach(r => grid.appendChild(makeCard(r)));
        shown += next.length;
        if (moreBtn) {
            const left = filtered.length - shown;
            moreBtn.style.display = left > 0 ? '' : 'none';
            moreBtn.textContent = `후기 더 보기 (${left.toLocaleString()}개 남음)`;
        }
    }

    if (moreBtn) moreBtn.addEventListener('click', renderMore);

    function makeCard(review) {
        const rating = clampRating(review.rating);
        const card = document.createElement('div');
        card.className = 'review-card';

        const head = document.createElement('div');
        head.className = 'review-card-head';
        const starsEl = document.createElement('span');
        starsEl.className = 'review-card-stars';
        starsEl.setAttribute('aria-label', `별점 ${rating}점`);
        starsEl.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        const nameEl = document.createElement('span');
        nameEl.className = 'review-card-name';
        nameEl.textContent = review.name || '';
        head.append(starsEl, nameEl);

        const bodyEl = document.createElement('p');
        bodyEl.className = 'review-card-body';
        bodyEl.textContent = review.text || '';

        const meta = document.createElement('p');
        meta.className = 'review-card-date';
        meta.textContent = [review.product, review.date, review.platform].filter(Boolean).join(' · ');

        card.append(head, bodyEl, meta);
        return card;
    }
});
