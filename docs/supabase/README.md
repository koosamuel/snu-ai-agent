# Supabase 연결

## 1. 데이터베이스 구조 생성

Supabase 프로젝트의 **SQL Editor → New query**에서 `schema.sql` 전체를 붙여 넣고 실행한다.
이 스크립트는 `sales` 테이블, 공개 조회 정책, 로그인 사용자 쓰기 정책, Realtime 설정을 만든다.

## 2. 초기 판매 데이터 등록

**Table Editor → sales → Insert → Import data from CSV**에서 `sales_seed.csv`를 한 번 가져온다.
파일에는 기존 16개 CSV를 합친 880건의 판매 기록이 들어 있다.

## 3. 웹 앱 연결

1. **Project Settings → API Keys**에서 Project URL과 **Publishable anon key**를 확인한다.
2. `docs/config.example.js`를 참고해 `docs/config.js`에 두 값을 입력한다.
3. 변경을 커밋하고 GitHub Pages 배포가 완료될 때까지 기다린다.
4. 공개 페이지에서 상태가 `Supabase 실시간 연결`로 표시되는지 확인한다.

## 4. 운영자 로그인 생성

**Authentication → Users → Add user**에서 CSV를 등록할 운영자 계정을 만든다.
방문자는 로그인 없이 데이터를 조회할 수 있고, 로그인한 운영자만 데이터를 추가·수정·삭제할 수 있다.

## 보안 주의사항

브라우저와 공개 저장소에는 **Publishable anon key만** 사용한다. 데이터베이스 비밀번호, Secret key,
`service_role` 키는 `docs/config.js` 또는 GitHub 저장소에 절대 올리지 않는다. 실제 데이터 접근은
RLS(Row Level Security, 행 수준 보안) 정책으로 제한한다.
