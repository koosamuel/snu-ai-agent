(function initializeCafeRagAssistant(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CafeRagAssistant = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const KNOWLEDGE = {
    americano: { aliases: ["아아", "americano"], caffeine: "높음", tags: ["진한", "깔끔한", "저당", "쌉쌀한", "strong", "clean"] },
    "cafe-latte": { aliases: ["카페라떼", "라떼", "카페라테", "cafe latte", "latte"], caffeine: "중간", tags: ["부드러운", "고소한", "우유", "smooth", "milk"] },
    "vanilla-latte": { aliases: ["바닐라라떼", "바닐라라테", "vanilla latte"], caffeine: "중간", tags: ["달콤한", "부드러운", "우유", "sweet"] },
    "flat-white": { aliases: ["플랫화이트", "flat white"], caffeine: "높음", tags: ["진한", "고소한", "우유", "strong"] },
    "matcha-latte": { aliases: ["말차라떼", "말차라테", "matcha latte"], caffeine: "낮음", tags: ["달콤한", "쌉싸름한", "논커피", "matcha"] },
    chocolate: { aliases: ["초코", "초코라떼", "초콜릿라떼", "chocolate", "hot chocolate"], caffeine: "매우 낮음", tags: ["달콤한", "초콜릿", "논커피", "sweet"] },
    "lemon-ade": { aliases: ["레몬에이드", "lemon ade", "lemonade"], caffeine: "없음", tags: ["상큼한", "청량한", "무카페인", "차가운", "refreshing", "caffeine free"] },
    "earl-grey": { aliases: ["얼그레이", "홍차", "earl grey", "black tea"], caffeine: "낮음", tags: ["향긋한", "깔끔한", "티"] },
    "citron-tea": { aliases: ["유자티", "유자 차", "citron tea", "yuzu tea"], caffeine: "없음", tags: ["상큼한", "달콤한", "무카페인", "따뜻한", "caffeine free"] },
    croissant: { aliases: ["크로아상", "플레인 크루아상", "croissant"], caffeine: "없음", tags: ["고소한", "바삭한", "빵", "디저트"] },
    financier: { aliases: ["휘낭시에", "financier"], caffeine: "없음", tags: ["고소한", "달콤한", "버터", "디저트"] },
    cheesecake: { aliases: ["치즈 케이크", "바스크치즈케이크", "cheesecake", "basque cheesecake"], caffeine: "없음", tags: ["고소한", "크리미한", "케이크", "디저트"] },
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

  const MEAL_PAIRINGS = [
    { label: "샌드위치", aliases: ["샌드위치", "토스트", "햄버거"], recommendations: [
      ["americano", "깔끔하고 쌉쌀해 빵과 속재료의 풍미를 정리해 줍니다."],
      ["cafe-latte", "부드럽고 고소해 담백한 샌드위치와 잘 어울립니다."],
      ["earl-grey", "베르가못 향이 산뜻해 채소나 햄과 균형을 이룹니다."],
    ] },
    { label: "샐러드", aliases: ["샐러드", "채소식", "야채식"], recommendations: [
      ["earl-grey", "향긋하고 깔끔해 신선한 채소 맛을 해치지 않습니다."],
      ["citron-tea", "상큼한 유자 향이 가벼운 샐러드와 잘 어울립니다."],
      ["lemon-ade", "산뜻하고 청량해 고소한 드레싱과 균형을 이룹니다."],
    ] },
    { label: "파스타", aliases: ["파스타", "스파게티", "면요리"], recommendations: [
      ["americano", "쌉쌀하고 깔끔해 크림이나 치즈의 묵직함을 정리해 줍니다."],
      ["lemon-ade", "상큼한 풍미가 진한 소스 뒤 입안을 산뜻하게 합니다."],
      ["citron-tea", "유자 향이 오일이나 토마토소스와 가볍게 어울립니다."],
    ] },
    { label: "치킨", aliases: ["치킨", "닭요리", "닭고기"], recommendations: [
      ["citron-tea", "상큼한 유자 향이 기름진 맛을 정리해 줍니다."],
      ["lemon-ade", "청량한 탄산이 튀김이나 양념과 잘 어울립니다."],
      ["americano", "단맛이 적고 쌉쌀해 치킨의 풍미를 방해하지 않습니다."],
    ] },
  ];

  const SHORT_CONTEXT_PATTERN = /^(네|예|응|그래|좋아|둘\s*다|그걸로|그거|둘\s*모두)[.!~]?$/u;

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

  function ngrams(value, size = 2) {
    const valueCompact = compact(value);
    const result = new Set();
    for (let index = 0; index <= valueCompact.length - size; index += 1) result.add(valueCompact.slice(index, index + size));
    return result;
  }

  function matchingMealPairings(message) {
    const query = compact(message);
    return MEAL_PAIRINGS.filter((guide) => guide.aliases.some((alias) => query.includes(compact(alias))));
  }

  function itemDocument(item) {
    const knowledge = KNOWLEDGE[item.id] || {};
    const pairingTerms = MEAL_PAIRINGS.flatMap((guide) => guide.recommendations.some(([itemId]) => itemId === item.id) ? [guide.label, ...guide.aliases] : []);
    return normalize([
      item.name,
      item.description,
      CATEGORY_LABELS[item.category_id] || item.category_id,
      knowledge.caffeine,
      ...(knowledge.aliases || []),
      ...(knowledge.tags || []),
      ...pairingTerms,
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

    const queryGrams = ngrams(query);
    const documentGrams = ngrams(document);
    let overlap = 0;
    queryGrams.forEach((gram) => { if (documentGrams.has(gram)) overlap += 1; });
    score += (overlap / Math.max(1, queryGrams.size)) * 8;

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
    if (wordMatch) return words[wordMatch[1]];
    const englishWords = { one: 1, two: 2, three: 3, four: 4 };
    const englishMatch = normalize(message).match(/\b(one|two|three|four)\b/u);
    return englishMatch ? englishWords[englishMatch[1]] : 1;
  }

  function conversationQuery(message, history = []) {
    if (!SHORT_CONTEXT_PATTERN.test(normalize(message))) return message;
    const previousUser = [...history].reverse().find((entry) => entry?.role === "user" && entry.text);
    return previousUser ? `${previousUser.text} ${message}` : message;
  }

  function requestedOptionIds(message, options = []) {
    const text = normalize(message);
    const requests = [
      [/아아|아이스|ice|차갑/u, (option) => normalize(option.name) === "ice"],
      [/핫|따뜻|뜨겁/u, (option) => normalize(option.name) === "hot"],
      [/(?:^|\s)l(?:\s|$)|라지|large/u, (option) => normalize(option.name) === "large"],
      [/(?:^|\s)(?:m|r)(?:\s|$)|미디엄|레귤러|regular/u, (option) => normalize(option.name) === "regular"],
      [/샷\s*추가|샷|extra shot/u, (option) => /샷 추가|extra shot/u.test(normalize(option.name))],
      [/디카페인|decaf/u, (option) => /디카페인|decaf/u.test(normalize(option.name))],
      [/오트\s*밀크|오트밀크|oat milk/u, (option) => /오트 밀크|oat milk/u.test(normalize(option.name))],
      [/데워|따뜻하게|warmed|warm it/u, (option) => /따뜻하게|warmed/u.test(normalize(option.name))],
      [/그대로|as is/u, (option) => /그대로|as is/u.test(normalize(option.name))],
    ];
    return [...new Set(requests.flatMap(([pattern, matches]) => pattern.test(text)
      ? options.filter(matches).map((option) => option.id)
      : []))];
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
    if (/(전체|전부|장바구니).*?(비워|취소|삭제)|주문\s*초기화|clear (?:the )?cart|cancel (?:the )?order/u.test(query)) return "clear";
    if (/빼|제거|삭제|취소|remove|delete/u.test(query)) return "remove";
    if (/장바구니|담긴|합계|총액|cart|basket|total/u.test(query)) return "cart";
    if (/비교|차이|뭐가 더|compare|difference/u.test(query)) return "compare";
    if (/주문|담아|추가해|주세요|살래|\badd\b|order|i(?:'d| would) like|give me/u.test(query)) return "order";
    if (/추천|골라|어울|뭐가 좋|어떤 게|recommend|suggest|pair/u.test(query)) return "recommend";
    if (/가격|얼마|price|how much/u.test(query)) return "price";
    return "inform";
  }

  function pairingResponse(items, message) {
    const guides = matchingMealPairings(message);
    const asksGeneric = /식사\s*메뉴|식사.*어울|음식.*어울|페어링|같이\s*먹|곁들/u.test(message);
    if (!guides.length && !asksGeneric) return null;
    if (!guides.length) return { intent: "clarify", answer: "샌드위치·샐러드·파스타·치킨 중 함께 드실 음식을 말씀해 주세요.", retrieved: [] };

    const picks = [];
    guides.forEach((guide) => guide.recommendations.forEach(([itemId, reason]) => {
      const item = items.find((candidate) => candidate.id === itemId && candidate.available !== false);
      if (item && !picks.some((row) => row.item.id === item.id) && picks.length < 3) picks.push({ item, reason });
    }));
    return {
      intent: "recommend",
      answer: `${guides.map((guide) => guide.label).join("·")}에 어울리는 현재 판매 메뉴입니다.\n${picks.map((row, index) => `${index + 1}. ${row.item.name}(${won(row.item.price)}): ${row.reason}`).join("\n")}`,
      retrieved: picks.map((row) => row.item),
    };
  }

  function respond({ message, items = [], options = [], cart = [], history = [], orderType = "takeout", language = "ko" }) {
    const contextualMessage = conversationQuery(message, history);
    const text = normalize(contextualMessage);
    const intent = inferIntent(text);
    const orderTypeLabel = orderType === "dine_in" ? "매장" : "포장";
    const retrieved = retrieveMenu(items, text, intent === "compare" ? 6 : 4);
    const itemRows = retrieved.map((row) => row.item);

    if (/(주문\s*유형|포장.*매장|매장.*포장|어디서\s*먹|어떻게\s*받|order type|takeout.*dine|dine.*takeout)/u.test(text)) {
      return { intent: "order_type", answer: `현재 ${orderTypeLabel} 주문으로 선택되어 있습니다. 상단의 포장·매장 버튼에서 변경할 수 있어요.`, retrieved: [] };
    }

    const pairing = pairingResponse(items, text);
    if (pairing && intent !== "order") return pairing;

    if (intent === "clear") {
      return { intent, answer: "장바구니의 모든 메뉴를 비웠습니다.", action: { type: "clear" }, retrieved: [] };
    }

    if (intent === "cart") {
      return { intent, answer: `${orderTypeLabel} 주문입니다. ${cartSummary(cart)}`, retrieved: [] };
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
      const optionIds = requestedOptionIds(message, options);
      return {
        intent,
        answer: `${orderTypeLabel} 주문으로 ${target.name} ${quantity}개를 요청한 옵션으로 장바구니에 반영했습니다.`,
        action: { type: "add", itemId: target.id, quantity, ...(optionIds.length ? { optionIds } : {}) },
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

  return { conversationQuery, inferIntent, matchingMealPairings, ngrams, normalize, parseQuantity, requestedOptionIds, retrieveMenu, respond, scoreItem };
}));
