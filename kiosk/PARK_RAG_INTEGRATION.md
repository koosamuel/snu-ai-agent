# 박우진 교수님 RAG 키오스크 통합 메모

## 원본

- GitHub: <https://github.com/koosamuel/ai-applications-assignments-koo/tree/main/rag-kiosk>
- 원본 구조: 정적 `public/index.html` + Cloudflare Worker `src/worker.js`
- 핵심 흐름: 메뉴 문서 검색 → 의도 분류 → Claude 구조화 응답 → 서버 검증 → 장바구니 갱신

## 현재 클라이언트에 반영한 부분

| 원본 개념 | 현재 구현 |
|---|---|
| 메뉴 문서 검색 | `rag-assistant.js`가 메뉴명·설명·분류·별칭·맛·카페인 정보를 검색 |
| 의도 분류 | 추천, 비교, 정보, 가격, 주문, 제거, 장바구니, 범위 밖 질문 구분 |
| 결정적 검증 | 검색 결과의 실제 메뉴 ID만 사용하고 수량은 1~20개로 제한 |
| 주문 반영 | 명확한 메뉴 주문만 기존 장바구니 함수에 기본 옵션으로 전달 |
| 검색 근거 표시 | 답변 아래 실제 메뉴명과 현재 가격을 버튼으로 표시 |
| 문맥 안전성 | 답변은 현재 로드된 메뉴와 현재 장바구니만 사용 |

## 클라이언트에 넣지 않은 부분

Claude API 키와 모델 호출은 브라우저에 넣지 않았습니다. GitHub Pages에 올린 JavaScript와 설정값은 누구나 볼 수 있으므로 비밀 키를 저장할 수 없습니다. 또한 원본 Worker는 같은 출처의 요청만 허용하므로 별도 GitHub Pages에서 직접 호출하도록 연결하지 않았습니다.

생성형 답변을 추가하려면 다음 계약을 유지합니다.

1. 비밀 키와 모델 호출은 Supabase Edge Function 또는 별도 Worker에서만 처리한다.
2. 클라이언트는 사용자 문장, 최근 대화, 장바구니만 서버에 보낸다.
3. 서버는 허용된 메뉴 ID·옵션·수량만 구조화된 JSON으로 반환한다.
4. 최종 가격과 주문 가능 여부는 `create_kiosk_order` RPC가 다시 계산한다.
5. GitHub Pages 출처만 허용하는 CORS 정책과 요청 크기·빈도 제한을 적용한다.

## 확인 명령

```bash
cd kiosk
npm test
npm run check
./scripts/build-static.sh
```
