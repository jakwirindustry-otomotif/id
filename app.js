// ===== KONFIGURASI: isi sesuai Project Settings → API =====
const SUPABASE_URL = 'https://mykqpjrpopwiuaybpyyz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wMI4r-ij1-9nsFWkG22tYQ_9EDVL5LM';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pub = (bucket, path) => path ? sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : '';
let products = [], cats = [], chart;

function toast(msg) { const d = document.createElement('div'); d.textContent = msg; $('toast').append(d); setTimeout(() => d.remove(), 3500); }
async function run(fn) { // loading + error handling terpusat
  $('loading').style.display = 'block';
  try { return await fn(); } catch (e) { toast('Terjadi kesalahan: ' + (e.message || 'coba lagi')); console.error(e); }
  finally { $('loading').style.display = 'none'; }
}
const ok = ({ data, error }) => { if (error) throw new Error(error.code === '23505' ? 'Data duplikat (nama/SKU/slug sudah dipakai)' : error.code === '23503' ? 'Tidak bisa dihapus: masih dipakai data lain' : error.message); return data; };
function navigateTo(id) { ['katalog', 'login', 'admin'].forEach((s) => ($(s).hidden = s !== id)); scrollTo(0, 0); }

// Dark mode
const setTheme = (t) => { document.documentElement.dataset.theme = t; localStorage.setItem('jio-theme', t); };
setTheme(localStorage.getItem('jio-theme') || 'light');
$('theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

// ===== PUBLIK =====
async function loadCatalog() {
  await run(async () => {
    cats = ok(await sb.from('categories').select('*').order('name'));
    products = ok(await sb.from('products').select('*, product_images(image_path,position), product_links(marketplace,affiliate_url)').order('created_at', { ascending: false }));
    const bn = ok(await sb.from('banners').select('*').order('position'));
    const lg = ok(await sb.from('partner_logos').select('*').order('position'));
    const cfg = ok(await sb.from('app_config').select('*'));
    const sp = cfg.find((c) => c.key === 'marquee_speed')?.value || 30;
    $('cat').innerHTML = '<option value="">Semua kategori</option>' + cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    $('banners').innerHTML = bn.filter((b) => b.type === 'discount').map((b) => `<div class="banner mb-2"${b.image_path ? ` style="background:linear-gradient(#0007,#0007),url('${pub('banners', b.image_path)}') center/cover"` : ''}>${esc(b.title)}</div>`).join('');
    $('social').innerHTML = bn.filter((b) => b.type === 'social').map((b) => `<a href="${esc(b.target_url || '#')}" target="_blank" rel="noopener noreferrer">${b.image_path ? `<img src="${pub('banners', b.image_path)}" alt="" style="width:100%;border-radius:10px;margin-bottom:6px">` : ''}${esc(b.title)}</a>`).join('');
    const imgs = lg.map((l) => `<img src="${pub('partner-logos', l.image_path)}" alt="${esc(l.name)}" loading="lazy">`).join('');
    $('marquee').style.setProperty('--sp', sp + 's'); $('marquee').innerHTML = imgs + imgs;
    $('marquee').parentElement.hidden = !lg.length;
    renderGrid();
  });
}
function renderGrid() {
  const q = $('q').value.toLowerCase(), c = $('cat').value;
  const list = products.filter((p) => p.status === 'aktif' && p.name.toLowerCase().includes(q) && (!c || p.category_id === c));
  $('grid').innerHTML = list.length ? list.map((p) => {
    const im = [...p.product_images].sort((a, b) => a.position - b.position)[0];
    const d = p.price_discount ? Math.round((1 - p.price_discount / p.price_normal) * 100) : 0;
    return `<div class="pcard" onclick="openProduct('${p.id}')">${d ? `<span class="badge-d">-${d}%</span>` : ''}
      ${im ? `<img src="${pub('product-images', im.image_path)}" loading="lazy" alt="">` : '<div class="ph"></div>'}
      <div class="b"><small class="text-secondary">${esc(cats.find((x) => x.id === p.category_id)?.name)}</small><div class="fw-semibold">${esc(p.name)}</div>
      <span class="price">${rp(p.price_discount ?? p.price_normal)}</span> ${d ? `<span class="old">${rp(p.price_normal)}</span>` : ''}</div></div>`;
  }).join('') : '<p class="text-secondary">Produk tidak ditemukan.</p>';
}
$('q').oninput = renderGrid; $('cat').onchange = renderGrid;

let gi = 0;
function openProduct(id) {
  const p = products.find((x) => x.id === id); gi = 0;
  const im = [...p.product_images].sort((a, b) => a.position - b.position).map((i) => pub('product-images', i.image_path));
  const btn = (m, label, cls) => p.product_links.find((l) => l.marketplace === m) ? `<button class="${cls} mb-2" onclick="goLink('${p.id}','${m}')">${label}</button>` : '';
  $('modalBody').innerHTML = `<div class="d-flex justify-content-between"><h2>${esc(p.name)}</h2><button class="btn-ghost" onclick="$('modal').hidden=true">Tutup</button></div>
    <div class="gal" id="gal"><img id="gimg" src="${im[0] || ''}" alt="" onclick="gal.classList.toggle('z')">
    <div class="d-flex justify-content-between my-2"><button class="btn-ghost" onclick="slide(-1)">‹</button><span id="gct">1 / ${im.length || 1}</span><button class="btn-ghost" onclick="slide(1)">›</button></div></div>
    <span class="price" style="font-size:32px">${rp(p.price_discount ?? p.price_normal)}</span> ${p.price_discount ? `<span class="old">${rp(p.price_normal)}</span>` : ''}
    <p class="mt-2">${esc(p.description)}</p>${btn('shopee', 'Beli di Shopee', 'btn-jio w-100')}${btn('tokopedia', 'Beli di Tokopedia / TikTok Shop', 'btn-tk')}
    <small class="text-secondary">Kamu akan diarahkan ke marketplace.</small>`;
  window.slideImgs = im; $('modal').hidden = false;
}
function slide(d) { const a = window.slideImgs; if (!a.length) return; gi = (gi + d + a.length) % a.length; $('gimg').src = a[gi]; $('gct').textContent = `${gi + 1} / ${a.length}`; }
function goLink(pid, m) { // buka link dulu, catat klik di belakang layar
  const url = products.find((x) => x.id === pid).product_links.find((l) => l.marketplace === m).affiliate_url;
  window.open(url, '_blank', 'noopener'); sb.rpc('track_click', { p_product: pid, p_marketplace: m });
}

// ===== AUTH & ADMIN =====
$('adminBtn').onclick = async () => { const { data } = await sb.auth.getSession(); data.session ? enterAdmin() : navigateTo('login'); };
$('loginForm').onsubmit = (e) => { e.preventDefault(); run(async () => { ok(await sb.auth.signInWithPassword({ email: $('em').value, password: $('pw').value })); await enterAdmin(); }); };
$('logout').onclick = async () => { await sb.auth.signOut(); navigateTo('katalog'); };
async function enterAdmin() {
  const { data: { user } } = await sb.auth.getUser();
  const pr = ok(await sb.from('profiles').select('role').eq('id', user.id).single());
  if (pr.role !== 'admin') { await sb.auth.signOut(); return toast('Akun ini bukan admin.'); }
  navigateTo('admin'); renderTabs(); loadAdmin();
}
async function loadAdmin() {
  await run(async () => {
    const ev = ok(await sb.from('click_events').select('product_id,marketplace,clicked_at'));
    const sh = ev.filter((e) => e.marketplace === 'shopee').length, tk = ev.length - sh;
    const today = ev.filter((e) => new Date(e.clicked_at).toDateString() === new Date().toDateString()).length;
    $('kpi').innerHTML = [['Total Produk', products.length], ['Produk Aktif', products.filter((p) => p.status === 'aktif').length], ['Total Klik', ev.length], ['Klik Hari Ini', today]].map(([l, v]) => `<div><small>${l}</small><br><b>${v}</b></div>`).join('');
    const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); return d.toDateString(); });
    const cnt = (m) => days.map((d) => ev.filter((e) => e.marketplace === m && new Date(e.clicked_at).toDateString() === d).length);
    chart?.destroy();
    chart = new Chart($('chart'), { type: 'line', data: { labels: days.map((d) => d.slice(4, 10)), datasets: [{ label: 'Shopee', data: cnt('shopee'), borderColor: '#FF6A00', backgroundColor: '#FF6A0033', fill: true }, { label: 'Tokopedia', data: cnt('tokopedia'), borderColor: '#9ACD32', backgroundColor: '#9ACD3233', fill: true }] } });
    const by = {}; ev.forEach((e) => (by[e.product_id] = (by[e.product_id] || 0) + 1));
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    const tn = top && products.find((p) => p.id === top[0])?.name;
    $('insight').textContent = ev.length ? `Total ${ev.length} klik: Shopee ${Math.round(sh / ev.length * 100)}%, Tokopedia ${Math.round(tk / ev.length * 100)}%. Produk terklik terbanyak: ${tn} (${top[1]} klik).` : 'Belum ada data klik.';
    const cl = (id, m) => ev.filter((e) => e.product_id === id && e.marketplace === m).length;
    const all = ok(await sb.from('products').select('*').order('created_at', { ascending: false }));
    $('ptable').innerHTML = all.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.sku)}</td><td>${rp(p.price_discount ?? p.price_normal)}</td><td>${esc(p.status)}</td><td>${cl(p.id, 'shopee')} / ${cl(p.id, 'tokopedia')}</td>
      <td><button class="btn-ghost" onclick="editProduct('${p.id}')">Ubah</button> <button class="btn-ghost" onclick="delProduct('${p.id}')">Hapus</button></td></tr>`).join('');
  });
}
async function compress(file) { // kecilkan proporsional (maks 1200px) → WebP
  const bmp = await createImageBitmap(file), r = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: bmp.width * r, height: bmp.height * r });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/webp', 0.8));
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
$('newP').onclick = () => editProduct();
async function editProduct(id) {
  const p = id ? ok(await sb.from('products').select('*, product_links(marketplace,affiliate_url)').eq('id', id).single()) : {};
  const lk = (m) => p.product_links?.find((l) => l.marketplace === m)?.affiliate_url || '';
  $('modalBody').innerHTML = `<h2>${id ? 'Ubah' : 'Tambah'} Produk</h2><form id="pf" class="d-grid gap-2">
    <input name="name" class="form-control" placeholder="Nama produk" value="${esc(p.name)}" required><input name="sku" class="form-control" placeholder="SKU (opsional)" value="${esc(p.sku)}">
    <select name="category_id" class="form-select" required>${cats.map((c) => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <textarea name="description" class="form-control" placeholder="Deskripsi">${esc(p.description)}</textarea>
    <input name="price_normal" type="number" min="0" class="form-control" placeholder="Harga normal" value="${p.price_normal ?? ''}" required>
    <input name="price_discount" type="number" min="0" class="form-control" placeholder="Harga diskon (kosongkan jika tidak)" value="${p.price_discount ?? ''}">
    <select name="status" class="form-select">${['aktif', 'draft', 'nonaktif'].map((s) => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <input name="shopee" type="url" class="form-control" placeholder="Link Shopee" value="${esc(lk('shopee'))}"><input name="tokopedia" type="url" class="form-control" placeholder="Link Tokopedia / TikTok Shop" value="${esc(lk('tokopedia'))}">
    <label class="small">Foto (maks. 3, otomatis diperkecil)</label><input name="fotos" type="file" accept="image/*" multiple class="form-control">
    <div class="d-flex gap-2"><button class="btn-jio">Simpan</button><button type="button" class="btn-ghost" onclick="$('modal').hidden=true">Batal</button></div></form>`;
  $('modal').hidden = false;
  $('pf').onsubmit = (e) => { e.preventDefault(); saveProduct(e.target, id); };
}
function saveProduct(f, id) {
  run(async () => {
    const v = Object.fromEntries(new FormData(f));
    const nn = Number(v.price_normal), nd = v.price_discount === '' ? null : Number(v.price_discount);
    if (nd !== null && nd > nn) throw new Error('Harga diskon tidak boleh lebih besar dari harga normal.');
    const files = [...f.fotos.files].slice(0, 3);
    const row = { name: v.name, sku: v.sku || null, category_id: v.category_id, description: v.description, price_normal: nn, price_discount: nd, status: v.status };
    const pid = id ? (ok(await sb.from('products').update(row).eq('id', id).select().single()).id)
      : ok(await sb.from('products').insert({ ...row, slug: slug(v.name) + '-' + Date.now().toString(36) }).select().single()).id;
    for (const [i, file] of files.entries()) {
      const path = `${pid}/${i + 1}-${Date.now()}.webp`;
      ok(await sb.storage.from('product-images').upload(path, await compress(file), { contentType: 'image/webp' }));
      ok(await sb.from('product_images').upsert({ product_id: pid, image_path: path, position: i + 1 }, { onConflict: 'product_id,position' }));
    }
    for (const m of ['shopee', 'tokopedia']) {
      if (v[m]) ok(await sb.from('product_links').upsert({ product_id: pid, marketplace: m, affiliate_url: v[m] }, { onConflict: 'product_id,marketplace' }));
      else await sb.from('product_links').delete().match({ product_id: pid, marketplace: m });
    }
    $('modal').hidden = true; toast('Produk tersimpan.'); await loadCatalog(); loadAdmin();
  });
}
async function delProduct(id) { if (!confirm('Hapus produk ini?')) return; await run(async () => { ok(await sb.from('products').delete().eq('id', id)); toast('Produk dihapus.'); await loadCatalog(); loadAdmin(); }); }

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') navigateTo('katalog'); });
loadCatalog();

// ===== ADMIN: TAB KATEGORI / BANNER / LOGO / STATISTIK =====
const TABS = { produk: 'Produk', kategori: 'Kategori', banner: 'Banner', logo: 'Logo Toko', statistik: 'Statistik Klik' };
const CRUD = {
  kategori: { table: 'categories', order: 'name', cols: ['name', 'slug', 'deskripsi'], fields: [['name', 'Nama kategori', 'text', 1], ['deskripsi', 'Deskripsi', 'text'], ['ikon', 'Ikon (opsional)', 'text']] },
  banner: { table: 'banners', order: 'position', move: 1, cols: ['type', 'title', 'is_active'], fields: [['type', 'Tipe', 'select', 1, ['discount', 'social']], ['title', 'Judul / tulisan banner', 'text', 1], ['target_url', 'Link tujuan (wajib untuk sosmed)', 'url'], ['image_path', 'Gambar (opsional)', 'image', 0, 'banners'], ['is_active', 'Aktif', 'check']] },
  logo: { table: 'partner_logos', order: 'position', move: 1, img: 'partner-logos', cols: ['name', 'is_active'], fields: [['name', 'Nama toko', 'text', 1], ['image_path', 'Logo toko', 'image', 1, 'partner-logos'], ['is_active', 'Aktif', 'check']] },
};
function renderTabs(active = 'produk') {
  $('tabs').innerHTML = Object.entries(TABS).map(([k, v]) => `<button class="${k === active ? 'on' : ''}" onclick="renderTabs('${k}')">${v}</button>`).join('');
  $('tab-produk').hidden = active !== 'produk'; $('tab-other').hidden = active === 'produk';
  if (active === 'statistik') statsView(); else if (active !== 'produk') crudView(active);
}
async function crudView(t) {
  const c = CRUD[t];
  await run(async () => {
    const rows = ok(await sb.from(c.table).select('*').order(c.order));
    const th = c.cols.map((x) => `<th>${x}</th>`).join('');
    const body = rows.map((r, i) => `<tr>${c.img ? `<td><img class="thumb" src="${pub(c.img, r.image_path)}" alt=""></td>` : ''}${c.cols.map((x) => `<td>${typeof r[x] === 'boolean' ? (r[x] ? '✔' : '—') : esc(r[x])}</td>`).join('')}
      <td class="text-nowrap">${c.move ? `<button class="btn-ghost" onclick="moveRow('${t}',${i},-1)">▲</button> <button class="btn-ghost" onclick="moveRow('${t}',${i},1)">▼</button> ` : ''}<button class="btn-ghost" onclick="crudForm('${t}','${r.id}')">Ubah</button> <button class="btn-ghost" onclick="crudDel('${t}','${r.id}')">Hapus</button></td></tr>`).join('');
    const set = t === 'logo' ? `<div class="card-box"><b>Pengaturan Marquee</b><div class="d-flex gap-2 mt-2"><input id="spd" type="number" min="5" class="form-control" style="max-width:160px" value="${ok(await sb.from('app_config').select('value').eq('key', 'marquee_speed').maybeSingle())?.value || 30}"><button class="btn-jio" onclick="saveSpeed()">Simpan kecepatan (detik/putaran)</button></div></div>` : '';
    $('tab-other').innerHTML = `<div class="d-flex justify-content-between align-items-center"><h2>${TABS[t]}</h2><button class="btn-jio" onclick="crudForm('${t}')">+ Tambah</button></div>${set}
      <div class="card-box table-responsive"><table class="table"><thead><tr>${c.img ? '<th></th>' : ''}${th}<th></th></tr></thead><tbody>${body || '<tr><td>Belum ada data.</td></tr>'}</tbody></table></div>`;
  });
}
async function crudForm(t, id) {
  const c = CRUD[t], r = id ? ok(await sb.from(c.table).select('*').eq('id', id).single()) : { is_active: true };
  const f = c.fields.map(([k, l, ty, req, o]) => ty === 'select' ? `<label class="small">${l}</label><select name="${k}" class="form-select">${o.map((x) => `<option ${x === r[k] ? 'selected' : ''}>${x}</option>`).join('')}</select>`
    : ty === 'check' ? `<label><input type="checkbox" name="${k}" ${r[k] ? 'checked' : ''}> ${l}</label>`
    : ty === 'image' ? `<label class="small">${l}${r[k] ? ' (kosongkan jika tidak diganti)' : ''}</label><input type="file" name="${k}" accept="image/*" class="form-control" ${req && !r[k] ? 'required' : ''}>`
    : `<input name="${k}" type="${ty}" class="form-control" placeholder="${l}" value="${esc(r[k])}" ${req ? 'required' : ''}>`).join('');
  $('modalBody').innerHTML = `<h2>${id ? 'Ubah' : 'Tambah'} ${TABS[t]}</h2><form id="cf" class="d-grid gap-2">${f}<div class="d-flex gap-2"><button class="btn-jio">Simpan</button><button type="button" class="btn-ghost" onclick="$('modal').hidden=true">Batal</button></div></form>`;
  $('modal').hidden = false;
  $('cf').onsubmit = (e) => { e.preventDefault(); crudSave(t, id, e.target); };
}
function crudSave(t, id, f) {
  const c = CRUD[t];
  run(async () => {
    const row = {};
    for (const [k, , ty, , o] of c.fields) {
      if (ty === 'check') row[k] = f[k].checked;
      else if (ty === 'image') { const file = f[k].files[0]; if (file) { const path = `${Date.now()}.webp`; ok(await sb.storage.from(o).upload(path, await compress(file), { contentType: 'image/webp' })); row[k] = path; } }
      else row[k] = f[k].value.trim() || null;
    }
    if (t === 'banner' && row.type === 'social' && !row.target_url) throw new Error('Banner sosmed wajib punya link tujuan.');
    if (t === 'kategori') row.slug = slug(row.name);
    if (id) ok(await sb.from(c.table).update(row).eq('id', id));
    else { if (c.move) { const l = ok(await sb.from(c.table).select('position').order('position', { ascending: false }).limit(1)); row.position = (l[0]?.position || 0) + 1; } ok(await sb.from(c.table).insert(row)); }
    $('modal').hidden = true; toast('Tersimpan.'); await crudView(t); loadCatalog();
  });
}
async function crudDel(t, id) { if (!confirm('Hapus data ini?')) return; await run(async () => { ok(await sb.from(CRUD[t].table).delete().eq('id', id)); toast('Dihapus.'); await crudView(t); loadCatalog(); }); }
async function moveRow(t, i, d) {
  await run(async () => {
    const rows = ok(await sb.from(CRUD[t].table).select('id').order('position')), j = i + d;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [n, r] of rows.entries()) ok(await sb.from(CRUD[t].table).update({ position: n + 1 }).eq('id', r.id));
    await crudView(t); loadCatalog();
  });
}
async function saveSpeed() { await run(async () => { ok(await sb.from('app_config').upsert({ key: 'marquee_speed', value: String(Math.max(5, Number($('spd').value) || 30)) })); toast('Kecepatan disimpan.'); loadCatalog(); }); }

let sortK = 'total', sortD = -1, sRows = [], c2, c3;
async function statsView() {
  const o = $('tab-other');
  if (!$('sf')) {
    o.innerHTML = `<h2>STATISTIK KLIK</h2><div class="card-box d-flex flex-wrap gap-2" id="sf"><input id="s1" type="date" class="form-control w-auto"><input id="s2" type="date" class="form-control w-auto">
      <select id="s3" class="form-select w-auto"><option value="">Semua kategori</option>${cats.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
      <select id="s4" class="form-select w-auto"><option value="">Semua marketplace</option><option value="shopee">Shopee</option><option value="tokopedia">Tokopedia</option></select>
      <input id="s5" class="form-control w-auto" placeholder="Cari produk"><button class="btn-jio" onclick="statsLoad()">Terapkan</button><button class="btn-ghost" onclick="statsCsv()">Ekspor CSV</button></div>
      <div class="kpi" id="sk"></div><div class="row"><div class="col-md-8"><div class="card-box"><canvas id="c2"></canvas></div></div><div class="col-md-4"><div class="card-box"><canvas id="c3"></canvas></div></div></div>
      <div class="card-box table-responsive"><table class="table"><thead><tr>${[['name', 'Produk'], ['shopee', 'Shopee'], ['tokopedia', 'Tokopedia'], ['total', 'Total']].map(([k, l]) => `<th style="cursor:pointer" onclick="statsSort('${k}')">${l} ⇅</th>`).join('')}</tr></thead><tbody id="st"></tbody></table></div>`;
  }
  statsLoad();
}
function statsLoad() {
  run(async () => {
    let q = sb.from('click_events').select('marketplace,clicked_at,products(name,category_id)');
    if ($('s1').value) q = q.gte('clicked_at', $('s1').value); if ($('s2').value) q = q.lte('clicked_at', $('s2').value + 'T23:59:59');
    if ($('s4').value) q = q.eq('marketplace', $('s4').value);
    const ev = ok(await q).filter((e) => e.products && (!$('s3').value || e.products.category_id === $('s3').value) && e.products.name.toLowerCase().includes($('s5').value.toLowerCase()));
    const m = {}; ev.forEach((e) => { const r = (m[e.products.name] ||= { name: e.products.name, shopee: 0, tokopedia: 0, total: 0 }); r[e.marketplace]++; r.total++; });
    sRows = Object.values(m); const sh = ev.filter((e) => e.marketplace === 'shopee').length;
    $('sk').innerHTML = [['Total Klik', ev.length], ['Klik Shopee', sh], ['Klik Tokopedia', ev.length - sh]].map(([l, v]) => `<div><small>${l}</small><br><b>${v}</b></div>`).join('');
    c2?.destroy(); c3?.destroy();
    const top = [...sRows].sort((a, b) => b.total - a.total).slice(0, 10);
    c2 = new Chart($('c2'), { type: 'bar', data: { labels: top.map((r) => r.name.slice(0, 22)), datasets: [{ label: 'Klik', data: top.map((r) => r.total), backgroundColor: '#FF6A00', borderRadius: 6 }] }, options: { indexAxis: 'y' } });
    c3 = new Chart($('c3'), { type: 'doughnut', data: { labels: ['Shopee', 'Tokopedia'], datasets: [{ data: [sh, ev.length - sh], backgroundColor: ['#FF6A00', '#9ACD32'] }] } });
    statsTable();
  });
}
function statsSort(k) { sortD = sortK === k ? -sortD : -1; sortK = k; statsTable(); }
function statsTable() {
  sRows.sort((a, b) => (a[sortK] > b[sortK] ? 1 : -1) * sortD);
  $('st').innerHTML = sRows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.shopee}</td><td>${r.tokopedia}</td><td><b>${r.total}</b></td></tr>`).join('') || '<tr><td colspan="4">Tidak ada data.</td></tr>';
}
function statsCsv() {
  const csv = 'Produk,Shopee,Tokopedia,Total\n' + sRows.map((r) => `"${r.name.replace(/"/g, '""')}",${r.shopee},${r.tokopedia},${r.total}`).join('\n');
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'statistik-klik.csv' }).click();
}
