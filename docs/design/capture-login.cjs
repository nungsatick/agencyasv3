const { chromium } = require('../../web/node_modules/playwright');
const path = require('path');
const { pathToFileURL } = require('url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(__dirname,'login-preview.html')).href);
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(__dirname,'login-desktop.png'),fullPage:true});
 await page.locator('#password').fill('demo-only');await page.locator('#show').click();
 if(await page.locator('#password').getAttribute('type')!=='text')throw Error('Password toggle failed');
 await page.locator('#login .primary').click();
 if(!await page.locator('#twofactor').isVisible())throw Error('2FA preview failed');
 await page.screenshot({path:path.join(__dirname,'login-2fa.png'),fullPage:true});
 await page.locator('#back').click();
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(__dirname,'login-mobile.png'),fullPage:true});
 for(const width of [375,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow '+width);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await browser.close();console.log('Desktop, mobile, 2FA screenshots saved. Password toggle, step navigation, and five viewport overflow checks passed.');
})();
