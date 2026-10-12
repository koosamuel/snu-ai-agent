(function initializeCafeRagAssistant(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CafeRagAssistant = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const KNOWLEDGE = {
    americano: { aliases: ["아아"], caffeine: "높음", tags: ["진한", "깔끔한", "저당", "쌉쌀한"] },
    "cafe-latte": { aliases: ["카페라떼", "라떼", "카페라테"], caffeine: "중간", tags: ["부드러운", "고소한", "우유"] },
    "vanilla-latte": { aliases: ["바닐라라떼", "바닐라라테"], caffeine: "중간", tags: ["달콤한", "부드러운", "우유"] },
    "flat-white": { aliases: ["플랫화이트"], caffeine: "높음", tags: ["진한", "고소한", "우유"] },
    "matcha-latte": { aliases: ["말차라떼", "말차라테"], caffeine: "낮음", tags: ["달콤한", "쌉싸름한", "논커피"] },
    chocolate: { aliases: ["초코", "초코라떼", "초콜릿라떼"], caffeine: "매우 낮음", tags: ["달콤한", "초콜릿", "논커피"] },
    "lemon-ade": { aliases: ["레몬에이드"], caffeine: "없음", tags: ["상큼한", "청량한", "무카페인", "차가운"] },
    "earl-grey": { aliases: ["얼그레이", "홍차"], caffeine: "낮음", tags: ["향긋한", "깔끔한", "티"] },
    "citron-tea": { aliases: ["유자티", "유자 차"], caffeine: "없음", tags: ["상큼한", "달콤한", "무카페인", "따뜻한"] },
    croissant: { aliases: ["크로아상", "플레인 크루아상"], caffeine: "없음", tags: ["고소한", "바삭한", "빵", "디저트"] },
    financier: { aliases: ["휘낭시에"], caffeine: "없음", tags: ["고소한", "달콤한", "버터", "디저트"] },
    cheesecake: { aliases: ["치즈 케이크", "바스크치즈케이크"], caffeine: "없음", tags: ["고소한", "크리미한", "케이크", "디저트"] },
  };

  const CATEGORY_LABELS = {
    coffee: "커피",
    noncoffee: "논커피",
    tea: "티",
    dessert: "디저트",
  };

  const QUERY_ALIASES = {
    디카페인: ["무카페인", "카페인 없음", "카페인이 적은", "카페인 적은", "카페인 낮은"],
    달콤한: ["단", "달달한", "디저트 같은"],
    상큼한: ["산뜻한", "청량한", "시원한"],
    진한: ["쌉쌀한", "커피 맛", "잠 깨는"],
    고소한: ["부드러운", "우유", "라테"],
  };

  const STOP_WORDS = new Set(["메뉴", "음료", "추천", "추천해", "추천해줘", "알려", "알려줘", "주세요", "주문", "담아", "담아줘", "비교", "차이", "가격", "얼마", "뭐가", "어떤", "해줘", "해", "좀"]);

  function normalize(value = "") {
    return String(value)
      .toLocaleLowerCase("ko-KR")
      .replace(/[.,!?~'"()[\]{}:;·/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compact(value = "") {
    return normalize(value).replace(/\s+/g, "");
  }

  function tokens(value = "") {
    return normalize(value)
      .split(" ")
      .map((token) => token.replace(/(으로|에서|하고|이랑|랑|과|와|은|는|이|가|을|를|에|도|만)$/u, ""))
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  }

  function itemDocument(item) {
    const knowledge = KNOWLEDGE[item.id] || {};
    return normalize([
      item.name,
      item.description,
      CATEGORY_LABELS[item.category_id] || item.category_id,
      knowledge.caffeine,
      ...(knowledge.aliases || []),
      ...(knowledge.tags || []),
    ].join(" "));
  }

  function expandedTerms(message) {
    const normalized = normalize(message);
    const result = new Set(tokens(normalized));
    Object.entries(QUERY_ALIASES).forEach(([canonical, aliases]) => {
      if (aliases.some((alias) => normalized.includes(alias))) result.add(canonical);
    });
    if (/카페인.*(없|적|낮)|디카페인|무카페인/u.test(normalized)) {
      result.add("없음");
      result.add("매우 낮음");
      result.add("낮음");
    }
    return [...result];
  }

  function scoreItem(item, message) {
    const query = normalize(message);
    const compactQuery = compact(message);
    const knowledge = KNOWLEDGE[item.id] || {};
    const names = [item.name, ...(knowledge.aliases || [])].map(compact);
    const document = itemDocument(item);
    let score = 0;

    names.forEach((name) => {
      if (name && compactQuery.includes(name)) score += 18;
      else if (name && name.includes(compactQuery) && compactQuery.length >= 2) score += 8;
    });
    expandedTerms(query).forEach((term) => {
      const normalizedTerm = normalize(term);
      if (normalizedTerm && document.includes(normalizedTerm)) score += normalizedTerm.includes(" ") ? 4 : 3;
    });
    if (query.includes("논커피") && item.category_id === "noncoffee") score += 5;
    if (query.includes("디저트") && item.category_id === "dessert") score += 5;
    if (query.includes("커피") && item.category_id === "coffee") score += 3;
    if (/저렴|싼|가성비/u.test(query)) score += Math.max(0, 6 - Number(item.price || 0) / 1000);
    return score;
  }

  function retrieveMenu(items, message, limit = 4) {
    return (items || [])
      .filter((item) => item && item.available !== false)
      .map((item) => ({ item, score: scoreItem(item, message) }))
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score || Number(left.item.price) - Number(right.item.price))
      .slice(0, Math.max(1, limit));
  }

  function won(value) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
  }

  function parseQuantity(message) {
    const match = normalize(message).match(/(\d+)\s*(잔|개|조각|병)?/u);
    if (match) return Math.min(20, Math.max(1, Number(match[1])));
    const words = { 한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4 };
    const wordMatch = normalize(message).match(/(한|하나|두|둘|세|셋|네|넷)\s*(잔|개|조각|병)/u);
    return wordMatch ? words[wordMatch[1]] : 1;
  }

  function cartSummary(cart) {
    const rows = Array.isArray(cart) ? cart : [];
    if (!rows.length) return "현재 장바구니는 비어 있습니다.";
    const count = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const total = rows.reduce((sum, row) => sum + Number(row.unitPrice || 0) * Number(row.quantity || 0), 0);
    const details = rows.map((row) => `${row.item?.name || "메뉴"} ${row.quantity}개`).join(", ");
    return `현재 ${details}, 총 ${count}개가 담겨 있고 합계는 ${won(total)}입니다.`;
  }

  function knowledgeFor(item) {
    return KNOWLEDGE[item.id] || { caffeine: "정보 없음", tags: [] };
  }

  function mentionIndex(item, message) {
    const query = compact(message);
    const knowledge = KNOWLEDGE[item.id] || {};
    const indexes = [item.name, ...(knowledge.aliases || [])]
      .map(compact)
      .map((name) => query.indexOf(name))
      .filter((index) => index >= 0);
    return indexes.length ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
  }

  function menuSentence(item) {
    const knowledge = knowledgeFor(item);
    return `${item.name}(${won(item.price)})은(는) ${item.description} 카페인은 ${knowledge.caffeine || "정보 없음"}입니다.`;
  }

  function recommendationReason(item, message) {
    const query = normalize(message);
    const knowledge = knowledgeFor(item);
    if (/카페인.*(없|적|낮)|디카페인|무카페인/u.test(query)) return `카페인이 ${knowledge.caffeine}이라 요청에 잘 맞습니다.`;
    if (/달|디저트/u.test(query)) return `${(knowledge.tags || []).includes("달콤한") ? "달콤한 풍미" : item.description}가 특징입니다.`;
    if (/상큼|산뜻|청량|시원/u.test(query)) return "산뜻하게 즐기기 좋은 메뉴입니다.";
    if (/진한|쌉쌀|잠/u.test(query)) return "커피 풍미가 선명한 메뉴입니다.";
    return item.description;
  }

  function inferIntent(message) {
    const query = normalize(message);
    if (/빼|제거|삭제|취소/u.test(query)) return "remove";
    if (/장바구니|담긴|합계|총액/u.test(query)) return "cart";
    if (/비교|차이|뭐가 더/u.test(query)) return "compare";
    if (/주문|담아|추가해|주세요|살래/u.test(query)) return "order";
    if (/추천|골라|어울|뭐가 좋|어떤 게/u.test(query)) return "recommend";
    if (/가격|얼마/u.test(query)) return "price";
    return "inform";
  }

  function respond({ message, items = [], cart = [] }) {
    const text = normalize(message);
    const intent = inferIntent(text);
    const retrieved = retrieveMenu(items, text, intent === "compare" ? 6 : 4);
    const itemRows = retrieved.map((row) => row.item);

    if (intent === "cart") {
      return { intent, answer: cartSummary(cart), retrieved: [] };
    }

    if (intent === "remove") {
      const target = itemRows[0];
      if (!target) return { intent: "clarify", answer: "장바구니에서 뺄 메뉴 이름을 함께 말씀해 주세요.", retrieved: [] };
      return {
        intent,
        answer: `${target.name} ${parseQuantity(text)}개를 장바구니에서 빼겠습니다.`,
        action: { type: "remove", itemId: target.id, quantity: parseQuantity(text) },
        retrieved: [target],
      };
    }

    if (intent === "order") {
      const target = itemRows[0];
      if (!target) return { intent: "clarify", answer: "담을 메뉴 이름을 말씀해 주세요. 예: ‘아메리카노 두 잔 담아 줘’." , retrieved: [] };
      const quantity = parseQuantity(text);
      return {
        intent,
        answer: `${target.name} ${quantity}개를 기본 옵션으로 장바구니에 담았습니다. 온도·크기 변경은 메뉴 카드를 눌러 조정할 수 있어요.`,
        action: { type: "add", itemId: target.id, quantity },
        retrieved: [target],
      };
    }

    if (intent === "compare") {
      const explicitlyNamed = itemRows
        .filter((item) => scoreItem(item, text) >= 18)
        .sort((left, right) => mentionIndex(left, text) - mentionIndex(right, text));
      const compared = (explicitlyNamed.length >= 2 ? explicitlyNamed : itemRows).slice(0, 2);
      if (compared.length < 2) {
        return { intent: "clarify", answer: "비교할 메뉴 두 개의 이름을 말씀해 주세요.", retrieved: itemRows.slice(0, 2) };
      }
      return {
        intent,
        answer: compared.map(menuSentence).join(" 반면 "),
        retrieved: compared,
      };
    }

    if (intent === "recommend") {
      if (!itemRows.length) return { intent: "clarify", answer: "원하는 맛이나 카페인 정도를 알려 주세요. 예: ‘달콤하고 카페인이 적은 메뉴’." , retrieved: [] };
      const picks = itemRows.slice(0, 3);
      return {
        intent,
        answer: `${picks.map((item) => `${item.name}: ${recommendationReason(item, text)}`).join(" ")} 아래 메뉴를 눌러 옵션을 확인할 수 있어요.`,
        retrieved: picks,
      };
    }

    if (itemRows.length) {
      const target = itemRows[0];
      return {
        intent: intent === "price" ? "price" : "inform",
        answer: intent === "price" ? `${target.name}의 기본 가격은 ${won(target.price)}입니다.` : menuSentence(target),
        retrieved: itemRows.slice(0, 3),
      };
    }

    return {
      intent: "out_of_scope",
      answer: "현재 판매 중인 메뉴의 추천·가격·비교·장바구니 요청을 도와드릴 수 있어요.",
      retrieved: [],
    };
  }

  return { inferIntent, normalize, parseQuantity, retrieveMenu, respond, scoreItem };
}));
