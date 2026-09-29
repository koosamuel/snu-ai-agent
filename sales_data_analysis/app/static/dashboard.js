const source = document.getElementById("chart-data");
if (!source) {
  throw new Error("차트 데이터가 없습니다.");
}

const data = JSON.parse(source.textContent);
const palette = ["#2f6f5e", "#c9842f", "#3d5a80", "#9b3d3d"];

try {
  const monthly = data.monthly || [];
  new Chart(document.getElementById("monthlyChart"), {
    type: "line",
    data: {
      labels: monthly.map((row) => row.month),
      datasets: [{
        label: "매출",
        data: monthly.map((row) => row.sales_amount),
        borderColor: palette[0],
        tension: 0.25,
        fill: false,
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });

  const category = data.category || [];
  new Chart(document.getElementById("categoryChart"), {
    type: "bar",
    data: {
      labels: category.map((row) => row.category),
      datasets: [{
        label: "매출",
        data: category.map((row) => row.sales_amount),
        backgroundColor: palette,
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });
} catch (error) {
  console.error(error);
}
