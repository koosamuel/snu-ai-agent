# 의류·잡화 판매 데이터 분석 대시보드

Flask로 만든 판매 분석 화면입니다. 포트는 **8082**입니다.

## 실행

프로젝트 루트(`practice`)에서 가상환경을 켠 뒤:

```bash
source .venv/bin/activate
cd sales_data_analysis
pip install -r requirements.txt
python app.py
```

브라우저: http://127.0.0.1:8082

## 데이터

`uploads/*.csv`를 모두 합쳐 집계합니다. 샘플은 실제 거래가 아닙니다.

```bash
python scripts/generate_sample_csvs.py
```

생성 파일: `sales_2026_01.csv` ~ `sales_2026_12.csv`, `sales_gangnam_2025.csv` 등 매장별 2025 하반기 파일.

CSV를 추가로 업로드하면 `uploads`에 파일 이름으로 저장됩니다.

### 필수 열

| 열 | 설명 | 예시 |
| --- | --- | --- |
| `sale_date` | 판매일 `YYYY-MM-DD` | 2026-03-01 |
| `category` | 대분류 (`의류` 또는 `잡화`) | 의류 |
| `subcategory` | 소분류 | 상의 |
| `product_name` | 상품명 | 코튼 셔츠 |
| `quantity` | 수량 | 2 |
| `unit_price` | 단가(원) | 39000 |
| `store` | 매장 | 강남점 |
| `channel` | 채널 | 오프라인 |

매출은 `quantity * unit_price`로 계산합니다.

## 구성

- `app.py` — 엔트리포인트
- `config.py` — 호스트·포트·업로드 경로
- `app/` — 라우트, 분석 함수, 템플릿
- `uploads/` — CSV 저장
- `.cursor/rules/project-rules.mdc` — 프로젝트 규칙
