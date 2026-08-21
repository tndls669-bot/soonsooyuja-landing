document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       1. Scroll Fade-in Animation (Intersection Observer)
       ========================================================================== */
    const fadeElements = document.querySelectorAll('.fade-in-up, .fade-in-right');
    
    const observerOptions = {
        root: null,
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Trigger once
            }
        });
    }, observerOptions);
    
    fadeElements.forEach(element => {
        scrollObserver.observe(element);
    });

    /* ==========================================================================
       Brand Closing Section (replays on every re-entry)
       ========================================================================== */
    const closingSection = document.getElementById('brand-closing');
    const closingHeaderEl = document.querySelector('.main-header');

    if (closingSection) {
        const closingObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Hide the fixed header entirely while the closing section is in view
                // (it has no nav by design; a floating header would clip the centered quote)
                if (closingHeaderEl) {
                    closingHeaderEl.classList.toggle('header-hidden', entry.isIntersecting);
                }

                if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
                    closingSection.classList.add('is-active');
                } else if (!entry.isIntersecting) {
                    closingSection.classList.remove('is-active');
                }
            });
        }, {
            root: null,
            threshold: [0, 0.4, 0.5]
        });

        closingObserver.observe(closingSection);
    }



    /* ==========================================================================
       Transparent Header over Hero (solidifies past the hero section)
       ========================================================================== */
    const mainHeader = document.querySelector('.main-header');
    const heroSectionEl = document.getElementById('hero');

    if (mainHeader && heroSectionEl) {
        const updateHeaderState = () => {
            const threshold = 60;
            mainHeader.classList.toggle('scrolled', window.scrollY > threshold);
        };

        window.addEventListener('scroll', updateHeaderState);
        window.addEventListener('resize', updateHeaderState);
        updateHeaderState();
    }

    /* ==========================================================================
       Mobile Nav Toggle
       ========================================================================== */
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const mobileNavPanel = document.getElementById('mobile-nav-panel');

    if (btnMobileMenu && mobileNavPanel) {
        btnMobileMenu.addEventListener('click', () => {
            const isOpen = mobileNavPanel.classList.toggle('open');
            btnMobileMenu.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        mobileNavPanel.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', () => {
                mobileNavPanel.classList.remove('open');
                btnMobileMenu.setAttribute('aria-expanded', 'false');
            });
        });
    }

    /* ==========================================================================
       4. Premium Shopping Drawer (Cart-based Purchase Flow)
       ========================================================================== */
    const buyButtons = document.querySelectorAll('.btn-buy');
    const purchaseDrawer = document.getElementById('purchase-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const btnOpenCart = document.getElementById('btn-open-cart');
    const cartBadge = document.getElementById('cart-badge');

    const cartItemsList = document.getElementById('cart-items-list');
    const cartEmptyState = document.getElementById('cart-empty-state');
    const cartTotalRow = document.getElementById('cart-total-row');
    const cartTotalPriceEl = document.getElementById('cart-total-price');
    const methodSelectionBox = document.getElementById('method-selection-box');
    const orderSummaryList = document.getElementById('order-summary-list');
    const totalPriceVal = document.getElementById('total-price-val');

    const checkoutForm = document.getElementById('checkout-form');

    let cart = []; // { name, price, qty }
    const SHIPPING_FEE = 0;

    function cartTotal() {
        const itemsTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        return cart.length ? itemsTotal + SHIPPING_FEE : 0;
    }

    function updateCartBadge() {
        const count = cart.reduce((sum, item) => sum + item.qty, 0);
        if (count > 0) {
            cartBadge.textContent = count;
            cartBadge.style.display = 'flex';
        } else {
            cartBadge.style.display = 'none';
        }
    }

    function addToCart(name, price) {
        const existing = cart.find(item => item.name === name);
        if (existing) {
            existing.qty++;
        } else {
            cart.push({ name, price, qty: 1 });
        }
        updateCartBadge();
        showToast(`'${name}'이(가) 장바구니에 담겼습니다.`);
    }

    function renderCartStep() {
        cartItemsList.innerHTML = '';
        const hasItems = cart.length > 0;

        cartEmptyState.style.display = hasItems ? 'none' : 'block';
        cartItemsList.style.display = hasItems ? 'flex' : 'none';
        cartTotalRow.style.display = hasItems ? 'flex' : 'none';
        methodSelectionBox.style.display = hasItems ? 'flex' : 'none';

        cart.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'cart-item';
            row.innerHTML = `
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">${item.price.toLocaleString()}원</span>
                </div>
                <div class="cart-item-actions">
                    <div class="qty-selector">
                        <button type="button" class="cart-qty-minus" data-index="${index}">-</button>
                        <span>${item.qty}</span>
                        <button type="button" class="cart-qty-plus" data-index="${index}">+</button>
                    </div>
                    <button type="button" class="cart-item-remove" data-index="${index}" aria-label="삭제">✕</button>
                </div>
            `;
            cartItemsList.appendChild(row);
        });

        cartTotalPriceEl.textContent = cartTotal().toLocaleString() + '원';
    }

    cartItemsList.addEventListener('click', (e) => {
        const minusBtn = e.target.closest('.cart-qty-minus');
        const plusBtn = e.target.closest('.cart-qty-plus');
        const removeBtn = e.target.closest('.cart-item-remove');

        if (minusBtn) {
            const idx = parseInt(minusBtn.dataset.index, 10);
            if (cart[idx].qty > 1) {
                cart[idx].qty--;
            } else {
                cart.splice(idx, 1);
            }
        } else if (plusBtn) {
            const idx = parseInt(plusBtn.dataset.index, 10);
            if (cart[idx].qty < 99) cart[idx].qty++;
        } else if (removeBtn) {
            const idx = parseInt(removeBtn.dataset.index, 10);
            cart.splice(idx, 1);
        } else {
            return;
        }

        updateCartBadge();
        renderCartStep();
    });

    // Add to cart
    buyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();

            const tierGroup = btn.getAttribute('data-tier-group');
            if (tierGroup) {
                const checkedTier = document.querySelector(`input[name="${tierGroup}"]:checked`);
                if (!checkedTier) return;
                const [weight, price] = checkedTier.value.split('|');
                const productBase = btn.getAttribute('data-product-base') || '';
                addToCart(`${productBase} (${weight}, 예약)`, parseInt(price, 10));
                return;
            }

            const productName = btn.getAttribute('data-product');
            const price = parseInt(btn.getAttribute('data-price'), 10) || 23000;
            addToCart(productName, price);
        });
    });

    // Open cart drawer
    btnOpenCart.addEventListener('click', () => {
        renderCartStep();
        openCartDrawer();
    });

    // Close Drawer
    btnCloseDrawer.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    function openCartDrawer() {
        const step1 = document.getElementById('drawer-step-1');
        const step2 = document.getElementById('drawer-step-2');
        step1.style.display = 'block';
        step2.style.display = 'none';

        purchaseDrawer.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock body scroll
    }

    function closeDrawer() {
        purchaseDrawer.classList.remove('active');
        document.body.style.overflow = ''; // Unlock scroll
    }

    // Step switching events
    const btnGoDirectOrder = document.getElementById('btn-go-direct-order');
    const btnPrevStep = document.getElementById('btn-prev-step');
    const drawerStep1 = document.getElementById('drawer-step-1');
    const drawerStep2 = document.getElementById('drawer-step-2');

    if (btnGoDirectOrder && btnPrevStep) {
        btnGoDirectOrder.addEventListener('click', () => {
            if (cart.length === 0) return;
            renderOrderSummary();
            drawerStep1.style.display = 'none';
            drawerStep2.style.display = 'block';
        });

        btnPrevStep.addEventListener('click', () => {
            drawerStep2.style.display = 'none';
            drawerStep1.style.display = 'block';
        });
    }

    function renderOrderSummary() {
        orderSummaryList.innerHTML = '';
        cart.forEach(item => {
            const row = document.createElement('div');
            row.className = 'order-summary-item';
            row.innerHTML = `<span>${item.name} x ${item.qty}</span><span>${(item.price * item.qty).toLocaleString()}원</span>`;
            orderSummaryList.appendChild(row);
        });

        const total = cartTotal();
        totalPriceVal.textContent = total.toLocaleString() + '원';

        const copyTotalAmountEl = document.getElementById('copy-total-amount');
        if (copyTotalAmountEl) {
            copyTotalAmountEl.textContent = total.toLocaleString() + '원';
        }
    }

    // Integrated Clipboard Copy Event (Account + Price)
    const btnCopyAccount = document.getElementById('btn-copy-account');
    if (btnCopyAccount) {
        btnCopyAccount.addEventListener('click', () => {
            const totalAmount = cartTotal();
            const bankAccountInfo = "카카오뱅크 3333-19-3570222 채수인";
            const textToCopy = `${bankAccountInfo} ${totalAmount.toLocaleString()}원`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast("입금 계좌번호와 총 결제금액이 복사되었습니다. 📋");
            }).catch(err => {
                console.error("클립보드 복사 실패:", err);
                showToast("복사에 실패했습니다. 수동으로 복사해 주세요.");
            });
        });
    }

    // Submit Order Handler
    if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const buyerName = document.getElementById('buyer-name').value;
        const buyerPhone = document.getElementById('buyer-phone').value;
        const buyerAddress = document.getElementById('buyer-address').value;
        const totalAmount = cartTotal();
        const productSummary = cart.map(item => `${item.name} x${item.qty}`).join(', ');
        const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

        closeDrawer();

        // Auto-copy bank account number to clipboard
        const bankAccountInfo = "카카오뱅크 3333-19-3570222 채수인";
        navigator.clipboard.writeText(bankAccountInfo).then(() => {
            console.log("계좌 정보가 클립보드에 복사되었습니다.");
        }).catch(err => {
            console.error("클립보드 복사 실패:", err);
        });

        // Send order data via Google Apps Script (sends from the owner's own Gmail account)
        fetch('https://script.google.com/macros/s/AKfycbwY2hbsdbyYvzaStNvOGll596Lw07UjZBV6dRMojPUHK83oBiVK5NyG2sYmXVB3y2r0/exec', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                name: buyerName,
                phone: buyerPhone,
                address: buyerAddress,
                product: productSummary,
                qty: totalQty,
                total: totalAmount
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log("주문 이메일 발송 응답:", data);
        })
        .catch(err => {
            console.error("주문 이메일 발송 요청 실패:", err);
        });

        // Show thank you message with bank account info (clipboard auto-copied)
        setTimeout(() => {
            showToast(`${buyerName}님, 총 ${totalAmount.toLocaleString()}원 주문 완료! [${bankAccountInfo}]으로 입금해 주시면 확인 후 즉시 배송이 시작됩니다. (계좌번호 자동 복사 및 주문내역 접수 완료)`);
            console.log("주문자 정보:", {
                name: buyerName,
                phone: buyerPhone,
                address: buyerAddress,
                product: productSummary,
                qty: totalQty,
                total: totalAmount
            });
            checkoutForm.reset();
            cart = [];
            updateCartBadge();
        }, 600);
    });
    }

    /* ==========================================================================
       5. Reusable Toast Notification Utility
       ========================================================================== */
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    let toastTimeout = null;
    
    function showToast(message) {
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }
        
        toastMsg.textContent = message;
        toast.classList.add('active');
        
        toastTimeout = setTimeout(() => {
            toast.classList.remove('active');
        }, 8000);
    }

    /* ==========================================================================
       6. Swiper Slider & Certificate Modal Restoration
       ========================================================================== */
    
    // Swiper Slider Init
    if (typeof Swiper !== 'undefined') {
        const swiper = new Swiper(".sySwiper", {
            loop: true,
            effect: "fade",
            speed: 2000,
            autoplay: { delay: 4500, disableOnInteraction: false },
            pagination: { el: ".swiper-pagination", clickable: true },
            navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
        });

        // Product Shop Swiper: swipeable on mobile, static 3-column layout on desktop/tablet
        const shopSwiper = new Swiper(".shopSwiper", {
            slidesPerView: 1.25,
            spaceBetween: 16,
            speed: 500,
            pagination: { el: ".shop-pagination", clickable: true },
            breakpoints: {
                769: {
                    slidesPerView: 3,
                    spaceBetween: 40,
                    allowTouchMove: false,
                }
            }
        });

        // One-time "swipe hint" nudge on mobile so users notice the shop cards are swipeable
        setTimeout(() => {
            if (window.matchMedia('(max-width: 768px)').matches) {
                shopSwiper.slideTo(1, 450);
                setTimeout(() => shopSwiper.slideTo(0, 450), 750);
            }
        }, 1000);
    }

    // Modal data for certificates
    const certData = {
        organic: { url: 'https://cdn.imweb.me/thumbnail/20260308/2886f11dc03f9.jpg', title: '유기농 농산물 인증서' },
        pesticide: { url: 'https://cdn.imweb.me/thumbnail/20260308/5a193f367b090.jpg', title: '잔류농약 성적서 (불검출)' },
        lowcarbon: { url: 'https://cdn.imweb.me/thumbnail/20260308/1581519485333.jpeg', title: '저탄소 농산물 인증서' },
        license: { url: 'images/organic_license.jpg', title: '유기농업 자격증' }
    };

    window.openSyModal = function(type) {
        const modal = document.getElementById('syModal');
        const modalImg = document.getElementById('syModalImg');
        const modalTitle = document.getElementById('syModalTitle');
        
        if (modal && modalImg && modalTitle) {
            modalImg.src = certData[type].url;
            modalTitle.innerText = certData[type].title;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Lock scrolling
        }
    };

    window.closeSyModal = function() {
        const modal = document.getElementById('syModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Unlock scrolling
        }
    };

    // FAQ Accordion Toggle
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.parentElement;
            const isActive = item.classList.contains('active');
            
            // Close other items
            document.querySelectorAll('.faq-item').forEach(faqItem => {
                faqItem.classList.remove('active');
                const answer = faqItem.querySelector('.faq-answer');
                if (answer) answer.style.maxHeight = null;
            });
            
            // Open clicked item if it wasn't active
            if (!isActive) {
                item.classList.add('active');
                const answer = item.querySelector('.faq-answer');
                if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });

    // Info & Delivery Tabs Toggle
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Toggle active buttons
            tabButtons.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle active content panes
            tabPanes.forEach(pane => {
                if (pane.id === targetTab) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });


    // Monthly Calendar Data
    const monthlyCalendarData = {
        1: {
            badge: "토양 관리 / 영양 공급",
            badgeClass: "badge-green",
            title: "1월: 유기농 퇴비 살포 및 토양 관리",
            desc: "대를 이어온 17년 무농약 유자밭 토양에 유기농 퇴비를 골고루 살포하여 봄철 성장을 위한 풍부한 영양분을 채워넣는 단계입니다. <strong>화학 합성 비료를 1%도 섞지 않은</strong> 비옥한 대지의 기운을 다집니다.",
            imgSrc: "images/calendar/month-1.jpg?v=3.6",
            subHtml: `<div class="info-tag-box">
                        <span class="info-tag">🌱 유기농 원칙: 토양의 생명력이 건강한 유기농 유자 껍질을 만듭니다.</span>
                      </div>`
        },
        2: {
            badge: "과수 관리",
            badgeClass: "badge-green",
            title: "2월: 전정 작업 (가지치기)",
            desc: "불필요하게 뻗어 수확을 방해하거나 얼어붙은 나뭇가지를 정리하여 햇빛과 바람 길을 열어주는 핵심 기초 작업입니다. 가지치기를 통해 <strong>병해충 자생력을 자연적으로 확보</strong>합니다.",
            imgSrc: "images/calendar/month-2.jpg?v=3.6",
            subHtml: `<div class="info-tag-box">
                        <span class="info-tag">💡 유기농 꿀팁: 화학 농약을 일절 쓰지 않기 때문에 가지치기를 통한 통풍 확보가 최고의 예방입니다.</span>
                      </div>`
        },
        3: {
            badge: "생육 관리",
            badgeClass: "badge-green",
            title: "3월: 봄 가지 신장 및 생육 유도",
            desc: "따스한 봄볕을 맞으며 땅속 영양분이 가지 끝까지 오르고 새로운 봄 가지가 힘차게 뻗어나가는 시기입니다. 연약한 초기 가지가 튼튼하게 자라도록 집중 케어합니다.",
            imgSrc: "images/calendar/month-3.jpg?v=3.6",
            subHtml: ""
        },
        4: {
            badge: "생육 관리",
            badgeClass: "badge-green",
            title: "4월: 신초(새순) 발아 및 면역 증대",
            desc: "연두빛 싱그러운 신초(새순)가 돋아나며 과수원 전체가 푸른 생명력으로 덮입니다. 유자 잎사귀 하나하나가 고유의 향과 영양 성분을 가득 머금을 수 있도록 미생물 자재를 살포합니다.",
            imgSrc: "images/calendar/month-4.jpg?v=3.6",
            subHtml: ""
        },
        5: {
            badge: "개화기",
            badgeClass: "badge-green",
            title: "5월: 향긋한 유자꽃 개화",
            desc: "하얗고 청초한 유자꽃이 흐드러지게 피어납니다. 고흥 해풍을 타고 흩날리는 은은하고 향긋한 꽃향기가 과수원을 가득 채우는 일 년 중 가장 수려한 계절입니다.",
            imgSrc: "images/calendar/month-5.jpg?v=3.6",
            subHtml: ""
        },
        6: {
            badge: "결실기",
            badgeClass: "badge-green",
            title: "6월: 착과 (열매 맺힘)",
            desc: "꽃이 진 자리에 파랗고 앙증맞은 어린 청유자 열매가 맺히기 시작합니다. 낙과를 방지하고 건강한 열매로 자라도록 적정 수분량과 영양 배분을 섬세하게 조절합니다.",
            imgSrc: "images/calendar/month-6.jpg?v=3.6",
            subHtml: ""
        },
        7: {
            badge: "유기농 해충 방제",
            badgeClass: "badge-green",
            title: "7월: 해충 방제기 및 과실 관리",
            desc: "고온 다습한 여름 기후로 인해 병해충 활동이 가장 왕성해지는 방제 집중기입니다. 화학 합성농약을 전혀 쓰지 않는 순수유자는 국가 인증을 획득한 <strong>친환경 유기농업자재와 천연 추출물</strong>만을 사용해 안전하게 예방합니다.",
            imgSrc: "images/calendar/month-7.jpg?v=3.6",
            subHtml: `<div class="info-tag-box">
                        <span class="info-tag">🛡️ 순수유자 안심 약속: 화학 살충제나 농약 0%로 껍질까지 물에 쓱 씻어 드실 수 있습니다.</span>
                      </div>`
        },
        8: {
            badge: "청유자 수확 시작",
            badgeClass: "badge-green",
            title: "8월: 청유자 수확 및 출하 시작 (8월 23일~)",
            desc: "8월 23일경부터 본격적인 청유자 수확과 공급을 개시합니다. 유즈코쇼 등을 만들기 위해 유기농 풋유자의 강렬한 그린 향을 그대로 담은 <strong>최상급 원물만을 선별</strong>하여 출하합니다.",
            imgSrc: "images/calendar/month-8.jpg?v=3.6",
            subHtml: `<div class="spec-grid">
                        <div class="spec-item">
                            <span class="spec-size">소과 (40g ~ 60g 미만)</span>
                            <p class="spec-desc">풋유자 특유의 알싸하고 짜릿한 야생 향이 강력해 정통 유즈코쇼 제조용으로 적극 추천합니다.</p>
                        </div>
                      </div>`
        },
        9: {
            badge: "청유자 출하",
            badgeClass: "badge-green",
            title: "9월: 방제 집중기 무농약 원물 수확",
            desc: "관행 재배의 농약 대량 살포가 이어지는 시기에도 순수유자는 <strong>100% 친환경 유기농법을 철저히 유지</strong>합니다. 과즙량이 풍부해지기 시작하는 청유자 대과를 안심하고 만나실 수 있습니다.",
            imgSrc: "images/calendar/month-9.jpg?v=3.6",
            subHtml: `<div class="spec-grid">
                        <div class="spec-item">
                            <span class="spec-size">대과 (60g ~ 90g 이하)</span>
                            <p class="spec-desc">과육이 발달해 청유자 에이드나 새콤한 수제 청을 대량으로 담그는 용도에 알맞습니다.</p>
                        </div>
                      </div>`
        },
        10: {
            badge: "청유자 끝물 / 착색기",
            badgeClass: "badge-green",
            title: "10월: 청유자 끝물 및 황유자 착색기",
            desc: "청유자가 황금색으로 무르익는 착색 과정이 급격히 진행됩니다. 이 시기 껍질이 점차 노래지면서 숨어있던 자연스러운 바람 흉터와 반점이 도드라져 보일 수 있으나, 맛과 품질은 최상입니다.",
            imgSrc: "images/calendar/month-10.jpg?v=3.6",
            subHtml: `<div class="notice-box notice-green">
                        <h5>⚠️ [10월 청유자 수령 안내]</h5>
                        <p>끝물 수확분은 껍질 일부가 노랗고 자연 흉터가 두드러질 수 있으나, 이는 완숙 과정의 자연스러운 특징이며 속 품질에는 이상이 없습니다.</p>
                      </div>`
        },
        11: {
            badge: "황유자 본격 수확",
            badgeClass: "badge-yellow",
            title: "11월: 황유자 수확 및 가공 개시",
            desc: "11월 초순부터 황금빛 완숙 유자를 수확하여 프리미엄 유자청 및 에이드 키트 가공에 나섭니다. 수확 초기에는 싱그럽고 상큼한 그린 노트(Green Note)의 향미를 느끼실 수 있습니다.",
            imgSrc: "images/calendar/month-11.jpg?v=3.6",
            subHtml: `<div class="info-tag-box yellow-border">
                        <span class="info-tag">🍊 향미 추천: 풋풋하고 상쾌한 향이 살아있는 싱그러운 유자청을 원하시면 11월 첫 수확 가공분을 추천합니다.</span>
                      </div>`
        },
        12: {
            badge: "황유자 완숙기",
            badgeClass: "badge-yellow",
            title: "12월: 완숙 황유자 수확 종료 및 생산 마감",
            desc: "유자 본연의 화려하고 진한 완숙 향이 가득 차오르는 수확 절정기입니다. 12월 말 수확이 종료될 때까지 정성스레 수확한 원물을 가공해 당해 연도 유자 생산 일정을 종료합니다.",
            imgSrc: "images/calendar/month-12.jpg?v=3.6",
            subHtml: `<div class="info-tag-box yellow-border">
                        <span class="info-tag">🍊 향미 추천: 깊고 묵직하며 달콤함이 최고조에 달한 오리지널 완숙 유자의 향을 느껴보세요.</span>
                      </div>`
        }
    };

    const monthItems = document.querySelectorAll('.month-card');
    const detailsTitle = document.getElementById('details-title');
    const detailsDesc = document.getElementById('details-desc');
    const detailsSub = document.getElementById('details-sub');
    const detailsCard = document.getElementById('month-details-card');
    const detailsImg = document.getElementById('details-img');
    const detailsImgPlaceholder = document.getElementById('details-img-placeholder');

    function updateMonthDetails(monthNum, isInitialLoad = false) {
        const data = monthlyCalendarData[monthNum];
        if (!data) return;

        // Toggle active class on monthly timeline elements
        monthItems.forEach(item => {
            if (parseInt(item.getAttribute('data-month')) === parseInt(monthNum)) {
                item.classList.add('active');
                // Smoothly center the active month card inside the horizontal scroll container
                // without scrolling the page vertically.
                setTimeout(() => {
                    const wrapper = document.querySelector('.monthly-timeline-wrapper');
                    if (wrapper) {
                        const wrapperWidth = wrapper.offsetWidth;
                        const cardOffsetLeft = item.offsetLeft;
                        const cardWidth = item.offsetWidth;
                        const targetScrollLeft = cardOffsetLeft - (wrapperWidth / 2) + (cardWidth / 2);
                        
                        wrapper.scrollTo({
                            left: targetScrollLeft,
                            behavior: isInitialLoad ? 'auto' : 'smooth'
                        });
                    }
                }, 100);
            } else {
                item.classList.remove('active');
            }
        });

        // Dynamic transition effect for content
        if (detailsCard) {
            detailsCard.style.opacity = '0';
            detailsCard.style.transform = 'translateY(6px)';

            setTimeout(() => {
                // Update text elements
                if (detailsTitle) detailsTitle.textContent = data.title;
                if (detailsDesc) detailsDesc.innerHTML = data.desc;
                if (detailsSub) detailsSub.innerHTML = data.subHtml;

                // Update image sources with loader listeners
                if (detailsImg && detailsImgPlaceholder) {
                    if (data.imgSrc) {
                        detailsImg.onload = function() {
                            detailsImg.style.display = 'block';
                            detailsImgPlaceholder.style.display = 'none';
                        };
                        detailsImg.onerror = function() {
                            detailsImg.style.display = 'none';
                            detailsImgPlaceholder.style.display = 'flex';
                        };
                        detailsImg.src = data.imgSrc;
                    } else {
                        detailsImg.style.display = 'none';
                        detailsImgPlaceholder.style.display = 'flex';
                    }
                }

                detailsCard.style.opacity = '1';
                detailsCard.style.transform = 'translateY(0)';
            }, 120);
        }
    }

    monthItems.forEach(item => {
        item.addEventListener('click', () => {
            const m = item.getAttribute('data-month');
            updateMonthDetails(m, false);
        });
    });

    // Automatically detect, focus, and center the current calendar month
    const defaultMonth = new Date().getMonth() + 1;
    updateMonthDetails(defaultMonth, true);
});
