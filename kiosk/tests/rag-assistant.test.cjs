const test = require("node:test");
const assert = require("node:assert/strict");
const assistant = require("../rag-assistant.js");

const items = [
  { id: "americano", category_id: "coffee", name: "아메리카노", description: "깔끔한 끝맛", price: 3500, available: true },
  { id: "cafe-latte", category_id: "coffee", name: "카페 라테", description: "부드러운 우유", price: 4300, available: true },
  { id: "chocolate", category_id: "noncoffee", name: "리얼 초콜릿", description: "달콤한 다크 초콜릿", price: 5000, available: true },
  { id: "lemon-ade", category_id: "noncoffee", name: "레몬 에이드", description: "상큼한 레몬과 탄산", price: 4900, available: true },
];

const options = [
  { id: "temp-hot", name: "HOT" },
  { id: "temp-ice", name: "ICE" },
  { id: "size-regular", name: "Regular" },
  { id: "size-large", name: "Large" },
  { id: "extra-oat", name: "오트 밀크" },
];

test("별칭으로 메뉴를 검색한다", () => {
  const rows = assistant.retrieveMenu(items, "아아 가격 알려줘");
  assert.equal(rows[0].item.id, "americano");
});

test("수량과 주문 의도를 읽는다", () => {
  const result = assistant.respond({ message: "아메리카노 두 잔 담아 줘", items, cart: [] });
  assert.equal(result.intent, "order");
  assert.deepEqual(result.action, { type: "add", itemId: "americano", quantity: 2 });
});

test("명시된 두 메뉴를 비교한다", () => {
  const result = assistant.respond({ message: "아메리카노와 카페 라테 비교해 줘", items, cart: [] });
  assert.equal(result.intent, "compare");
  assert.deepEqual(result.retrieved.map((item) => item.id), ["americano", "cafe-latte"]);
});

test("카페인이 적은 메뉴를 추천한다", () => {
  const result = assistant.respond({ message: "카페인이 적은 메뉴 추천해 줘", items, cart: [] });
  assert.equal(result.intent, "recommend");
  assert.ok(result.retrieved.some((item) => item.id === "lemon-ade"));
});

test("장바구니의 수량과 합계를 계산한다", () => {
  const cart = [{ item: items[0], quantity: 2, unitPrice: 3500 }];
  const result = assistant.respond({ message: "장바구니 합계 알려줘", items, cart });
  assert.match(result.answer, /총 2개/);
  assert.match(result.answer, /7,000원/);
});

test("선택한 주문 유형을 답변에 반영한다", () => {
  const result = assistant.respond({ message: "아메리카노 한 잔 담아 줘", items, cart: [], orderType: "dine_in" });
  assert.match(result.answer, /매장 주문/);
});

test("현재 주문 유형을 안내한다", () => {
  const result = assistant.respond({ message: "지금 포장이야 매장이야?", items, cart: [], orderType: "takeout" });
  assert.equal(result.intent, "order_type");
  assert.match(result.answer, /현재 포장 주문/);
});

test("판매 메뉴와 무관한 질문은 범위 밖으로 안내한다", () => {
  const result = assistant.respond({ message: "오늘 날씨 알려줘", items, cart: [] });
  assert.equal(result.intent, "out_of_scope");
});

test("식사 페어링은 실제 판매 메뉴만 추천한다", () => {
  const result = assistant.respond({ message: "샌드위치와 어울리는 음료 추천해 줘", items, cart: [] });
  assert.equal(result.intent, "recommend");
  assert.ok(result.retrieved.length >= 1);
  assert.ok(result.retrieved.every((item) => items.some((candidate) => candidate.id === item.id)));
});

test("자연어 옵션 주문을 구조화한다", () => {
  const result = assistant.respond({ message: "카페 라테 Large ICE 오트 밀크로 두 잔 담아 줘", items, options, cart: [] });
  assert.equal(result.intent, "order");
  assert.equal(result.action.itemId, "cafe-latte");
  assert.equal(result.action.quantity, 2);
  assert.deepEqual(result.action.optionIds, ["temp-ice", "size-large", "extra-oat"]);
});

test("짧은 후속 답변은 최근 사용자 문맥을 사용한다", () => {
  const query = assistant.conversationQuery("그걸로", [{ role: "user", text: "아메리카노 한 잔 주문할게" }]);
  assert.match(query, /아메리카노/);
});

test("전체 취소는 장바구니 초기화 동작을 반환한다", () => {
  const result = assistant.respond({ message: "장바구니 전부 비워 줘", items, cart: [] });
  assert.deepEqual(result.action, { type: "clear" });
});
