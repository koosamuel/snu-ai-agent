# snu-ai-agent

서울대학교 AI 응용 수업의 실습 코드와 AI Agent 프로젝트를 관리하는 저장소입니다.

## 폴더 구조

```text
snu-ai-agent/
├── docs/                 # GitHub Pages 정적 대시보드와 Supabase 설정
├── sales_data_analysis/  # Flask 판매 데이터 분석 실습
└── projects/             # 이후 과제와 AI Agent 프로젝트
```

## 실습 실행

```bash
cd sales_data_analysis
python -m pip install -r requirements.txt
python app.py
```

기본 접속 주소는 `http://127.0.0.1:8082`입니다.

## 외부 공개 대시보드

`docs/`는 GitHub Pages에서 실행되는 정적 버전입니다. 기본 상태에서는 샘플 CSV를 브라우저에서 직접 집계합니다. `docs/supabase/schema.sql`을 실행하고 `docs/config.js`에 Project URL과 Publishable anon key를 설정하면 Supabase의 인증·저장·실시간 동기화를 사용합니다.

- GitHub Pages 배포 원본: `main` 브랜치의 `/docs`
- Supabase 설정 안내: `docs/supabase/README.md`
- 비밀 키와 `service_role` 키는 저장소에 올리지 않습니다.
