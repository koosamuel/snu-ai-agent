# Supabase 연결

1. 새 Supabase 프로젝트를 만든다.
2. SQL Editor에서 `schema.sql`을 실행한다.
3. Authentication에서 운영자 사용자를 만든다.
4. `docs/config.example.js`를 참고해 `docs/config.js`에 Project URL과 Publishable anon key를 입력한다.
5. 변경을 커밋하고 GitHub Pages를 다시 배포한다.

브라우저에는 Publishable anon key만 사용한다. 데이터베이스 비밀번호와 `service_role` 키는 저장소에 올리지 않는다. RLS가 공개 읽기와 로그인 사용자 쓰기 권한을 제한한다.

