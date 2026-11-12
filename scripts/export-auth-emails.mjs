import fs from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { render } from 'react-email';
import { authTemplates } from './auth-email-templates.mjs';

const source = await fs.readFile(new URL('../emails/PheelmEmail.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const tmp = new URL('../emails/.auth-render.mjs', import.meta.url);
await fs.writeFile(tmp, compiled, {mode:0o600});
try {
  const {default: Email} = await import(tmp.href);
  for (const template of authTemplates) {
    const element = React.createElement(Email, {...template, ...(template.code ? {code:'{{ .Token }}'} : {})});
    await fs.writeFile(new URL(`../supabase/email/${template.name}.html`, import.meta.url), await render(element));
  }
  console.log('Exported code-only sign-in, signup, recovery and reauthentication emails, plus email-change confirmation.');
} finally {
  await fs.unlink(tmp);
}
