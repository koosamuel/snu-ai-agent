# 모닝브루 카페 키오스크

태블릿에서 메뉴 선택·옵션·장바구니·주문 접수를 처리하고, 운영자 화면에서 주문 상태를 실시간으로 관리하는 정적 웹 키오스크입니다.

## 구조

```text
GitHub Pages 정적 클라이언트
├─ 메뉴 선택·옵션·장바구니·주문 확인
├─ 메뉴 문서 검색 기반 주문 도우미
├─ PWA 정적 자산 캐시
└─ Supabase Publishable Key
          ↓
Supabase
├─ Postgres: 메뉴·옵션·주문·주문 항목
├─ Auth: 운영자 로그인
├─ RLS: 공개 읽기와 운영자 권한 분리
├─ RPC: 서버 검증 가격 계산과 주문 생성
└─ Realtime: 운영자 주문판 갱신
```

클라이언트가 전송한 가격은 신뢰하지 않습니다. `create_kiosk_order` 함수가 활성 메뉴와 옵션 가격을 데이터베이스에서 다시 조회해 총액을 계산합니다. 각 주문에는 클라이언트가 생성한 `request_id`가 포함되며, 같은 요청이 재전송되면 서버가 기존 주문을 반환해 중복 주문을 방지합니다.

## 주요 기능

- 전체·커피·논커피·티·디저트 분류와 검색
- HOT/ICE, 크기, 샷·디카페인·오트 밀크 등 옵션
- 장바구니 수량 변경과 포장/매장 선택
- 카드 또는 카운터 결제 요청과 주문번호 발급
- 운영자용 `접수 → 제조 중 → 픽업 대기 → 완료` 주문판
- Supabase 미설정 상태에서도 확인할 수 있는 데모 모드
- 태블릿·모바일 반응형 화면과 PWA 정적 자산 캐시
- WebMCP 지원 브라우저에서 메뉴 조회·장바구니 추가·주문 접수 도구 등록
- 박우진 교수님 RAG 키오스크의 검색·추천·비교·주문 검증 흐름을 반영한 AI 주문 도우미

실제 카드 승인은 포함하지 않습니다. 결제 단말 업체의 SDK 또는 POS 연동을 별도로 검토해야 합니다.

## 로컬 실행

저장소를 받은 뒤 `kiosk` 폴더에서 정적 서버를 실행합니다. 별도 패키지 설치는 필요하지 않습니다.

```bash
git clone https://github.com/koosamuel/snu-ai-agent.git
cd snu-ai-agent/kiosk
python3 -m http.server 8000
```

`http://localhost:8000`을 엽니다. 현재 `config.js`는 Seoul 리전의 `cafe-kiosk` Supabase 프로젝트에 연결되어 있으며 `DEMO_MODE: false`입니다. 오프라인 데모만 확인하려면 로컬에서 일시적으로 `DEMO_MODE: true`로 바꿉니다.

주문 도우미의 검색·의도 분류 테스트는 별도 설치 없이 실행할 수 있습니다.

```bash
npm test
npm run check
```

## 박우진 교수님 RAG 코드 반영 범위

기존 `ai-applications-assignments-koo/rag-kiosk`의 메뉴 문서 검색, 추천·비교·주문 의도 구분, 메뉴 ID·수량 검증 원칙을 현재 키오스크 화면과 장바구니에 맞게 통합했습니다. 브라우저에서는 `rag-assistant.js`가 현재 메뉴 데이터만 검색하고, 명확한 주문 요청만 기본 옵션으로 장바구니에 반영합니다.

교수님 원본의 Claude 호출은 서버 전용 기능이므로 정적 GitHub Pages 클라이언트에 API 키나 호출 코드를 넣지 않았습니다. 향후 생성형 답변이 필요하면 Supabase Edge Function 또는 별도 Worker에서 비밀 키를 관리하고, 서버가 반환한 메뉴 ID·옵션·가격을 다시 검증해야 합니다. 세부 대응 관계는 `PARK_RAG_INTEGRATION.md`를 참고합니다.

## Supabase 연결

1. 카페용 Supabase 프로젝트를 새로 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Authentication에서 운영자 사용자를 생성합니다.
4. `schema.sql` 마지막의 운영자 등록 예시에서 이메일을 바꿔 실행합니다.
5. `config.js`에 Project URL과 **Publishable Key**를 입력하고 `DEMO_MODE`를 `false`로 바꿉니다.
6. 일반 화면 주문과 운영자 로그인을 각각 시험합니다.

```js
window.CAFE_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "YOUR_PUBLISHABLE_KEY",
  DEMO_MODE: false,
};
```

Publishable Key는 RLS를 전제로 브라우저에서 사용하는 공개 식별자입니다. 데이터베이스 비밀번호, Secret Key, `service_role` 키는 `config.js`나 GitHub 저장소에 넣지 않습니다.

## 공동 작업

공동 작업 규칙과 파일별 담당 범위는 `CONTRIBUTING.md`를 따릅니다. 팀원은 `main/kiosk`에서 직접 작업하며, 작업 시작과 push 직전에 `git pull --rebase origin main`으로 최신 변경을 반영합니다.

`main/kiosk`에 변경이 push되면 GitHub Actions가 테스트와 정적 빌드를 수행하고 GitHub Pages에 자동 배포합니다.

- 공개 주소: https://koosamuel.github.io/snu-ai-agent/
- 배포 워크플로: `.github/workflows/deploy-kiosk-pages.yml`

## 정적 배포 결과 생성

모든 경로가 상대 경로로 작성되어 GitHub Project Pages를 포함한 정적 호스팅에서 동작합니다.

배포 전 정적 결과물을 만들려면 다음을 실행합니다.

```bash
chmod +x scripts/build-static.sh
./scripts/build-static.sh
```

`dist/`는 GitHub Actions가 Pages에 업로드하는 배포 결과물이며 소스 저장소에는 커밋하지 않습니다.

## 운영 전 확인

- 실제 메뉴명·가격·품절 상태 반영
- 운영자 계정과 `staff_profiles` 권한 확인
- 익명 사용자가 주문 목록을 읽거나 수정할 수 없는지 확인
- 서로 다른 두 기기에서 주문 접수와 Realtime 갱신 확인
- 네트워크 장애 시 안내와 복구 확인
- 결제 단말 연동 전 화면에 결제 완료로 표시하지 않기
- 생성형 RAG 서버를 연결할 때 API 키가 브라우저 번들·`config.js`·GitHub 이력에 포함되지 않는지 확인
