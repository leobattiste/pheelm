// Profile → About → Activity: the first five show, Show more adds five at a time and moves focus to
// the first new line, and the button goes once everything is shown. A short list has no button.
import { build } from 'esbuild'; import { chromium } from 'playwright-core'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const contents = `import React from 'react';import{createRoot}from'react-dom/client';import Activity from './components/ProfileActivity';
const items=n=>Array.from({length:n},(_,i)=>({id:'a'+i,verb:'Watched',title:'Film '+(i+1),href:'/films/film-'+i,at:new Date(Date.UTC(2026,10,13-i)).toISOString()}));
createRoot(document.getElementById('root')).render(<><div id="long"><Activity items={items(12)}/></div><div id="short"><Activity items={items(3)}/></div><div id="none"><Activity items={[]}/></div></>);`;
const bundle = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'tsx' }, define: { 'process.env': '{}' }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json',
  plugins: [{ name: 'next-link', setup(b) { b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'test' })); b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `import React from 'react';export default React.forwardRef(({href,children,prefetch,...props},ref)=><a ref={ref} href={href} {...props}>{children}</a>);`, loader: 'jsx', resolveDir: process.cwd() })); } }] });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (r) => r.abort());
  await page.setContent('<html data-theme="dark"><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: fs.readFileSync('app/globals.css', 'utf8') }); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const count = (id) => page.locator(`#${id} .profile-activity li`).count();
  const more = page.locator('#long').getByRole('button', { name: 'Show more' });
  await more.waitFor();
  assert.equal(await count('long'), 5, 'first five show');
  await more.click();
  assert.equal(await count('long'), 10, 'Show more adds five');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Watched Film 6', 'focus moves to the first new line');
  await more.click();
  assert.equal(await count('long'), 12, 'then the rest');
  assert.equal(await more.count(), 0, 'no button once everything shows');
  assert.equal(await count('short'), 3); assert.equal(await page.locator('#short button').count(), 0, 'a short list has no button');
  assert.equal(await page.locator('#none').textContent(), 'No activity yet');
  assert.deepEqual(errors, []);
  console.log('PASS: profile activity shows five, then Show more.');
} finally { await browser.close(); }
