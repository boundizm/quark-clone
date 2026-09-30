const app = document.getElementById('app');
const $ = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) el.append(k);
  return el;
};
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { showLogin(); throw new Error('unauthorized'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { alert(data.error ?? 'Request failed'); throw new Error(data.error); }
  return data;
}
const toast = (msg) => { const t = $('div', { className: 'muted', textContent: msg }); app.prepend(t); setTimeout(() => t.remove(), 2500); };

function showLogin() {
  app.replaceChildren($('div', { className: 'card' },
    $('h2', { textContent: 'Sign in' }),
    $('p', { textContent: 'Log in with Discord to manage your servers.' }),
    $('a', { href: '/auth/login' }, $('button', { textContent: 'Log in with Discord' }))));
}

async function showGuilds() {
  const me = await api('/me');
  document.getElementById('user').textContent = me.username;
  const out = document.getElementById('logout'); out.hidden = false;
  out.onclick = async () => { await fetch('/auth/logout', { method: 'POST' }); location.reload(); };
  const guilds = await api('/guilds');
  app.replaceChildren($('div', { className: 'card' }, $('h2', { textContent: 'Your servers' }),
    $('div', { className: 'grid' }, guilds.map((g) => $('button', {
      className: 'tile', disabled: !g.botPresent, textContent: g.name + (g.botPresent ? '' : ' (bot not added)'),
      onclick: () => showGuild(g),
    })))));
}

async function showGuild(g) {
  const [d, cat] = await Promise.all([api('/guilds/' + g.id), api('/catalog')]);
  const routeOf = (ev) => d.routes.find((r) => r.event_type === ev)?.channel_id ?? '';
  const chSelect = (ev) => {
    const s = $('select', {}, $('option', { value: '', textContent: '— off —' }),
      d.channels.map((c) => $('option', { value: c.id, textContent: '#' + c.name })));
    s.value = routeOf(ev);
    s.onchange = async () => { await api(`/guilds/${g.id}/routes`, 'PUT', { event: ev, channelId: s.value || null }); toast('Saved'); };
    return s;
  };
  const limit = cat.tiers[d.tier].maxRetentionDays;
  const retention = $('input', { type: 'number', min: 1, max: limit, value: d.settings.retention_days });
  const spoiler = $('input', { type: 'checkbox', checked: d.settings.spoiler_logs });
  const saveSettings = async () => { await api(`/guilds/${g.id}/settings`, 'PUT', { retentionDays: Number(retention.value), spoilerLogs: spoiler.checked }); toast('Saved'); };

  const routes = $('div', { className: 'card' }, $('h2', { textContent: 'Log channels' }),
    $('p', { className: 'muted', textContent: 'Set a channel per category. Open a category to override single event types.' }),
    Object.entries(cat.categories).map(([name, types]) => $('details', {},
      $('summary', {}, $('strong', { textContent: name }), ' ', chSelect(name)),
      types.map((t) => $('div', { className: 'row' }, $('label', { textContent: t }), chSelect(t))))));

  const settings = $('div', { className: 'card' }, $('h2', { textContent: `Settings (${d.tier} plan)` }),
    $('div', { className: 'row' }, $('label', { textContent: `Message retention (1–${limit} days)` }), retention),
    $('div', { className: 'row' }, $('label', { textContent: 'Spoiler-wrap logs' }), spoiler),
    $('button', { textContent: 'Save settings', onclick: saveSettings }));

  const tagName = $('input', { placeholder: 'name' }), tagBody = $('textarea', { placeholder: 'content', rows: 2 });
  const tags = $('div', { className: 'card' }, $('h2', { textContent: 'Tags' }),
    d.tags.map((t) => $('div', { className: 'row' }, $('code', { textContent: t.name }), $('span', { className: 'muted', textContent: t.content.slice(0, 80) }),
      $('button', { className: 'ghost', textContent: 'Delete', onclick: async () => { await api(`/guilds/${g.id}/tags/${encodeURIComponent(t.name)}`, 'DELETE'); showGuild(g); } }))),
    $('div', { className: 'row' }, tagName, tagBody, $('button', { textContent: 'Add', onclick: async () => {
      await api(`/guilds/${g.id}/tags/${encodeURIComponent(tagName.value)}`, 'PUT', { content: tagBody.value }); showGuild(g);
    } })));

  app.replaceChildren($('button', { className: 'ghost', textContent: '← Servers', onclick: showGuilds }),
    $('h2', { textContent: g.name }), routes, settings, tags);
}

showGuilds().catch(() => {});
