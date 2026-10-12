const CONFIG = window.CAFE_CONFIG || {};
const IS_CONFIGURED = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_PUBLISHABLE_KEY && window.supabase);
const USE_REMOTE = IS_CONFIGURED && CONFIG.DEMO_MODE === false;
const db = USE_REMOTE
  ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY)
  : null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const won = (value) => `${Number(value || 0).toLocaleString("ko-KR")}원`;
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[char]));

const state = {
  categories: [],
  items: [],
  options: [],
  category: "all",
  search: "",
  orderType: "takeout",
  cart: [],
  activeItem: null,
  optionQuantity: 1,
  usingRemoteData: false,
  staffSession: null,
  staffDemo: false,
  staffOrders: [],
  ragMessages: [],
  pendingOrder: null,
};

const categoryColors = {
  coffee: "#6d4634",
  noncoffee: "#c46b45",
  tea: "#4f715d",
  dessert: "#b47a3f",
};

function setConnection(message, mode = "") {
  const element = $("#connectionStatus");
  element.textContent = message;
  element.className = `connection-status ${mode}`.trim();
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2500);
}

async function loadLocalMenu() {
  const response = await fetch("./menu.json");
  if (!response.ok) throw new Error("로컬 메뉴 파일을 읽지 못했습니다.");
  return response.json();
}

async function loadMenu() {
  setConnection("메뉴 준비 중");
  try {
    if (db) {
      const [categoriesResult, itemsResult, optionsResult] = await Promise.all([
        db.from("categories").select("id,name,sort_order").eq("active", true).order("sort_order"),
        db.from("menu_items").select("id,category_id,name,description,price,badge,available,sort_order").eq("available", true).order("sort_order"),
        db.from("menu_options").select("id,menu_item_id,group_name,name,price_delta,sort_order").eq("active", true).order("sort_order"),
      ]);
      const firstError = categoriesResult.error || itemsResult.error || optionsResult.error;
      if (firstError) throw firstError;
      state.categories = [{ id: "all", name: "전체", sort_order: 0 }, ...categoriesResult.data];
      state.items = itemsResult.data;
      state.options = optionsResult.data;
      state.usingRemoteData = true;
      setConnection("실시간 메뉴", "online");
    } else {
      const menu = await loadLocalMenu();
      state.categories = menu.categories;
      state.items = menu.items;
      state.options = menu.options;
      setConnection("데모 메뉴", "offline");
    }
  } catch (error) {
    console.error(error);
    const menu = await loadLocalMenu();
    state.categories = menu.categories;
    state.items = menu.items;
    state.options = menu.options;
    state.usingRemoteData = false;
    setConnection("오프라인 메뉴", "offline");
  }
  renderCategories();
  renderMenu();
}

function renderCategories() {
  $("#categoryTabs").innerHTML = state.categories.map((category) => `
    <button class="category-button ${category.id === state.category ? "active" : ""}"
      type="button" data-category="${escapeHtml(category.id)}">${escapeHtml(category.name)}</button>
  `).join("");
}

function renderMenu() {
  const normalizedSearch = state.search.toLocaleLowerCase("ko-KR");
  const visible = state.items.filter((item) => {
    const categoryMatch = state.category === "all" || item.category_id === state.category;
    const searchMatch = !normalizedSearch || `${item.name} ${item.description}`.toLocaleLowerCase("ko-KR").includes(normalizedSearch);
    return item.available !== false && categoryMatch && searchMatch;
  });

  const selectedCategory = state.categories.find((category) => category.id === state.category);
  $("#categoryTitle").textContent = selectedCategory?.name === "전체" ? "전체 메뉴" : selectedCategory?.name || "메뉴";
  $("#menuGrid").innerHTML = visible.length ? visible.map((item) => `
    <button class="menu-card" type="button" data-menu-id="${escapeHtml(item.id)}" style="--accent:${categoryColors[item.category_id] || "#2f4a3b"}">
      ${item.badge ? `<span class="badge">${escapeHtml(item.badge)}</span>` : `<span class="badge" aria-hidden="true">MENU</span>`}
      <span class="category-dot" style="background:var(--accent)"></span>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <strong>${won(item.price)}</strong>
      <span class="add-symbol" aria-hidden="true">＋</span>
    </button>
  `).join("") : `<div class="menu-empty"><strong>검색 결과가 없습니다.</strong><br />다른 메뉴 이름을 입력해 보세요.</div>`;
}

function isDrink(item) {
  return ["coffee", "noncoffee", "tea"].includes(item.category_id);
}

function isLatte(item) {
  return item.name.includes("라테") || item.id.includes("latte") || item.id === "flat-white";
}

function applicableOptions(item) {
  return state.options.filter((option) => {
    if (option.menu_item_id === item.id) return true;
    if (option.menu_item_id === "*drink") return isDrink(item);
    if (option.menu_item_id === "*coffee") return item.category_id === "coffee";
    if (option.menu_item_id === "*latte") return isLatte(item);
    if (option.menu_item_id === "*dessert") return item.category_id === "dessert";
    return false;
  });
}

function groupOptions(item) {
  return applicableOptions(item).reduce((groups, option) => {
    (groups[option.group_name] ||= []).push(option);
    return groups;
  }, {});
}

function openOptions(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  state.activeItem = item;
  state.optionQuantity = 1;
  $("#optionItemName").textContent = item.name;
  $("#optionItemDescription").textContent = item.description;
  $("#optionQuantity").textContent = "1";

  const groups = groupOptions(item);
  $("#optionGroups").innerHTML = Object.entries(groups).map(([groupName, options]) => {
    const isMultiple = groupName === "추가";
    return `
      <fieldset class="option-group" data-option-group="${escapeHtml(groupName)}">
        <legend>${escapeHtml(groupName)}${isMultiple ? " (선택)" : ""}</legend>
        <div class="option-choice-grid">
          ${options.map((option, index) => `
            <label class="option-choice">
              <input type="${isMultiple ? "checkbox" : "radio"}" name="option-${escapeHtml(groupName)}"
                value="${escapeHtml(option.id)}" ${!isMultiple && index === 0 ? "checked" : ""} />
              <span>${escapeHtml(option.name)}</span>
              <small>${option.price_delta ? `+${won(option.price_delta)}` : "추가금 없음"}</small>
            </label>
          `).join("")}
        </div>
      </fieldset>`;
  }).join("");

  updateAddButtonPrice();
  $("#optionDialog").showModal();
}

function selectedDialogOptions() {
  return $$("#optionGroups input:checked").map((input) => state.options.find((option) => option.id === input.value)).filter(Boolean);
}

function selectedUnitPrice() {
  return (state.activeItem?.price || 0) + selectedDialogOptions().reduce((sum, option) => sum + Number(option.price_delta || 0), 0);
}

function updateAddButtonPrice() {
  $("#addToCartButton").textContent = `${won(selectedUnitPrice() * state.optionQuantity)} · 장바구니에 담기`;
}

function cartKey(itemId, options) {
  return `${itemId}:${options.map((option) => option.id).sort().join(",")}`;
}

function addActiveItemToCart() {
  if (!state.activeItem) return;
  const options = selectedDialogOptions();
  addItemToCart(state.activeItem, options, state.optionQuantity);
  $("#optionDialog").close();
  toast(`${state.activeItem.name}을(를) 담았습니다.`);
}

function addItemToCart(item, options, quantity = 1) {
  const key = cartKey(item.id, options);
  const existing = state.cart.find((entry) => entry.key === key);
  if (existing) {
    existing.quantity = Math.min(20, existing.quantity + quantity);
  } else {
    const unitPrice = Number(item.price) + options.reduce((sum, option) => sum + Number(option.price_delta || 0), 0);
    state.cart.push({ key, item, options, quantity: Math.min(20, quantity), unitPrice });
  }
  renderCart();
}

function defaultOptionsFor(item) {
  const groups = groupOptions(item);
  return Object.entries(groups)
    .filter(([name]) => name !== "추가")
    .map(([, options]) => options[0])
    .filter(Boolean);
}

function cartTotal() {
  return state.cart.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
}

function renderCart() {
  const count = state.cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const total = cartTotal();
  $("#cartCount").textContent = count;
  $(".cart-heading").dataset.mobileLabel = count ? `${count}개 메뉴` : "장바구니가 비었어요";
  $("#cartItems").innerHTML = state.cart.length ? state.cart.map((entry) => `
    <article class="cart-item">
      <div class="cart-item-head">
        <div><h3>${escapeHtml(entry.item.name)}</h3><p>${escapeHtml(entry.options.map((option) => option.name).join(" · ") || "기본")}</p></div>
        <strong>${won(entry.unitPrice * entry.quantity)}</strong>
      </div>
      <div class="cart-item-actions">
        <div class="stepper">
          <button type="button" data-cart-action="decrease" data-cart-key="${escapeHtml(entry.key)}" aria-label="${escapeHtml(entry.item.name)} 수량 줄이기">−</button>
          <output>${entry.quantity}</output>
          <button type="button" data-cart-action="increase" data-cart-key="${escapeHtml(entry.key)}" aria-label="${escapeHtml(entry.item.name)} 수량 늘리기">＋</button>
        </div>
        <button class="remove-button" type="button" data-cart-action="remove" data-cart-key="${escapeHtml(entry.key)}">삭제</button>
      </div>
    </article>
  `).join("") : `<div class="cart-empty"><div><span aria-hidden="true">☕</span><strong>아직 담은 메뉴가 없어요</strong><br /><small>왼쪽 메뉴를 눌러 시작해 보세요.</small></div></div>`;
  $("#subtotal").textContent = won(total);
  $("#total").textContent = won(total);
  $("#checkoutTotal").textContent = won(total);
  $("#checkoutLabel").textContent = count ? `${count}개 주문하기` : "메뉴를 담아 주세요";
  $("#checkoutButton").disabled = !count;
}

function updateCartItem(key, action) {
  const entry = state.cart.find((candidate) => candidate.key === key);
  if (!entry) return;
  if (action === "increase") entry.quantity = Math.min(20, entry.quantity + 1);
  if (action === "decrease") entry.quantity -= 1;
  if (action === "remove" || entry.quantity < 1) state.cart = state.cart.filter((candidate) => candidate.key !== key);
  renderCart();
}

function openCheckout() {
  if (!state.cart.length) return;
  const orderTypeLabel = state.orderType === "takeout" ? "포장" : "매장 이용";
  $("#checkoutSummary").innerHTML = `
    <div><span>주문 유형</span><strong>${orderTypeLabel}</strong></div>
    <div><span>메뉴 수량</span><strong>${state.cart.reduce((sum, entry) => sum + entry.quantity, 0)}개</strong></div>
    <div class="grand-total"><span>결제 예정 금액</span><strong>${won(cartTotal())}</strong></div>`;
  $("#orderConsent").checked = false;
  $("#checkoutError").textContent = "";
  $("#checkoutDialog").showModal();
}

function orderPayload() {
  return state.cart.map((entry) => ({
    menu_item_id: entry.item.id,
    quantity: entry.quantity,
    option_ids: entry.options.map((option) => option.id),
  }));
}

function demoOrder(paymentMethod) {
  const orderNumber = String(Math.floor(100 + Math.random() * 900));
  const order = {
    id: crypto.randomUUID?.() || `demo-${Date.now()}`,
    order_number: orderNumber,
    order_type: state.orderType,
    payment_method: paymentMethod,
    status: "received",
    total_amount: cartTotal(),
    created_at: new Date().toISOString(),
    order_items: state.cart.map((entry) => ({
      item_name: entry.item.name,
      quantity: entry.quantity,
      unit_price: entry.unitPrice,
      option_summary: entry.options.map((option) => option.name).join(", "),
    })),
  };
  state.staffOrders.unshift(order);
  return { order_number: orderNumber, id: order.id, total_amount: order.total_amount };
}

async function createOrder(paymentMethod) {
  if (!state.usingRemoteData || !db) return demoOrder(paymentMethod);
  const signature = JSON.stringify({ orderType: state.orderType, paymentMethod, items: orderPayload() });
  if (!state.pendingOrder || state.pendingOrder.signature !== signature) {
    state.pendingOrder = { id: crypto.randomUUID(), signature };
  }
  const { data, error } = await db.rpc("create_kiosk_order", {
    p_order_type: state.orderType,
    p_payment_method: paymentMethod,
    p_items: orderPayload(),
    p_request_id: state.pendingOrder.id,
  });
  if (error) throw error;
  return data;
}

function orderErrorMessage(error) {
  const message = String(error?.message || "");
  if (message.includes("menu item is not available")) return "품절되었거나 판매가 종료된 메뉴가 있습니다. 메뉴를 다시 확인해 주세요.";
  if (message.includes("invalid") || message.includes("must be") || message.includes("required")) return "주문 정보가 올바르지 않습니다. 옵션과 수량을 다시 확인해 주세요.";
  return "주문을 접수하지 못했습니다. 잠시 후 다시 시도하거나 직원에게 문의해 주세요.";
}

async function placeOrder(event) {
  event?.preventDefault();
  if (!state.cart.length) return;
  const consent = $("#orderConsent");
  if (event && !consent.checked) {
    $("#checkoutError").textContent = "주문 내용을 확인한 뒤 확인란을 선택해 주세요.";
    return;
  }
  const button = $("#placeOrderButton");
  const paymentMethod = $("input[name='paymentMethod']:checked")?.value || "card";
  button.disabled = true;
  button.textContent = "주문을 접수하는 중…";
  $("#checkoutError").textContent = "";
  try {
    const result = await createOrder(paymentMethod);
    state.pendingOrder = null;
    $("#orderNumber").textContent = result.order_number || result.pickup_code || "확인";
    $("#checkoutDialog").close();
    $("#successDialog").showModal();
  } catch (error) {
    console.error(error);
    $("#checkoutError").textContent = orderErrorMessage(error);
  } finally {
    button.disabled = false;
    button.textContent = "주문 접수하기";
  }
}

function resetOrder() {
  state.cart = [];
  renderCart();
  $("#successDialog").close();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function openStaff() {
  $("#staffLoginError").textContent = "";
  if (state.staffSession || state.staffDemo) {
    await showStaffBoard();
  } else {
    $("#staffLoginSection").hidden = false;
    $("#staffBoardSection").hidden = true;
  }
  $("#staffDialog").showModal();
}

async function staffLogin(event) {
  event.preventDefault();
  if (!db) {
    $("#staffLoginError").textContent = "Supabase 설정 전에는 데모 운영판을 이용해 주세요.";
    return;
  }
  const { data, error } = await db.auth.signInWithPassword({
    email: $("#staffEmail").value.trim(),
    password: $("#staffPassword").value,
  });
  if (error) {
    $("#staffLoginError").textContent = "이메일 또는 비밀번호를 확인해 주세요.";
    return;
  }
  state.staffSession = data.session;
  await showStaffBoard();
}

async function showStaffBoard() {
  $("#staffLoginSection").hidden = true;
  $("#staffBoardSection").hidden = false;
  await loadStaffOrders();
}

async function loadStaffOrders() {
  if (state.staffDemo || !db) {
    if (!state.staffOrders.length) {
      state.staffOrders = [
        { id: "demo-1", order_number: "204", order_type: "takeout", payment_method: "card", status: "received", total_amount: 8100, created_at: new Date().toISOString(), order_items: [{ item_name: "카페 라테", quantity: 1, option_summary: "ICE, Regular" }, { item_name: "솔티드 휘낭시에", quantity: 1, option_summary: "그대로" }] },
        { id: "demo-2", order_number: "203", order_type: "dine_in", payment_method: "counter", status: "preparing", total_amount: 5200, created_at: new Date(Date.now() - 240000).toISOString(), order_items: [{ item_name: "말차 라테", quantity: 1, option_summary: "HOT, Regular" }] },
      ];
    }
    renderStaffOrders();
    return;
  }
  const { data, error } = await db.from("orders")
    .select("id,order_number,order_type,payment_method,status,total_amount,created_at,order_items(id,item_name,quantity,unit_price,option_summary)")
    .in("status", ["received", "preparing", "ready"])
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    toast("주문 목록을 불러오지 못했습니다.");
    return;
  }
  state.staffOrders = data || [];
  renderStaffOrders();
}

function renderStaffOrders() {
  const columns = [
    ["received", "접수", "제조 시작", "preparing"],
    ["preparing", "제조 중", "준비 완료", "ready"],
    ["ready", "픽업 대기", "전달 완료", "completed"],
  ];
  $("#staffOrders").innerHTML = columns.map(([status, label, actionLabel, nextStatus]) => {
    const orders = state.staffOrders.filter((order) => order.status === status);
    return `<section class="order-column"><h3>${label}<span>${orders.length}</span></h3>${orders.length ? orders.map((order) => `
      <article class="staff-order-card">
        <header><strong>${escapeHtml(order.order_number)}</strong><small>${order.order_type === "takeout" ? "포장" : "매장"} · ${new Date(order.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</small></header>
        <ul>${(order.order_items || []).map((item) => `<li>${escapeHtml(item.item_name)} × ${item.quantity}<br /><small>${escapeHtml(item.option_summary || "기본")}</small></li>`).join("")}</ul>
        <button type="button" data-order-id="${escapeHtml(order.id)}" data-next-status="${nextStatus}">${actionLabel}</button>
      </article>`).join("") : `<p class="cart-empty">대기 주문 없음</p>`}</section>`;
  }).join("");
}

async function updateOrderStatus(orderId, nextStatus) {
  if (state.staffDemo || !db) {
    const order = state.staffOrders.find((candidate) => candidate.id === orderId);
    if (order) order.status = nextStatus;
    if (nextStatus === "completed") state.staffOrders = state.staffOrders.filter((candidate) => candidate.id !== orderId);
    renderStaffOrders();
    return;
  }
  const { error } = await db.rpc("advance_kiosk_order", {
    p_order_id: orderId,
    p_next_status: nextStatus,
  });
  if (error) toast("주문 상태를 변경하지 못했습니다.");
  else await loadStaffOrders();
}

async function staffLogout() {
  if (db && state.staffSession) await db.auth.signOut();
  state.staffSession = null;
  state.staffDemo = false;
  $("#staffBoardSection").hidden = true;
  $("#staffLoginSection").hidden = false;
}

function appendRagMessage(role, text, retrieved = []) {
  const message = { role, text, retrieved };
  state.ragMessages.push(message);
  state.ragMessages = state.ragMessages.slice(-12);

  const article = document.createElement("article");
  article.className = `rag-message ${role}`;
  article.innerHTML = `
    <span class="rag-message-label">${role === "user" ? "나" : "주문 도우미"}</span>
    <p>${escapeHtml(text)}</p>
    ${retrieved.length ? `<div class="rag-sources" aria-label="검색된 메뉴">${retrieved.map((item) => `
      <button type="button" data-rag-menu-id="${escapeHtml(item.id)}">
        <span>${escapeHtml(item.name)}</span><strong>${won(item.price)}</strong>
      </button>`).join("")}</div>` : ""}`;
  $("#ragMessages").prepend(article);
  $("#ragMessages").scrollTop = 0;
}

function openRagAssistant() {
  if (!state.ragMessages.length) {
    appendRagMessage("assistant", "원하는 맛, 카페인 정도, 가격을 말씀해 주세요. 메뉴 비교와 기본 옵션 장바구니 담기도 도와드릴게요.");
  }
  $("#ragDialog").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => $("#ragInput").focus(), 350);
}

function removeMenuFromCart(itemId, quantity) {
  let remaining = Math.max(1, Number(quantity || 1));
  let removed = 0;
  for (const entry of state.cart) {
    if (entry.item.id !== itemId || remaining < 1) continue;
    const decrement = Math.min(entry.quantity, remaining);
    entry.quantity -= decrement;
    remaining -= decrement;
    removed += decrement;
  }
  state.cart = state.cart.filter((entry) => entry.quantity > 0);
  if (removed) renderCart();
  return removed;
}

function ragOptionsFor(item, requestedIds = []) {
  const requested = new Set(requestedIds);
  const groups = groupOptions(item);
  return Object.entries(groups).flatMap(([groupName, options]) => {
    const selected = options.filter((option) => requested.has(option.id));
    if (groupName === "추가") return selected;
    return selected.length ? [selected[0]] : options.slice(0, 1);
  });
}

function applyRagAction(result) {
  if (!result.action) return result.answer;

  if (result.action.type === "clear") {
    state.cart = [];
    renderCart();
    toast("장바구니를 비웠습니다.");
    return result.answer;
  }

  const item = state.items.find((candidate) => candidate.id === result.action.itemId && candidate.available !== false);
  if (!item) return "현재 주문 가능한 메뉴를 찾지 못했습니다. 메뉴 목록을 다시 확인해 주세요.";

  if (result.action.type === "add") {
    const selectedOptions = ragOptionsFor(item, result.action.optionIds || []);
    addItemToCart(item, selectedOptions, Number(result.action.quantity || 1));
    const optionSummary = selectedOptions.map((option) => option.name).join(" · ");
    toast(`${item.name}을(를) ${optionSummary || "기본 옵션"}으로 담았습니다.`);
    return result.answer;
  }

  if (result.action.type === "remove") {
    const removed = removeMenuFromCart(item.id, result.action.quantity);
    if (!removed) return `${item.name}은(는) 현재 장바구니에 없습니다.`;
    toast(`${item.name} ${removed}개를 장바구니에서 뺐습니다.`);
    return `${item.name} ${removed}개를 장바구니에서 뺐습니다.`;
  }
  return result.answer;
}

function sendRagMessage(message) {
  const assistant = window.CafeRagAssistant;
  const history = state.ragMessages.map((entry) => ({ role: entry.role, text: entry.text }));
  appendRagMessage("user", message);
  if (!assistant?.respond) {
    appendRagMessage("assistant", "주문 도우미를 불러오지 못했습니다. 화면을 새로고침해 주세요.");
    return;
  }
  if (!state.items.length) {
    appendRagMessage("assistant", "메뉴를 준비하고 있습니다. 잠시 뒤 다시 말씀해 주세요.");
    return;
  }

  const result = assistant.respond({ message, items: state.items, options: state.options, cart: state.cart, history });
  const answer = applyRagAction(result);
  appendRagMessage("assistant", answer, result.retrieved || []);
}

function resetRagSession() {
  state.ragMessages = [];
  state.cart = [];
  $("#ragMessages").innerHTML = "";
  renderCart();
  appendRagMessage("assistant", "새 주문을 시작했습니다. 메뉴 정보, 추천, 비교 또는 옵션 주문을 말씀해 주세요.");
  toast("대화와 장바구니를 초기화했습니다.");
}

function submitRagMessage(event) {
  event.preventDefault();
  const input = $("#ragInput");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  sendRagMessage(message);
  input.focus();
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();

  const register = (tool) => {
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); }
    catch (error) { console.error(error); }
  };

  register({
    name: "list_cafe_menu",
    title: "카페 메뉴 조회",
    description: "현재 주문 가능한 카페 메뉴와 가격을 조회합니다.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => ({ items: state.items.filter((item) => item.available !== false).map(({ id, name, price, category_id }) => ({ id, name, price, category: category_id })) }),
  });

  register({
    name: "add_menu_item_to_order",
    title: "메뉴 장바구니 담기",
    description: "메뉴 ID와 수량을 받아 기본 옵션으로 현재 장바구니에 추가합니다. 아직 주문은 접수하지 않습니다.",
    inputSchema: {
      type: "object",
      properties: { menuItemId: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 20 } },
      required: ["menuItemId", "quantity"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async ({ menuItemId, quantity }) => {
      const item = state.items.find((candidate) => candidate.id === menuItemId && candidate.available !== false);
      if (!item) throw new Error("주문 가능한 메뉴를 찾을 수 없습니다.");
      addItemToCart(item, defaultOptionsFor(item), Number(quantity));
      return { cartCount: state.cart.reduce((sum, entry) => sum + entry.quantity, 0), total: cartTotal() };
    },
  });

  register({
    name: "submit_cafe_order",
    title: "카페 주문 접수",
    description: "현재 화면의 장바구니를 실제 주문으로 접수합니다. 장바구니가 비어 있으면 실패합니다.",
    inputSchema: {
      type: "object",
      properties: {
        orderType: { type: "string", enum: ["takeout", "dine_in"] },
        paymentMethod: { type: "string", enum: ["card", "counter"] },
      },
      required: ["orderType", "paymentMethod"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async ({ orderType, paymentMethod }) => {
      if (!state.cart.length) throw new Error("장바구니가 비어 있습니다.");
      state.orderType = orderType;
      const result = await createOrder(paymentMethod);
      state.cart = [];
      renderCart();
      return { orderNumber: result.order_number, total: result.total_amount, status: "received" };
    },
  });
}

$("#categoryTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  renderMenu();
});

$("#menuGrid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-menu-id]");
  if (card) openOptions(card.dataset.menuId);
});

$("#searchInput").addEventListener("input", (event) => { state.search = event.target.value.trim(); renderMenu(); });

$$(`[data-order-type]`).forEach((button) => button.addEventListener("click", () => {
  state.orderType = button.dataset.orderType;
  $$(`[data-order-type]`).forEach((candidate) => candidate.classList.toggle("active", candidate === button));
}));

$("#optionGroups").addEventListener("change", updateAddButtonPrice);
$("#decreaseQuantity").addEventListener("click", () => { state.optionQuantity = Math.max(1, state.optionQuantity - 1); $("#optionQuantity").textContent = state.optionQuantity; updateAddButtonPrice(); });
$("#increaseQuantity").addEventListener("click", () => { state.optionQuantity = Math.min(20, state.optionQuantity + 1); $("#optionQuantity").textContent = state.optionQuantity; updateAddButtonPrice(); });
$("#optionForm").addEventListener("submit", (event) => { event.preventDefault(); addActiveItemToCart(); });

$("#cartItems").addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (button) updateCartItem(button.dataset.cartKey, button.dataset.cartAction);
});

$("#checkoutButton").addEventListener("click", openCheckout);
$("#checkoutForm").addEventListener("submit", placeOrder);
$("#newOrderButton").addEventListener("click", resetOrder);
$("#staffButton").addEventListener("click", openStaff);
$("#staffLoginForm").addEventListener("submit", staffLogin);
$("#demoStaffButton").addEventListener("click", async () => { state.staffDemo = true; await showStaffBoard(); });
$("#staffLogoutButton").addEventListener("click", staffLogout);
$("#ragButton").addEventListener("click", openRagAssistant);
$("#ragResetButton").addEventListener("click", resetRagSession);
$("#ragForm").addEventListener("submit", submitRagMessage);
$("#ragInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $("#ragForm").requestSubmit();
  }
});
$(".rag-prompts").addEventListener("click", (event) => {
  const button = event.target.closest("[data-rag-prompt]");
  if (button) sendRagMessage(button.dataset.ragPrompt);
});
$("#ragMessages").addEventListener("click", (event) => {
  const button = event.target.closest("[data-rag-menu-id]");
  if (!button) return;
  $("#ragDialog").close();
  openOptions(button.dataset.ragMenuId);
});
$("#staffOrders").addEventListener("click", (event) => {
  const button = event.target.closest("[data-order-id]");
  if (button) updateOrderStatus(button.dataset.orderId, button.dataset.nextStatus);
});
$("#languageButton").addEventListener("click", () => toast("영문 화면은 다음 버전에서 지원할 예정입니다."));
$$(`[data-close]`).forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
$$(`dialog`).forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog && dialog.id !== "successDialog") dialog.close(); }));

if (db) {
  db.auth.getSession().then(({ data }) => { state.staffSession = data.session; });
  db.auth.onAuthStateChange((_event, session) => { state.staffSession = session; });
  db.channel("cafe-menu").on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadMenu).subscribe();
  db.channel("cafe-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
    if (state.staffSession && $("#staffDialog").open) loadStaffOrders();
  }).subscribe();
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js?v=7").catch(console.error));

renderCart();
$("#demoStaffButton").hidden = USE_REMOTE;
loadMenu().then(registerWebMcpTools).catch((error) => {
  console.error(error);
  setConnection("메뉴 오류", "offline");
  $("#menuGrid").innerHTML = `<div class="menu-empty">메뉴를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</div>`;
});
