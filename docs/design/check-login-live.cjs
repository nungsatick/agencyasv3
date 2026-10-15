// Presentation checks with intercepted auth responses; never submits credentials to the server.
const { chromium } = require('../../web/node_modules/playwright');
const path = require('path');
const assert = require('assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let scenario='error', codeScenario='error';
  await page.route('**/api/users/sign-in',r=>r.fulfill({status:scenario==='error'?401:200,contentType:'application/json',body:JSON.stringify(scenario==='error'?{error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}:scenario==='setup'?{next:'setup',ticket:'ui-test',secret:'ABCDEFGHIJKLMNOP',qr:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="white"/%3E%3C/svg%3E'}:{next:'code',ticket:'ui-test'})}));
  await page.route('**/api/users/sign-in/code',r=>r.fulfill({status:codeScenario==='error'?400:200,contentType:'application/json',body:JSON.stringify(codeScenario==='error'?{error:'รหัสไม่ถูกต้อง'}:{recoveryCodes:['DEMO-1234','DEMO-5678','DEMO-9012','DEMO-3456']})}));
  await page.goto('http://localhost:3000/login'); await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(__dirname,'login-live-desktop.png'),fullPage:true});
  for(const width of [375,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width)}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'login-live-mobile.png'),fullPage:true});
  await page.locator('#login-username').fill('ui-demo');await page.locator('#login-password').fill('not-a-real-password');
  await page.getByRole('button',{name:'แสดงรหัสผ่าน'}).click();assert.equal(await page.locator('#login-password').getAttribute('type'),'text');
  await page.getByRole('button',{name:'ถัดไป',exact:true}).click();await page.getByRole('alert').waitFor();
  scenario='code';await page.getByRole('button',{name:'ถัดไป',exact:true}).click();await page.getByRole('heading',{name:'ยืนยันตัวตนของคุณ'}).waitFor();
  assert.equal(await page.locator('[aria-current="step"]').innerText(),'2\nยืนยันตัวตน');
  await page.locator('input[autocomplete="one-time-code"]').fill('123456');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'ใช้รหัสสำรองแทน'}).click();await page.getByPlaceholder('XXXX-XXXX').fill('DEMO-1234');
  await page.getByRole('button',{name:'กลับไปขั้นที่ 1'}).click();assert.equal(await page.locator('#login-password').inputValue(),'');
  await page.goto('http://localhost:3000/login?reason=idle');await page.getByRole('status').waitFor();
  scenario='setup';await page.locator('#login-username').fill('ui-demo');await page.locator('#login-password').fill('not-real');await page.getByRole('button',{name:'ถัดไป',exact:true}).click();
  await page.getByRole('heading',{name:'ตั้งค่าการยืนยันตัวตนสองขั้น'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  codeScenario='recovery';await page.locator('input[autocomplete="one-time-code"]').fill('123456');await page.getByRole('button',{name:'ยืนยัน',exact:true}).click();await page.getByRole('heading',{name:'เก็บรหัสสำรองไว้'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'เสร็จสิ้นและเข้าสู่ระบบ'}).isDisabled(),true);
  await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'เสร็จสิ้นและเข้าสู่ระบบ'}).isDisabled(),false);
  await page.goto('http://localhost:3000/request-account');assert.equal(await page.locator('.auth--split').count(),0);
  await page.goto('http://localhost:3000/login');await page.evaluate(()=>{document.documentElement.dataset.mode='dark'});assert.equal(await page.locator('.auth').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(244, 247, 248)');
  assert.deepEqual(errors,[]);console.log('PASS: responsive widths, password visibility, API error, 2FA/recovery switch, idle notice, setup, recovery confirmation, request-account shell, dark preference; auth responses mocked, no credentials submitted.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
