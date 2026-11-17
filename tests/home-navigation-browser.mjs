// Exercise the real menu components with a signed-in account and a signed-out visitor.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
let signedIn = true, refreshSession = false, userChecks = 0, claimChecks = 0;
const proxyModule = {};
vm.runInNewContext(compile('proxy.ts'), { exports: proxyModule, require: name => {
  if (name === 'next/server') return { NextResponse };
  if (name === '@/lib/supabase/config') return { supabaseEnabled: true, SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_ANON_KEY: 'fixture' };
  if (name === '@supabase/ssr') return { createServerClient: (_url, _key, options) => ({ auth: {
    async getUser() {
      userChecks++;
      if (refreshSession) options.cookies.setAll([{ name: 'sb-fixture-auth-token', value: 'refreshed-session', options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } }]);
      return { data: { user: signedIn ? { id: 'member' } : null } };
    },
    async getClaims() { claimChecks++; return { data: { claims: signedIn ? { sub: 'member' } : null }, error: null }; },
  } }) };
  throw Error(`Unexpected proxy import: ${name}`);
} });
const request = (path, hasSession = false) => new NextRequest(`https://pheelm.test${path}`, hasSession ? { headers: { cookie: 'sb-fixture-auth-token=old-session' } } : undefined);
refreshSession = true;
const memberRoot = await proxyModule.proxy(request('/?old=landing', true));
assert.equal(memberRoot.headers.get('location'), 'https://pheelm.test/home');
assert.equal(memberRoot.cookies.get('sb-fixture-auth-token').value, 'refreshed-session');
assert.equal(memberRoot.cookies.get('sb-fixture-auth-token').httpOnly, true, 'redirect retains refreshed session cookie attributes');
assert.equal(memberRoot.cookies.get('sb-fixture-auth-token').secure, true);
assert.equal(userChecks, 1);
signedIn = false; refreshSession = false;
const guestHome = await proxyModule.proxy(request('/home?source=menu'));
const join = new URL(guestHome.headers.get('location'));
assert.equal(join.pathname, '/');
assert.equal(join.searchParams.get('join'), '1');
assert.equal(join.searchParams.get('next'), '/home?source=menu');
assert.equal(userChecks, 1, 'signed-out requests do not query auth');
const fakeSession = await proxyModule.proxy(request('/home', true));
assert.equal(new URL(fakeSession.headers.get('location')).searchParams.get('next'), '/home');
assert.equal(claimChecks, 1, 'a cookie alone cannot open the member homepage');
signedIn = true;
assert.equal((await proxyModule.proxy(request('/home', true))).headers.get('location'), null, 'authenticated home does not redirect back to itself');
const safeNavigation = {}, signInForm = {};
vm.runInNewContext(compile('lib/safe-navigation.ts'), { exports: safeNavigation, URL });
vm.runInNewContext(compile('components/SignInForm.tsx'), { exports: signInForm, process: { env: {} }, require: name => name === '@/lib/safe-navigation' ? safeNavigation : {} });
assert.equal(signInForm.safeNext(null), '/home');
assert.equal(signInForm.safeNext('https://elsewhere.test'), '/home');
assert.equal(signInForm.safeNext('/films/moonlight?from=watchlist#watch-h'), '/films/moonlight?from=watchlist#watch-h', 'explicit sign-in deep links are retained');
console.log('PASS: member root redirects to Home with refreshed cookies; Home remains gated; explicit sign-in destinations survive.');

const bundle = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Header from './components/SiteHeader';import TabBar from './components/TabBar';createRoot(document.getElementById('root')).render(<><Header/><TabBar/></>);`, resolveDir: process.cwd(), loader: 'tsx' },
  define: { 'process.env': '{}' }, bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: 'tsconfig.json',
  plugins: [{ name: 'navigation-fixture', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    b.onResolve({ filter: /supabase\/client$/ }, () => ({ path: 'client', namespace: 'fixture' }));
    b.onResolve({ filter: /SignInSheet$/ }, () => ({ path: 'signin', namespace: 'fixture' }));
    b.onResolve({ filter: /NavProgressLine$/ }, () => ({ path: 'progress', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: {
      navigation: `import{useState,useEffect}from'react';export const useRouter=()=>({push(){}});export function usePathname(){const[p,set]=useState(location.pathname);useEffect(()=>{const on=()=>set(location.pathname);addEventListener('fixture:navigate',on);return()=>removeEventListener('fixture:navigate',on)},[]);return p}`,
      link: `import React from'react';export default function Link({href,children,onClick,...props}){return <a href={href} {...props} onClick={e=>{onClick?.(e);e.preventDefault();history.pushState({},'',href);dispatchEvent(new Event('fixture:navigate'))}}>{children}</a>}`,
      client: `export function getBrowserClient(){return{auth:{getUser:async()=>({data:{user:window.signedIn?{id:'member',email:'member@example.test'}:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table){return{select(){return this},eq(){return this},is(){return Promise.resolve({count:2})},maybeSingle:async()=>({data:{handle:'member',display_name:'Member'}})}}}}`,
      signin: `export function openSignIn(){window.signinOpened=true;return true}export default function SignInSheet(){return null}`,
      progress: `export default function NavProgressLine(){return null}`,
    }[path], loader: 'jsx', resolveDir: process.cwd() }));
  } }],
});

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
try {
  for (const signedIn of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('http://pheelm.test/**', route => route.fulfill({ contentType: 'text/html', body: `<html data-theme="dark" data-auth="${signedIn ? 'in' : 'out'}" data-chrome="app"><body><div id="root"></div></body></html>` }));
    await page.goto('http://pheelm.test/home');
    await page.evaluate(value => { window.signedIn = value; }, signedIn);
    await page.addStyleTag({ content: fs.readFileSync('app/globals.css', 'utf8') });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const bar = page.locator('.tab-bar');
    await bar.getByRole('link', { name: 'Home', exact: true }).waitFor();
    assert.deepEqual(await bar.locator('a').evaluateAll(links => links.map(link => link.getAttribute('aria-label'))), ['Home', 'Films', 'Watchlists', 'Directors']);
    assert.equal(await bar.locator('a').first().getAttribute('aria-current'), 'page');
    await bar.getByRole('button', { name: /^More/ }).click();
    const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
    await menu.waitFor();
    // App chrome hides the duplicate section links; visitor/header chrome can show them.
    const main = menu.locator('.menu-main');
    assert.deepEqual(await main.locator('a').evaluateAll(links => links.map(link => link.textContent.trim())), ['Home', 'Films', 'Watchlists', 'Directors']);
    assert.equal(await main.locator('a').first().getAttribute('href'), '/home');
    assert.equal(await main.locator('a').first().getAttribute('aria-current'), 'page');
    if (signedIn) {
      const account = menu.getByRole('navigation', { name: 'Your account', exact: true });
      await account.getByRole('link', { name: 'Profile', exact: true }).waitFor();
      assert.deepEqual(await account.locator('a').evaluateAll(links => links.map(link => link.textContent.trim().replace(/\s+/g, ' '))), ['Profile', 'Notifications2', 'Watchlists', 'Settings']);
      assert.equal(await account.getByRole('link', { name: 'Profile', exact: true }).getAttribute('href'), '/@member');
      assert.equal(await bar.locator('.tab-dot').count(), 1);
      await account.getByRole('link', { name: 'Profile', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('#menu').open);
      assert.equal(new URL(page.url()).pathname, '/@member');
    } else {
      await menu.getByRole('button', { name: 'Sign in', exact: true }).click();
      assert.equal(await page.evaluate(() => window.signinOpened), true);
      assert.equal(await menu.isVisible(), false);
    }
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.close();
  }
  console.log('PASS: Home is first and active, profile is above notifications inside More, unread dot survives, and visitors can sign in from the expanded menu.');
} finally { await browser.close(); }
