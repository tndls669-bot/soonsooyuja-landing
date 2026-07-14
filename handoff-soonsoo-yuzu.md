# 순수유자(Soonsoo Yuzu) 랜딩 페이지 개발 핸드오프 문서 (Handoff Document)

본 문서는 에코 프리미엄 유기농 유자 브랜드 **'순수유자(Soonsoo Yuzu)'**의 싱글 페이지 랜딩 웹사이트 개발 현황을 요약하고, 다음 작업을 수행할 에이전트가 신속하게 컨텍스트를 파악하고 이어서 작업할 수 있도록 지원하기 위해 작성되었습니다.

---

## 1. 프로젝트 개요 & 디자인 시스템
- **목표**: 유기농 유자 브랜드의 가치와 레몬첼로 시즌 에이드 키트를 소개하는 고품격 미니멀리즘 랜딩 페이지 구축.
- **기획 및 규칙 가이드**: [랜딩페이지.md](file:///c:/Users/User/Desktop/채수인/랜딩페이지.md)
- **핵심 컨셉**: 에코 프리미엄 미니멀리즘 (Eco-Premium Minimalism)
  - **주 색상**: Olive Green (`#3D5A45`, 유기농 토양), Deep Brown (`#2B221E`, 메인 서체)
  - **보조 색상**: Lemon Yellow (`#F7D060`, 산미 포인트), Aquamarine (`#72B1A1`, 로우슈가 포인트)
  - **배경**: Light Beige (`#FAF6F0`, 미표백 리넨 톤), Matte Warm Paper (`#F4ECE1`)
  - **서체**: Montserrat, Noto Sans KR, Playfair Display (영문 세리프 포인트)
  - 여백(Negative Space)을 50% 이상 활용하는 asymmetrical 레이아웃 적용.

---

## 2. 현재 구현된 파일 구조
- **HTML**: [index.html](file:///c:/Users/User/Desktop/채수인/index.html) — 메타 SEO 구성, 헤더 내비게이션, Hero 섹션, 브랜드 아이덴티티, 레몬첼로 소개, 이용 가이드(시니어 전용 영역 포함), 상품 리스트, 슬라이드 구매 서랍, 토스트 피드백, 친환경 푸터.
- **CSS**: [styles.css](file:///c:/Users/User/Desktop/채수인/styles.css) — 변수 기반 디자인 시스템, 모바일 반응형 쿼리, 시니어 돋보기 모드 오버라이드 스타일, 음료 믹싱 및 탄산 버블 애니메이션 등 스타일 정의.
- **JS**: [script.js](file:///c:/Users/User/Desktop/채수인/script.js) — Intersection Observer 스크롤 페이드인, 로컬 스토리지 연동 시니어 모드 토글, 레몬 첼로 에이드 제조 시뮬레이션(애니메이션 및 버블 생성), 슬라이딩 주문 서랍 수량/금액 계산 및 Toast 유틸리티.

---

## 3. 핵심 기능 설명
### A. 시니어 돋보기 모드 (Senior Mode Toggle)
- **기능**: 헤더 우측의 `돋보기 모드` 버튼을 통해 웹사이트 내 텍스트 크기와 명도 대비를 1.5배 이상 강화.
- **사용자 경험(UX)**: 모드 활성화 시 부드러운 스크롤로 시니어 맞춤 가이드라인 영역([styles.css:L680](file:///c:/Users/User/Desktop/채수인/styles.css#L680))으로 이동하며, 상태는 `localStorage`에 저장되어 페이지 새로고침 시에도 유지됨.

### B. 레몬 첼로 부스터 시뮬레이션 (Beverage Mix Simulation)
- **기능**: '레몬 부스터 주입하기' 버튼을 누르면 유리병 형태의 UI에 레몬즙 높이가 차오르며 섞이고, 고밀도 탄산 버블이 아래에서 위로 생성되는 모션 그래픽 위젯 구현.
- **구현 세부사항**: [script.js:L71-L142](file:///c:/Users/User/Desktop/채수인/script.js#L71-L142) 및 [styles.css:L441-L587](file:///c:/Users/User/Desktop/채수인/styles.css#L441-L587) 참조.

### C. 프리미엄 장바구니/결제 서랍 (Sliding Purchase Drawer)
- **기능**: 각 상품 카드에서 '바로 구매하기'를 누르면 우측에서 스르륵 나타나는 슬라이드 결제 폼. 수량 증감 기능에 따라 결제 금액이 실시간 동적으로 계산되며, 주문 완료 시 토스트 알림을 제공함.

---

## 4. 권장 추가 작업 & 피드백 필요 사항
1. **반응형 검증 및 UI 디테일**: 데스크톱과 모바일 해상도(320px ~ 1920px) 간의 레이아웃 흐름 검증.
2. **이미지 리소스 최적화**: 현재 `images/` 폴더 내에 배치된 이미지 플레이스홀더(`hero_product.png`, `brand_identity.png`, `seasonal_solution.png` 등)가 최적화된 고급 에셋으로 적절히 로드되는지 확인.
3. **주문 폼 처리**: 현재 더미 데이터로 작동하고 있는 `checkoutForm` 전송 시 서버 전송 로직 또는 로컬 테스트용 로깅 추가.

---

## 5. 제안 기술 (Suggested Skills)
새로운 에이전트가 다음 단계를 수행할 때 아래 도구/기술을 활용할 것을 제안합니다:
- **`run_command`**: 로컬 서버(예: `npx live-server` 또는 `python -m http.server`)를 기동하여 변경 사항을 실시간으로 확인합니다.
- **`browser_subagent`**: 시니어 모드 토글, 음료 시뮬레이션 및 슬라이딩 서랍의 인터랙션 애니메이션이 정상 동작하는지 브라우저에서 가상 테스팅을 수행합니다.
- **`replace_file_content`**: 반응형 중단점 수정 또는 폼 검증 로직 등의 세부 소스코드 수정이 필요할 경우 활용합니다.
