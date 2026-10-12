# snu-ai-agent

서울대학교 AI 응용 수업의 실습 코드와 AI Agent 프로젝트를 관리하는 저장소입니다.

## 폴더 구조

```text
snu-ai-agent/
├── docs/                 # GitHub Pages 정적 대시보드와 Supabase 설정
├── kiosk/                # 모닝브루 카페 키오스크 공동 작업 소스
├── sales_data_analysis/  # Flask 판매 데이터 분석 실습
└── projects/             # 이후 과제와 AI Agent 프로젝트
```

카페 키오스크는 `kiosk/README.md`와 `kiosk/CONTRIBUTING.md`를 먼저 읽고 `main/kiosk`에서 직접 공동 작업합니다. 작업 시작과 push 직전에 최신 `main`을 반영합니다.

## 실습 실행

```bash
cd sales_data_analysis
python -m pip install -r requirements.txt
python app.py
```

기본 접속 주소는 `http://127.0.0.1:8082`입니다.

## 외부 공개 카페 키오스크

GitHub Actions가 `main/kiosk`의 테스트와 정적 빌드를 수행한 뒤 GitHub Pages에 배포합니다.

- 공개 주소: https://koosamuel.github.io/snu-ai-agent/
- GitHub Pages 배포 원본: `main` 브랜치의 `/kiosk`
- 배포 워크플로: `.github/workflows/deploy-kiosk-pages.yml`
- 비밀 키와 `service_role` 키는 저장소에 올리지 않습니다.
