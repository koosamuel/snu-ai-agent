const REQUIRED_COLUMNS = [
  "sale_date", "category", "subcategory", "product_name",
  "quantity", "unit_price", "store", "channel",
];

const SAMPLE_FILES = [
  "sales_2026_01.csv", "sales_2026_02.csv", "sales_2026_03.csv",
  "sales_2026_04.csv", "sales_2026_05.csv", "sales_2026_06.csv",
  "sales_2026_07.csv", "sales_2026_08.csv", "sales_2026_09.csv",
  "sales_2026_10.csv", "sales_2026_11.csv", "sales_2026_12.csv",
  "sales_busan_2025.csv", "sales_gangnam_2025.csv",
  "sales_hongdae_2025.csv", "sales_online_2025.csv",
];

const won = new Intl.NumberFormat("ko-KR");
const palette = ["#2f6f5e", "#c9842f", "#3d5a80", "#9b3d3d"];
let rows = [];
let monthlyChart;
let categoryChart;
let db = null;
let session = null;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character]));

function showMessage(text, isError = false) {
  const element = $("#message");
  element.textContent = text;
  element.hidden = !text;
  element.classList.toggle("error", isError);
}

function normalizeRows(source) {
  return source.map((row) => {
    const missing = REQUIRED_COLUMNS.filter((column) => !(column in row));
    if (missing.length) throw new Error(`필수 열이 없습니다: ${missing.join(", ")}`);
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unit_price);
    if (!row.sale_date || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
      throw new Error("날짜·수량·단가 형식을 확인해 주세요.");
    }
    return {
      sale_date: String(row.sale_date).slice(0, 10),
      category: String(row.category).trim(),
      subcategory: String(row.subcategory).trim(),
      product_name: String(row.product_name).trim(),
      quantity,
      unit_price: unitPrice,
      store: String(row.store).trim(),
      channel: String(row.channel).trim(),
    };
  });
}

function groupSum(source, key) {
  const result = new Map();
  source.forEach((row) => {
    const name = key === "month" ? row.sale_date.slice(0, 7) : row[key];
    result.set(name, (result.get(name) || 0) + row.quantity * row.unit_price);
  });
  return [...result.entries()].map(([label, value]) => ({ label, value }));
}

function render() {
  const totalSales = rows.reduce((sum, row) => sum + row.quantity * row.unit_price, 0);
  const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
  $("#totalSales").textContent = `${won.format(totalSales)}원`;
  $("#totalQty").textContent = won.format(totalQty);
  $("#orderCount").textContent = won.format(rows.length);
  $("#avgOrder").textContent = `${won.format(rows.length ? Math.round(totalSales / rows.length) : 0)}원`;

  const recent = [...rows].sort((a, b) => b.sale_date.localeCompare(a.sale_date)).slice(0, 20);
  $("#salesRows").innerHTML = recent.map((row) => `
    <tr>
      <td>${escapeHtml(row.sale_date)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.product_name)}</td>
      <td>${won.format(row.quantity)}</td><td>${won.format(row.unit_price)}</td>
      <td>${won.format(row.quantity * row.unit_price)}</td><td>${escapeHtml(row.store)}</td><td>${escapeHtml(row.channel)}</td>
    </tr>`).join("");

  const monthly = groupSum(rows, "month").sort((a, b) => a.label.localeCompare(b.label));
  const categories = groupSum(rows, "category").sort((a, b) => b.value - a.value);
  monthlyChart?.destroy();
  categoryChart?.destroy();
  monthlyChart = new Chart($("#monthlyChart"), {
    type: "line",
    data: { labels: monthly.map((item) => item.label), datasets: [{ data: monthly.map((item) => item.value), borderColor: palette[0], tension: .25 }] },
    options: { plugins: { legend: { display: false } }, maintainAspectRatio: false },
  });
  categoryChart = new Chart($("#categoryChart"), {
    type: "bar",
    data: { labels: categories.map((item) => item.label), datasets: [{ data: categories.map((item) => item.value), backgroundColor: palette }] },
    options: { plugins: { legend: { display: false } }, maintainAspectRatio: false },
  });
}

async function loadSamples() {
  const parsed = await Promise.all(SAMPLE_FILES.map(async (name) => {
    const response = await fetch(`./data/${name}`);
    if (!response.ok) throw new Error(`${name}을 불러오지 못했습니다.`);
    return Papa.parse(await response.text(), { header: true, skipEmptyLines: true }).data;
  }));
  rows = normalizeRows(parsed.flat());
  $("#connectionStatus").textContent = "GitHub Pages 샘플 데이터";
  $("#sourceCount").textContent = `${SAMPLE_FILES.length}개 CSV`;
  render();
}

async function loadSupabase() {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || config.url.includes("YOUR_PROJECT")) return false;
  db = window.supabase.createClient(config.url, config.anonKey);
  const { data: auth } = await db.auth.getSession();
  session = auth.session;
  $("#loginForm").hidden = false;
  updateAuthUi();
  const { data, error } = await db.from("sales").select("sale_date,category,subcategory,product_name,quantity,unit_price,store,channel");
  if (error) throw error;
  rows = normalizeRows(data || []);
  $("#connectionStatus").textContent = "Supabase 실시간 연결";
  $("#sourceCount").textContent = "Supabase";
  render();
  db.channel("sales-dashboard").on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadSupabase).subscribe();
  db.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; updateAuthUi(); });
  return true;
}

function updateAuthUi() {
  $("#email").hidden = Boolean(session);
  $("#password").hidden = Boolean(session);
  $("#loginForm button[type=submit]").hidden = Boolean(session);
  $("#logoutButton").hidden = !session;
}

$("#uploadForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const file = $("#file").files[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async ({ data, errors }) => {
      try {
        if (errors.length) throw new Error(errors[0].message);
        const imported = normalizeRows(data);
        if (db) {
          if (!session) throw new Error("Supabase에 저장하려면 운영자 로그인이 필요합니다.");
          const { error } = await db.from("sales").insert(imported);
          if (error) throw error;
          showMessage(`${file.name}의 ${imported.length}건을 Supabase에 저장했습니다.`);
          await loadSupabase();
        } else {
          rows = rows.concat(imported);
          $("#sourceCount").textContent = "샘플 + 로컬 CSV";
          render();
          showMessage(`${file.name}의 ${imported.length}건을 현재 화면에 반영했습니다. 새로고침하면 초기화됩니다.`);
        }
      } catch (error) { showMessage(error.message, true); }
    },
  });
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const { error } = await db.auth.signInWithPassword({ email: $("#email").value, password: $("#password").value });
  showMessage(error ? error.message : "로그인했습니다.", Boolean(error));
});

$("#logoutButton").addEventListener("click", async () => {
  await db.auth.signOut();
  showMessage("로그아웃했습니다.");
});

(async () => {
  try {
    if (!(await loadSupabase())) await loadSamples();
  } catch (error) {
    showMessage(`Supabase 연결에 실패해 샘플 데이터로 전환합니다: ${error.message}`, true);
    await loadSamples();
  }
})();
