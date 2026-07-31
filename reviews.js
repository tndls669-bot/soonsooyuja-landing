/*
    reviews.json 항목 형식:
    {
        "name": "작성자명 또는 인플루언서명",
        "platform": "인스타그램 / 네이버 블로그 등 출처",
        "rating": 5,          // 1~5 정수
        "text": "후기 본문",
        "date": "2026-07-31"  // YYYY-MM-DD
    }
    이 배열에 항목을 추가/삭제하면 /reviews 페이지와 구조화 데이터(JSON-LD)에 자동 반영됩니다.
*/
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('review-grid');
    const emptyState = document.getElementById('review-empty-state');
    if (!grid) return;

    fetch('reviews.json')
        .then(res => res.json())
        .then(renderReviews)
        .catch(err => {
            console.error('후기 데이터를 불러오지 못했습니다:', err);
            renderReviews([]);
        });

    function renderReviews(reviews) {
        if (!Array.isArray(reviews) || reviews.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        grid.innerHTML = '';

        reviews.forEach(review => {
            const rating = Math.max(1, Math.min(5, Math.round(review.rating) || 0));
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

            const card = document.createElement('div');
            card.className = 'review-card';

            const avatar = document.createElement('div');
            avatar.className = 'review-card-avatar';
            avatar.setAttribute('aria-hidden', 'true');
            avatar.textContent = '🍋';

            const nameEl = document.createElement('p');
            nameEl.className = 'review-card-name';
            nameEl.textContent = review.name || '';
            if (review.platform) {
                const platformEl = document.createElement('span');
                platformEl.className = 'review-card-platform';
                platformEl.textContent = ' · ' + review.platform;
                nameEl.appendChild(platformEl);
            }

            const starsEl = document.createElement('div');
            starsEl.className = 'review-card-stars';
            starsEl.setAttribute('aria-hidden', 'true');
            starsEl.textContent = stars;

            const bodyEl = document.createElement('p');
            bodyEl.className = 'review-card-body';
            bodyEl.textContent = review.text || '';

            card.appendChild(avatar);
            card.appendChild(nameEl);
            card.appendChild(starsEl);
            card.appendChild(bodyEl);

            if (review.date) {
                const dateEl = document.createElement('p');
                dateEl.className = 'review-card-date';
                dateEl.textContent = review.date;
                card.appendChild(dateEl);
            }

            grid.appendChild(card);
        });

        injectReviewSchema(reviews);
    }

    function injectReviewSchema(reviews) {
        const validRatings = reviews.map(r => Math.max(1, Math.min(5, Math.round(r.rating) || 0)));
        const avgRating = (validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length).toFixed(1);

        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': '순수유자',
            'aggregateRating': {
                '@type': 'AggregateRating',
                'ratingValue': avgRating,
                'reviewCount': reviews.length
            },
            'review': reviews.map(r => ({
                '@type': 'Review',
                'author': { '@type': 'Person', 'name': r.name || '' },
                'reviewRating': { '@type': 'Rating', 'ratingValue': Math.max(1, Math.min(5, Math.round(r.rating) || 0)) },
                'reviewBody': r.text || '',
                'datePublished': r.date || undefined
            }))
        };

        const scriptEl = document.createElement('script');
        scriptEl.type = 'application/ld+json';
        scriptEl.textContent = JSON.stringify(schema);
        document.head.appendChild(scriptEl);
    }
});
