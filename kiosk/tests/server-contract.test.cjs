const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const schema = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const client = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("주문 생성은 보안 RPC를 통해 처리한다", () => {
  assert.match(schema, /create or replace function public\.create_kiosk_order/);
  assert.match(schema, /security definer/);
  assert.match(schema, /grant execute on function public\.create_kiosk_order/);
  assert.match(client, /db\.rpc\("create_kiosk_order"/);
  assert.match(client, /p_request_id: state\.pendingOrder\.id/);
  assert.match(schema, /request_id uuid not null unique/);
  assert.match(schema, /order_number text not null unique/);
});

test("클라이언트 옵션을 서버에서 검증한다", () => {
  assert.match(schema, /one or more options are invalid or duplicated/);
  assert.match(schema, /only one option may be selected per option group/);
});

test("주문 상태 변경은 운영자 전용 RPC를 사용한다", () => {
  assert.match(schema, /create or replace function public\.advance_kiosk_order/);
  assert.match(schema, /if not public\.is_cafe_staff\(\)/);
  assert.match(schema, /revoke update on public\.orders from authenticated/);
  assert.match(client, /db\.rpc\("advance_kiosk_order"/);
  assert.doesNotMatch(client, /db\.from\("orders"\)\.update/);
});
