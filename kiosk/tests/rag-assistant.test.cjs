const test = require("node:test");
const assert = require("node:assert/strict");
const assistant = require("../rag-assistant.js");

const items = [
  { id: "americano", category_id: "coffee", name: "아메리카노", description: "깔끔한 끝맛", price: 3500, available: true },
  { id: "cafe-latte", category_id: "coffee", name: "카페 라테", description: "부드러운 우유", price: 4300, available: true },
  { id: "chocolate", category_id: "noncoffee", name: "리얼 초콜릿", description: "달콤한 다크 초콜릿", price: 5000, available: true },
  { id: "lemon-ade", category_id: "noncoffee", name: "레몬 에이드", description: "상큼한 레몬과 탄산", price: 4900, available: true },
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

test("판매 메뉴와 무관한 질문은 범위 밖으로 안내한다", () => {
  const result = assistant.respond({ message: "오늘 날씨 알려줘", items, cart: [] });
  assert.equal(result.intent, "out_of_scope");
});
