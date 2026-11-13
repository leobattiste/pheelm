// Shared by the email scripts: compiles emails/PheelmEmail.tsx on the fly and reads emails/catalog.json.
import fs from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { render } from 'react-email';

const root = new URL('../../', import.meta.url);
export const catalog = JSON.parse(await fs.readFile(new URL('emails/catalog.json', root), 'utf8'));

/** The compiled component, `render(props)` for HTML or text. Cleans up after itself. */
export async function withEmail(run) {
  const source = await fs.readFile(new URL('emails/PheelmEmail.tsx', root), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const tmp = new URL('emails/.render-tmp.mjs', root);
  await fs.writeFile(tmp, compiled);
  try {
    const { default: Email } = await import(tmp.href + '?t=' + Date.now());
    const html = (props) => render(React.createElement(Email, props));
    const text = (props) => render(React.createElement(Email, props), { plainText: true });
    return await run({ html, text });
  } finally { await fs.unlink(tmp); }
}

export const hasUnsubscribe = (t) => ['optional', 'marketing'].includes(t.category);
/** The words each template contributes. Everything else (links, name, year) is filled in when it is sent. */
export const staticProps = (t) => ({ title: t.title, preheader: t.preheader, rows: t.rows, guide: t.guide ?? [], note: t.note, actionLabel: t.button });

export const write = (path, data) => fs.writeFile(new URL(path, root), data);
export const file = (path) => new URL(path, root);
