// The global search entry points navigate to the search page instead of opening a dialog.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Search,{openSearch}from'./components/Search';import Header from'./components/SiteHeader';import TabBar from './components/TabBar';window.openSearch=openSearch;createRoot(document.getElementById('root')).render(<><Search/><Header/><TabBar/></>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env': '{}' },
  plugins: [{ name: 'search-navigation-fixture', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    b.onResolve({ filter: /\/(AccountMenu|SignInSheet|FeedbackLink)$/ }, ({ path }) => ({ path: path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'jsx', resolveDir: process.cwd(), contents: {
      navigation: `const router={push(href){window.searchPushes.push(href);history.pushState({},'',href)}};export const useRouter=()=>router;export const usePathname=()=>'/films';`,
      link: `import React from'react';export default function Link({href,children,onClick,...props}){return <a href={href} {...props} onClick={e=>{onClick?.(e);if(!e.defaultPrevented){e.preventDefault();window.searchPushes.push(href);history.pushState({},'',href)}}}>{children}</a>}`,
      AccountMenu: `export default function AccountMenu({children}){return children}`,
      SignInSheet: `export const openSignIn=()=>true;export default function SignInSheet(){return null}`,
      FeedbackLink: `import React from'react';export default function FeedbackLink({children,onNavigate,...props}){return <a href="/feedback" {...props} onClick={onNavigate}>{children}</a>}`,
    }[path] }));
  } }],
});

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://pheelm.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div><main><input id="search-input" type="search" value="Moonlight"/><textarea id="typing"></textarea><div id="editable" contenteditable="true">Text</div></main></body></html>' }));
  await page.goto('https://pheelm.test/films?q=Moonlight');
  await page.evaluate(() => { window.searchPushes = []; });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.locator('.header-tools a[href="/search"]').first().waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  await page.keyboard.press('Control+k');
  assert.equal(new URL(page.url()).pathname, '/search');
  assert.equal(new URL(page.url()).searchParams.get('q'), 'Moonlight', 'the existing catalog query survives');
  assert.equal(await page.locator('.search-dialog').count(), 0, 'no search popup is rendered');
  const count = () => page.evaluate(() => window.searchPushes.length);
  const beforeFocus = await count();
  await page.keyboard.press('Meta+k');
  assert.equal(await count(), beforeFocus, 'reopening search does not duplicate browser history');
  assert.equal(await page.locator('#search-input').evaluate(input => document.activeElement === input), true, 'reopening search focuses its input');

  for (const selector of ['#search-input', '#typing', '#editable']) {
    await page.locator(selector).focus();
    await page.keyboard.press('/');
    assert.equal(await count(), beforeFocus, `slash remains text in ${selector}`);
  }
  await page.evaluate(() => { history.replaceState({}, '', '/watchlists'); document.activeElement.blur(); });
  await page.keyboard.press('/');
  assert.equal(new URL(page.url()).pathname, '/search');
  assert.equal(new URL(page.url()).search, '', 'unrelated pages open an empty search');
  await page.evaluate(() => window.openSearch('  Dust & Dreams / Africa  '));
  assert.equal(new URL(page.url()).searchParams.get('q'), 'Dust & Dreams / Africa', 'explicit queries are encoded safely');
  await page.evaluate(() => { history.replaceState({}, '', '/directors?q=Semb%C3%A8ne'); window.dispatchEvent(new Event('open-search')); });
  assert.equal(new URL(page.url()).searchParams.get('q'), 'Sembène', 'legacy open-search events still work');

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.header-tools a[aria-label="Search"]').count(), 2, 'both header states link directly to Search');
    await page.evaluate(() => { window.dispatchEvent(new Event('pheelm:menu')); });
    const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
    await menu.waitFor();
    assert.equal(await menu.getByRole('link', {name:'Search',exact:true}).count(),0,'search moved to main navigation');
    await menu.getByRole('button',{name:'Close menu',exact:true}).click();
  }
  assert.equal(await page.locator('.tab-bar a[aria-label=Search]').count(),1);
  assert.equal(await page.locator('.tab-bar a[aria-label=Profile]').count(),0);
  assert.deepEqual(errors, []);
  console.log('PASS: keyboard, exported/legacy events and header/menu links open the full search page, preserve queries, focus existing search, and leave typing alone.');
} finally { await browser.close(); }
