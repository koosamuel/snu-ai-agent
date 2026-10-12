# 카페 키오스크 공동 작업 안내

## 1. 기본 원칙

- `main`은 실행 가능한 안정 버전으로 유지합니다.
- 한 브랜치에는 한 기능이나 한 오류 수정만 포함합니다.
- 작업 전 최신 `main`을 받고, 완료 후 Pull Request로 병합합니다.
- 다른 팀원의 파일을 크게 수정해야 하면 먼저 담당자와 범위를 공유합니다.
- 실제 이용자 정보, 비밀번호, 데이터베이스 비밀번호, Secret Key와 `service_role` 키는 커밋하지 않습니다.

## 2. 권장 작업 순서

```bash
git switch main
git pull origin main
git switch -c feature/kiosk-menu-filter

# 작업과 로컬 확인
git add kiosk
git commit -m "Add kiosk menu filter"
git push -u origin feature/kiosk-menu-filter
```

GitHub에서 Pull Request를 만들고 아래 확인 항목을 작성합니다. 병합 전에는 가능하면 다른 팀원 한 명이 변경 내용을 확인합니다.

## 3. 파일별 역할

| 파일·폴더 | 역할 |
|---|---|
| `index.html` | 고객·운영자 화면 구조와 접근성 문구 |
| `styles.css` | 태블릿·모바일 화면과 시각 디자인 |
| `app.js` | 메뉴, 옵션, 장바구니, 주문, 운영자 화면 로직 |
| `rag-assistant.js` | 메뉴 문서 검색, 추천·비교·주문 의도와 검증 로직 |
| `menu.json` | Supabase 연결 전 데모 메뉴 |
| `config.js` | 공개용 Supabase URL·Publishable Key와 데모 설정 |
| `supabase/schema.sql` | 테이블, RLS, 주문 생성 함수와 초기 메뉴 |
| `sw.js`, `manifest.webmanifest` | PWA와 정적 자산 캐시 |
| `README.md` | 실행·설정·배포 안내 |
| `PROJECT_NOTES.md` | 합의된 구조, 현재 구현과 다음 작업 |
| `tests/` | 주문 도우미 검색·의도·장바구니 자동 테스트 |

## 4. 역할 분담 예시

- 고객 화면: 메뉴 탐색, 옵션과 장바구니
- 주문 처리: 주문 검증, 오류·완료 화면
- 운영자 화면: 로그인, 주문판과 상태 변경
- 백엔드: Supabase 스키마, RLS와 Realtime
- QA·문서: 태블릿 점검, 테스트 결과와 안내서

담당은 고정 소유권이 아니라 충돌을 줄이기 위한 기본 구분입니다. 공통 파일인 `app.js`와 `schema.sql`을 동시에 수정할 때는 먼저 Pull Request 순서를 정합니다.

## 5. Supabase 변경 규칙

- 브라우저가 보낸 가격이나 관리자 여부를 그대로 신뢰하지 않습니다.
- RLS를 끄거나 `service_role` 키를 클라이언트에 넣어 문제를 우회하지 않습니다.
- 운영 데이터에 적용된 `schema.sql`을 임의로 되돌리지 않습니다.
- 새 데이터베이스 변경은 `supabase/migrations/YYYYMMDD_설명.sql` 파일로 추가하고, 적용 순서를 Pull Request에 기록합니다.
- SQL 적용 전후에 일반 사용자와 운영자 권한을 각각 시험합니다.

## 6. Pull Request 확인표

- [ ] 변경 목적과 화면 또는 데이터 영향 범위를 적었다.
- [ ] `python3 -m http.server 8000`으로 고객 주문 흐름을 확인했다.
- [ ] 브라우저 콘솔에 새 오류가 없다.
- [ ] 태블릿과 모바일 폭에서 버튼과 글자가 겹치지 않는다.
- [ ] 가격은 Supabase 함수에서 다시 계산된다.
- [ ] 비밀번호나 비밀 키가 포함되지 않았다.
- [ ] 필요한 경우 `README.md`와 `PROJECT_NOTES.md`를 함께 갱신했다.
