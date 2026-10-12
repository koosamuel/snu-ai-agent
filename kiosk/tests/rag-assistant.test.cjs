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

const groupedOptions = [
  { id: "temp-hot", menu_item_id: "*drink", group_name: "온도", name: "HOT", price_delta: 0 },
  { id: "temp-ice", menu_item_id: "*drink", group_name: "온도", name: "ICE", price_delta: 0 },
  { id: "size-regular", menu_item_id: "*drink", group_name: "크기", name: "Regular", price_delta: 0 },
  { id: "size-large", menu_item_id: "*drink", group_name: "크기", name: "Large", price_delta: 700 },
  { id: "extra-shot", menu_item_id: "*coffee", group_name: "추가", name: "샷 추가", price_delta: 500 },
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

test("영문 메뉴명으로 주문 의도를 인식한다", () => {
  const englishItems = items.map((item) => item.id === "americano" ? { ...item, name: "Americano", description: "Clean finish" } : item);
  const result = assistant.respond({ message: "Add two Americanos", items: englishItems, cart: [], orderType: "takeout", language: "en" });
  assert.equal(result.intent, "order");
  assert.equal(result.action.itemId, "americano");
  assert.equal(result.action.quantity, 2);
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

test("필수 옵션이 없으면 바로 담지 않고 질문한다", () => {
  const result = assistant.respond({ message: "아메리카노 한 잔 담아 줘", items, options: groupedOptions, cart: [] });
  assert.equal(result.intent, "clarify");
  assert.equal(result.action.type, "pending");
  assert.deepEqual(result.action.missingGroups, ["온도", "크기"]);
});

test("짧은 후속 옵션을 진행 중 주문에 합친다", () => {
  const pendingOrder = { itemId: "americano", quantity: 1, optionIds: [], missingGroups: ["온도", "크기"] };
  const result = assistant.respond({ message: "아이스, 중 사이즈, 샷 추가", items, options: groupedOptions, cart: [], pendingOrder });
  assert.equal(result.intent, "order");
  assert.deepEqual(result.action.optionIds, ["temp-ice", "size-regular", "extra-shot"]);
});

test("여러 메뉴를 한 번에 구조화한다", () => {
  const result = assistant.respond({ message: "아이스 레귤러 아메리카노 한 잔, 카페 라테 두 잔 담아 줘", items, options: [], cart: [] });
  assert.equal(result.action.type, "add_many");
  assert.deepEqual(result.action.items.map((row) => row.itemId), ["americano", "cafe-latte"]);
});

test("전체 메뉴 요청은 판매 메뉴를 모두 반환한다", () => {
  const result = assistant.respond({ message: "전체 메뉴 보여 줘", items, cart: [] });
  assert.equal(result.intent, "menu_list");
  assert.equal(result.retrieved.length, items.length);
});

test("커피 제외 조건을 추천에 반영한다", () => {
  const result = assistant.respond({ message: "커피 아닌 달콤한 음료 추천해 줘", items, cart: [] });
  assert.equal(result.intent, "recommend");
  assert.ok(result.retrieved.every((item) => item.category_id !== "coffee"));
});

test("사이즈 가격은 옵션 추가금을 계산한다", () => {
  const result = assistant.respond({ message: "아메리카노 라지 사이즈 얼마예요?", items, options: groupedOptions, cart: [] });
  assert.equal(result.intent, "price");
  assert.match(result.answer, /4,200원/);
});

test("알레르기 질문에는 안전을 단정하지 않는다", () => {
  const result = assistant.respond({ message: "우유 알레르기가 있는데 추천해 줘", items, cart: [] });
  assert.equal(result.intent, "safety");
  assert.match(result.answer, /안전하다고 단정할 수 없습니다/);
});

test("여러 메뉴의 미완성 옵션 상태를 보존한다", () => {
  const first = assistant.respond({ message: "아메리카노 한 잔, 카페 라테 한 잔 담아 줘", items, options: groupedOptions, cart: [] });
  assert.equal(first.action.type, "pending_many");
  const second = assistant.respond({ message: "둘 다 아이스 레귤러", items, options: groupedOptions, cart: [], pendingOrder: first.action });
  assert.equal(second.action.type, "add_many");
  assert.equal(second.action.items.length, 2);
});

test("주문 확인 발화는 결제 확인 단계로 이동한다", () => {
  const cart = [{ item: items[0], quantity: 1, unitPrice: 3500 }];
  const result = assistant.respond({ message: "네 이대로 주문할게요", items, options: groupedOptions, cart });
  assert.equal(result.intent, "checkout");
  assert.deepEqual(result.action, { type: "checkout" });
});
