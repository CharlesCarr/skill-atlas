import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { layout, NODE_W, NODE_H, tones, toneColors, type Direction } from './layout';
import { issuesForExport, resolvePath } from './workspace';
import type { Workspace } from './types';
export const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function lines(text: string, width: number, max: number) {
  const words = text.split(/\s+/),
    result: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).length > width && line) {
      result.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + word;
  }
  if (line) result.push(line);
  return result
    .slice(0, max)
    .map((l, i) => (i === max - 1 && result.length > max ? l.slice(0, width - 1) + '…' : l));
}
export function diagramSvg(w: Workspace, direction: Direction = 'LR') {
  const nodes = layout(w, direction),
    byId = new Map(nodes.map((n) => [n.id, n]));
  const width = Math.max(...nodes.map((n) => n.x + NODE_W)) + 60,
    height = Math.max(...nodes.map((n) => n.y + NODE_H)) + 100;
  const edges = w.connections
    .map((e) => {
      const a = byId.get(e.from)!,
        b = byId.get(e.to)!;
      let sx = a.x + NODE_W,
        sy = a.y + NODE_H / 2,
        tx = b.x,
        ty = b.y + NODE_H / 2;
      if (direction === 'TB') {
        sx = a.x + NODE_W / 2;
        sy = a.y + NODE_H;
        tx = b.x + NODE_W / 2;
        ty = b.y;
      }
      const curve =
        direction === 'LR'
          ? `C ${sx + 50},${sy} ${tx - 50},${ty} ${tx},${ty}`
          : `C ${sx},${sy + 50} ${tx},${ty - 50} ${tx},${ty}`;
      return `<path d="M ${sx},${sy} ${curve}" fill="none" stroke="#9a9a9a" stroke-width="1.5" ${e.type !== 'handoff' ? 'stroke-dasharray="5 5"' : ''} marker-end="url(#arrow)"/><text x="${(sx + tx) / 2}" y="${(sy + ty) / 2 - 8}" text-anchor="middle" font-size="10" fill="#616161">${escape(e.label)}</text>`;
    })
    .join('');
  const cards = nodes
    .map((n) => {
      const color = toneColors[n.kind === 'human' ? 'ink' : tones[n.index % tones.length]];
      return `<a href="#step-${encodeURIComponent(n.id)}"><g transform="translate(${n.x},${n.y})"><rect width="${NODE_W}" height="${NODE_H}" rx="12" fill="white" stroke="${color}" stroke-opacity=".4"/><rect width="4" height="${NODE_H - 22}" x="1" y="11" rx="2" fill="${color}"/><text x="18" y="27" fill="${color}" font-size="10">${String(n.index + 1).padStart(2, '0')} · ${escape(n.phase ?? 'SKILL')}</text>${lines(
        n.title,
        26,
        2,
      )
        .map(
          (l, i) =>
            `<text x="18" y="${53 + i * 20}" fill="#323232" font-size="16" font-weight="600">${escape(l)}</text>`,
        )
        .join('')}${lines(n.description, 34, 2)
        .map(
          (l, i) =>
            `<text x="18" y="${99 + i * 16}" fill="#6f6f6f" font-size="11">${escape(l)}</text>`,
        )
        .join(
          '',
        )}<text x="18" y="164" font-size="10" fill="${color}">${escape(n.skill ?? 'human decision')}</text></g></a>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(w.bundle.title)}"><title>${escape(w.bundle.title)}</title><rect width="100%" height="100%" fill="#f6f6f6"/><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9a9a9a"/></marker></defs><g font-family="sans-serif">${edges}${cards}</g><text x="30" y="${height - 25}" font-family="sans-serif" font-size="11" fill="#6f6f6f">Skill Atlas · ${w.authored ? 'Authored workflow' : 'References only; no execution order inferred'} · Solid: handoff · Dashed: reference / feedback</text></svg>`;
}
export function snapshotHtml(w: Workspace, direction: Direction = 'LR') {
  const fileIds = new Map(w.bundle.files.map((f, i) => [f.path, `source-${i}`]));
  function markdown(body: string, path: string) {
    return renderToStaticMarkup(
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children }) => {
            const resolved = resolvePath(path, href),
              id = fileIds.get(resolved ?? path);
            if (resolved || href.startsWith('#'))
              return id && (!resolved || fileIds.has(resolved)) ? (
                <a href={`#${id}`}>{children}</a>
              ) : (
                <span>{children} (file not included)</span>
              );
            return (
              <a href={href} rel="noopener noreferrer" target="_blank">
                {children}
              </a>
            );
          },
          img: ({ alt }) => <span>Image: {alt || 'referenced media'} (not included)</span>,
        }}
      >
        {body}
      </ReactMarkdown>,
    );
  }
  const stepHtml = w.steps
    .map((s, i) => {
      const skill = w.skills.find((k) => k.id === s.skill);
      return `<article id="step-${escape(encodeURIComponent(s.id))}"><div class="eyebrow">Step ${i + 1} · ${escape(s.phase ?? 'Workflow')}</div><h2>${escape(s.title ?? skill?.title ?? s.id)}</h2><p>${escape(s.description ?? skill?.description ?? '')}</p><div class="io">${s.inputs?.length ? `<div><b>Inputs</b><ul>${s.inputs.map((v) => `<li>${escape(v)}</li>`).join('')}</ul></div>` : ''}${s.outputs?.length ? `<div><b>Outputs</b><ul>${s.outputs.map((v) => `<li>${escape(v)}</li>`).join('')}</ul></div>` : ''}</div>${skill ? `<a href="#${fileIds.get(skill.path)}">Read ${escape(skill.id)} →</a>` : '<p>Human decision · no skill is executed.</p>'}</article>`;
    })
    .join('');
  const docs = w.bundle.files
    .map((f) => {
      const skill = w.skills.find((s) => s.path === f.path);
      return `<article id="${fileIds.get(f.path)}"><div class="eyebrow">${escape(f.path)}</div>${skill ? `<h2>${escape(skill.title)}</h2><p>${escape(skill.description)}</p>` : ''}<div class="markdown">${/\.md$/i.test(f.path) ? markdown(skill?.body ?? f.content, f.path) : `<pre>${escape(f.content)}</pre>`}</div><details><summary>Original source · preserved verbatim</summary><pre>${escape(f.content)}</pre></details></article>`;
    })
    .join('');
  const issues = w.issues.length
    ? `<details><summary>Source issues (${w.issues.length})</summary><ul>${w.issues.map((i) => `<li>${escape(i.path ?? '')}: ${escape(i.message)}</li>`).join('')}</ul></details>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(w.bundle.title)} · Skill Atlas</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f6f6;color:#323232;font:15px/1.7 ui-sans-serif,sans-serif}header,main,footer{max-width:1120px;margin:auto;padding:32px}header{padding-top:60px}h1{font-size:44px;letter-spacing:-2px;line-height:1.2}h2{font-size:25px;letter-spacing:-.6px}h3{font-size:18px}a{color:#5f5f5f}article{background:white;border:1px solid #e1e1e1;padding:36px;border-radius:16px;margin:24px 0;scroll-margin-top:20px}.eyebrow{font:11px/1.5 monospace;text-transform:uppercase;color:#6e6e6e;overflow-wrap:anywhere}nav{display:flex;gap:18px;flex-wrap:wrap}svg{width:100%;height:auto;min-width:650px}.diagram{overflow:auto;border:1px solid #e1e1e1;border-radius:16px}.io{display:flex;gap:60px}pre{background:#f1f1f1;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}code{font-family:monospace}table{border-collapse:collapse;display:block;overflow:auto}td,th{padding:10px;border:1px solid #e1e1e1}blockquote{border-left:3px solid #9b9b9b;padding-left:20px;color:#656565}summary{cursor:pointer}details{margin:20px 0}p,li{overflow-wrap:anywhere}@media(max-width:600px){header,main,footer{padding:20px}article{padding:22px}h1{font-size:34px}.io{flex-wrap:wrap;gap:15px}}@media print{details{display:block}article{break-inside:avoid}.diagram svg{min-width:0}body{background:white}}</style></head><body><header><div class="eyebrow">Skill Atlas / Workflow snapshot</div><h1>${escape(w.bundle.title)}</h1><p>${escape(w.bundle.description)}</p><p>${w.skills.length} skills · ${w.steps.length} steps · ${w.authored ? 'Authored workflow' : 'Markdown references; no execution order inferred'}<br>${escape(issuesForExport(w))}</p><nav><a href="#map">Workflow map</a><a href="#steps">Step by step</a><a href="#documents">Source documents</a></nav>${issues}</header><main><div id="map" class="diagram">${diagramSvg(w, direction)}</div><h2 id="steps">Step by step</h2>${stepHtml}<h2 id="documents">Source documents</h2>${docs}</main><footer>Created with Skill Atlas · A read-only documentation snapshot · No external assets or scripts · ${new Date().toISOString().slice(0, 10)}</footer></body></html>`;
}
