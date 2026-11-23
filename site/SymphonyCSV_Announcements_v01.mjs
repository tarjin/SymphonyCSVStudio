/* SymphonyCSV Studio — P066E Announcements accordion and static JSON feed.
 * Updates publish as a stand-alone JSON file, with no application rebuild.
 * Untrusted text is rendered through textContent; links are strictly site-relative.
 * No accounts, tracking, or access to saved compositions.
 */

const READ_KEY = 'symphonycsv.studio.announcements.seen.v1';
const DISMISSED_PINS_KEY = 'symphonycsv.studio.announcements.dismissed-pins.v1';
const MAX_MESSAGES = 30;
const KINDS = new Set(['LABS', 'Tip', 'Coming Soon', 'What’s New', 'Important Notice', 'Sponsored']);
const MAX_SPONSOR_DAYS = 7;
const OFFLINE_WELCOME = {"schema_version":1,"updated_at":"2026-11-23","messages":[{"id":"labs-nps-feedback-2026-11-23","kind":"LABS","published_at":"2026-11-23","title":"LABS Feedback — Tell Us What You Think","pinned":true,"blocks":[{"type":"paragraph","text":"Help shape the future of **SymphonyCSV Studio**! Answer two short questions about your experience and help us make the Studio better for musicians."},{"type":"paragraph","text":"**No account required.** Your feedback helps guide our improvements as we work toward BETA."},{"type":"link","label":"Give Feedback","href":"./feedback/"}]},{"id":"labs-v1-welcome-2026-11-23","kind":"LABS","published_at":"2026-11-23","title":"Welcome to SymphonyCSV Studio LABS!","blocks":[{"type":"paragraph","text":"**November 23, 2026 · LABS Version 1**"},{"type":"paragraph","text":"Welcome to **SymphonyCSV Studio — the DAW before the DAW.**"},{"type":"paragraph","text":"SymphonyCSV Studio is a new music composition environment where musical ideas become readable, editable CSV files."},{"type":"paragraph","text":"Compose, experiment, audition, and shape your music before taking it into a traditional Digital Audio Workstation—or export your music directly as a finished recording."},{"type":"paragraph","text":"**What can you do in LABS?**"},{"type":"bullets","items":["**Six synchronized musical tracks:** Two Piano Roll tracks, two Guitar TAB tracks, and two Drum tracks.","**Realistic guitar performances:** Unlike traditional piano-roll notation, our Guitar TAB format models string-specific performances, including chords, strumming, and expressive playing techniques.","**Three SymphonyCSV formats:** Work directly with structured CSV files representing pitched instruments, guitar performances, and drums.","**SoundFont instruments:** Audition compositions with sampled instruments and percussion.","**Creative effects:** Shape your music with Chorus, Delay, Reverb, and a Master Compressor.","**Five-Band Master Graphic EQ:** Fine-tune your entire mix, from deep bass to sparkling highs.","**High-quality audio exports:** Download stereo WAV recordings or 320 kbps MP3 files.","**MIDI export:** Take your compositions into other music applications.","**Portable Projects:** Save your composition, settings, and supported SoundFont assets together in a Project ZIP.","**Local-first privacy:** Your musical files are processed in your browser, not uploaded to a server."]},{"type":"paragraph","text":"**What does LABS mean?**"},{"type":"paragraph","text":"**LABS is our experimental development environment.** SymphonyCSV Studio is functional and evolving. Some features are still being developed, and you may encounter limitations as we improve the application."},{"type":"paragraph","text":"Please keep copies of your original files and exported Project ZIPs. Browser storage can be cleared, and externally supplied SoundFonts may have redistribution restrictions."},{"type":"paragraph","text":"**Your music. Your data. Your creativity.**"},{"type":"paragraph","text":"You don’t need to be a programmer to explore SymphonyCSV. You can edit your music in a spreadsheet, work directly with the CSV files, or collaborate with an AI assistant to develop musical ideas."},{"type":"paragraph","text":"**Welcome aboard. Let’s make some music!**"},{"type":"paragraph","text":"*Powered by SymphonyCSV Studio.*\n*Visit SymphonyCSVStudio.com*"}]},{"id":"tip-midi-getting-started-2026-11-23","kind":"Tip","published_at":"2026-11-23","title":"Getting Started Tip: Turn MIDI into Your Own Composition","blocks":[{"type":"paragraph","text":"**Have a MIDI file? Let’s turn it into music you can edit!**"},{"type":"steps","items":["Open the **Import MIDI** workspace in SymphonyCSV Studio.","Drag and drop a `.mid` or `.midi` file to convert it into SymphonyCSV.","**Download the CSV** and open it in a text editor or spreadsheet. Explore how notes, timing, velocities, and other musical details are represented.","**Make it your own!** Change some notes, adjust velocities, or experiment with the timing. Save your edited CSV.","Open **Track 1 — Piano Roll** and drag your CSV into the track.","Press **Play** and hear your changes come to life!"]},{"type":"paragraph","text":"**Congratulations! You’ve just started composing with SymphonyCSV.**"},{"type":"paragraph","text":"Your music is now readable, editable data. You can even ask an AI assistant to help you develop your composition."}]}]};

function validText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
function validHelpHref(href) {
  // Resolve against the feed directory, not a bundled JS asset. Reject network,
  // scheme, traversal and percent-encoded links. Future Help pages can live at
  // ./help/topic.html (or another site-relative path) in GitHub Pages.
  return typeof href === 'string' && href.length <= 300 &&
    /^\.\/[A-Za-z0-9][A-Za-z0-9._/-]*(?:#[A-Za-z0-9_-]+)?$/.test(href) &&
    !href.includes('..') && !href.includes('//');
}
function validSponsorUrl(value) {
  if (typeof value !== 'string' || value.length > 300) return false;
  try {
    const parsed=new URL(value);
    // No query-string tracking, fragments, credentials or non-HTTPS URLs.
    return parsed.protocol==='https:' && Boolean(parsed.hostname) &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch { return false; }
}
function parseSponsorTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))
    throw Error('Sponsored dates must use UTC ISO timestamps');
  const ms=Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString()!==value.replace('Z','.000Z'))
    throw Error('Invalid sponsor timestamp');
  return ms;
}
function normalizeSponsorship(message) {
  if (message.kind!=='Sponsored') {
    if (['sponsor_name','sponsor_url','starts_at','ends_at','collapsed_by_default']
        .some(key=>Object.hasOwn(message,key)))
      throw Error('Sponsorship properties are only valid for Sponsored entries');
    if (Object.hasOwn(message,'pinned') && message.pinned!==true)
      throw Error('Editorial pinned property must be true when present');
    return null;
  }
  if (message.pinned!==true || message.collapsed_by_default!==true ||
      !validText(message.sponsor_name,100) || !validSponsorUrl(message.sponsor_url))
    throw Error('Sponsored entry requires a pinned, collapsed, identified sponsor and safe URL');
  const start=parseSponsorTimestamp(message.starts_at);
  const end=parseSponsorTimestamp(message.ends_at);
  if (end<=start || end-start>MAX_SPONSOR_DAYS*86400000)
    throw Error('Sponsored placement must be positive and no longer than seven days');
  return {sponsor_name:message.sponsor_name.trim(),sponsor_url:message.sponsor_url,
    starts_at:message.starts_at,ends_at:message.ends_at,pinned:true,collapsed_by_default:true};
}
export function activeAnnouncements(messages, now=new Date(), dismissedPins=new Set()) {
  const instant=now instanceof Date?now.getTime():new Date(now).getTime();
  if (!Number.isFinite(instant)) throw Error('Invalid current time');
  return messages.filter(item => item.kind!=='Sponsored' ||
    (Date.parse(item.starts_at)<=instant && instant<Date.parse(item.ends_at)))
    .sort((a,b)=>{
      // Notices retain their safety priority; active sponsors retain their original
      // placement; a reader may dismiss an editorial pin without hiding its message.
      const rank=item=>item.kind==='Important Notice'?0:item.kind==='Sponsored'?1:
        item.pinned===true?(dismissedPins.has(item.id)?4:2):3;
      return rank(a)-rank(b)||b.published_at.localeCompare(a.published_at)||a.id.localeCompare(b.id);
    });
}

function normalizeBlock(block) {
  if (!block || typeof block !== 'object') throw new Error('Invalid announcement block');
  if (block.type === 'paragraph' && validText(block.text, 1200)) {
    return {type:'paragraph', text:block.text.trim()};
  }
  if ((block.type === 'bullets' || block.type === 'steps') && Array.isArray(block.items) &&
      block.items.length >= 1 && block.items.length <= 12 &&
      block.items.every(item => validText(item, 500))) {
    return {type:block.type, items:block.items.map(item => item.trim())};
  }
  if (block.type === 'link' && validText(block.label, 160) && validHelpHref(block.href)) {
    return {type:'link',label:block.label.trim(),href:block.href};
  }
  throw new Error('Invalid announcement block');
}

export function normalizeAnnouncementsFeed(raw) {
  if (!raw || raw.schema_version !== 1 || !Array.isArray(raw.messages) || raw.messages.length > MAX_MESSAGES) {
    throw new Error('Unsupported announcement feed');
  }
  const ids = new Set();
  const sponsorshipWindows=[];
  let editorialPins=0;
  const messages = raw.messages.map(m => {
    if (!m || typeof m !== 'object' ||
        typeof m.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,90}$/.test(m.id) || ids.has(m.id) ||
        !KINDS.has(m.kind) ||
        typeof m.published_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.published_at) ||
        !Number.isFinite(Date.parse(`${m.published_at}T00:00:00Z`)) ||
        !validText(m.title,180)) {
      throw new Error('Invalid announcement record');
    }
    // Accept older v1 feeds with 'paragraphs', while publishing richer 'blocks'.
    const hasBlocks = Array.isArray(m.blocks);
    const hasParagraphs = Array.isArray(m.paragraphs);
    if (hasBlocks === hasParagraphs) throw new Error('Announcement needs blocks or paragraphs');
    const blocks = hasBlocks ? m.blocks : m.paragraphs.map(text => ({type:'paragraph',text}));
    if (!blocks.length || blocks.length > 16) throw new Error('Invalid announcement block count');
    const cleanBlocks = blocks.map(normalizeBlock);
    const sponsorship=normalizeSponsorship(m);
    if (sponsorship) sponsorshipWindows.push([Date.parse(sponsorship.starts_at),Date.parse(sponsorship.ends_at)]);
    if (m.pinned===true && m.kind!=='Sponsored') editorialPins++;
    ids.add(m.id);
    return {...{id:m.id,kind:m.kind,published_at:m.published_at,title:m.title.trim(),blocks:cleanBlocks},
      ...(m.pinned===true && m.kind!=='Sponsored'?{pinned:true}:{}),
      ...(sponsorship||{})};
  });
  if (editorialPins>1) throw Error('Only one editorial announcement may be pinned');
  sponsorshipWindows.sort((a,b)=>a[0]-b[0]);
  for (let i=1;i<sponsorshipWindows.length;i++) {
    if (sponsorshipWindows[i][0]<sponsorshipWindows[i-1][1])
      throw Error('Sponsored placement windows must not overlap');
  }
  messages.sort((a,b)=>b.published_at.localeCompare(a.published_at)||a.id.localeCompare(b.id));
  return {schema_version:1,messages};
}

export function countUnread(messages, seenIds) {
  const seen = new Set(seenIds);
  return messages.filter(m => m.kind!=='Sponsored' && !seen.has(m.id)).length;
}

export function splitInlineFormatting(text) {
  // Only **bold** and *italic*. Every token is inserted via textContent.
  const tokens=[];
  const re=/(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*)/g;
  let pos=0, match;
  while ((match=re.exec(text)) !== null) {
    if (match.index>pos) tokens.push({kind:'text',value:text.slice(pos,match.index)});
    tokens.push({kind:match[2]!==undefined?'bold':'italic',value:match[2]??match[3]});
    pos=re.lastIndex;
  }
  if (pos<text.length) tokens.push({kind:'text',value:text.slice(pos)});
  return tokens;
}
export function plainAnnouncementText(item) {
  const plain = text => text.replace(/\*\*([^*\n]+)\*\*/g,'$1').replace(/\*([^*\n]+)\*/g,'$1');
  const body = item.blocks.map(block => block.type === 'paragraph'
    ? plain(block.text)
    : block.type === 'link' ? `${block.label} (${block.href})`
    : block.items.map((x,i)=>block.type==='steps'?`${i+1}. ${plain(x)}`:`• ${plain(x)}`).join('\n')).join('\n\n');
  const sponsor=item.kind==='Sponsored'?`\nSponsored by ${item.sponsor_name}\n${item.sponsor_url}`:'';
  return `${item.title}\n${item.kind} · ${item.published_at}${sponsor}\n\n${body}`;
}

function getSeenIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(id => typeof id === 'string' && id.length < 100).slice(-150);
  } catch { return []; }
}
function getDismissedPinIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_PINS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(id=>typeof id==='string' && id.length<100).slice(-150);
  } catch { return []; }
}
function rememberSeen(messages) {
  const ids = new Set(getSeenIds());
  for (const message of messages) ids.add(message.id);
  try { localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-150))); }
  catch { /* read status is best effort; saved compositions unaffected */ }
}
function displayDate(iso) {
  return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})
    .format(new Date(`${iso}T00:00:00Z`));
}

function addText(doc,parent,tag,className,value) {
  const el=doc.createElement(tag);
  if (className) el.className=className;
  el.textContent=value; // NEVER render announcement strings as HTML.
  parent.append(el);
  return el;
}
function appendFormatted(doc, container, text) {
  for (const token of splitInlineFormatting(text)) {
    if (token.kind==='text') container.append(doc.createTextNode(token.value));
    else addText(doc,container,token.kind==='bold'?'strong':'em','',token.value);
  }
}
function renderBlock(doc,entry,block,feedUrl) {
  if (block.type==='paragraph') {
    const p=doc.createElement('p'); appendFormatted(doc,p,block.text); entry.append(p);
  } else if (block.type==='link') {
    // href was validated above; resolve only against the same-origin feed URL.
    const row=doc.createElement('p');row.className='scsv-announcement-help-link';
    const link=addText(doc,row,'a','',block.label);
    link.href=new URL(block.href,feedUrl).href;
    link.rel='noopener noreferrer';
    row.append(link);entry.append(row);
  } else {
    const list=doc.createElement(block.type==='steps'?'ol':'ul');
    list.className='scsv-announcement-bullets';
    for (const text of block.items) {
      const li=doc.createElement('li');appendFormatted(doc,li,text);list.append(li);
    }
    entry.append(list);
  }
}

async function copyToClipboard(doc,content) {
  const nav=doc.defaultView?.navigator ?? (typeof navigator!=='undefined'?navigator:null);
  if (nav?.clipboard?.writeText) {
    try {await nav.clipboard.writeText(content);return true;} catch { /* fallback */ }
  }
  // Fallback for browsers where Clipboard API is unavailable.
  const area=doc.createElement('textarea');
  area.value=content;
  area.setAttribute('readonly','');
  area.style.cssText='position:fixed;left:-9999px;top:-9999px';
  doc.body.append(area);area.select();
  let success=false;
  try {success=!!doc.execCommand?.('copy');} catch {}
  area.remove();return success;
}

export function mountAnnouncements({document:doc=document,fetchImpl=fetch,clock=()=>new Date()}={}) {
  const openButton=doc.getElementById('scsv-announcements-open');
  const dialog=doc.getElementById('scsv-announcements-dialog');
  const closeButton=doc.getElementById('scsv-announcements-close');
  const refreshButton=doc.getElementById('scsv-announcements-refresh');
  const expandAllButton=doc.getElementById('scsv-announcements-expand-all');
  const collapseAllButton=doc.getElementById('scsv-announcements-collapse-all');
  const list=doc.getElementById('scsv-announcements-list');
  const status=doc.getElementById('scsv-announcements-status');
  const dot=doc.getElementById('scsv-announcements-unread');
  if (![openButton,dialog,closeButton,refreshButton,expandAllButton,collapseAllButton,
        list,status,dot].every(Boolean)) return;

  // Resolve relative to the *Studio page*, not import.meta.url: Vite may emit
  // a hashed JS bundle, while the JSON stays at a stable GitHub Pages URL.
  const requested=dialog.getAttribute('data-feed-url')||'../SymphonyCSV_Announcements.json';
  const feedUrl=new URL(requested,doc.baseURI);
  const siteUrl=new URL(doc.baseURI);
  if (!['http:','https:'].includes(feedUrl.protocol) || feedUrl.origin!==siteUrl.origin) {
    throw Error('Announcement feed must be same-origin HTTPS/HTTP');
  }

  let feed=normalizeAnnouncementsFeed(OFFLINE_WELCOME);
  let source='bundled';
  const expanded=new Set();
  let hasOpened=false;
  let visibilityTimer=null;
  const dismissedPins=new Set(getDismissedPinIds());
  function visible() {return activeAnnouncements(feed.messages,clock(),dismissedPins);}
  function dismissEditorialPin(id) {
    dismissedPins.add(id);
    try {localStorage.setItem(DISMISSED_PINS_KEY,JSON.stringify([...dismissedPins].slice(-150)));} catch {}
    render();updateButton();
  }
  function schedulePlacementUpdate() {
    const win=doc.defaultView;
    if (visibilityTimer!==null) win?.clearTimeout?.(visibilityTimer);
    visibilityTimer=null;
    if (!win?.setTimeout) return;
    const now=clock().getTime();
    const future=feed.messages.filter(m=>m.kind==='Sponsored')
      .flatMap(m=>[Date.parse(m.starts_at),Date.parse(m.ends_at)])
      .filter(t=>t>now);
    if (!future.length) return;
    const delay=Math.min(Math.min(...future)-now+20,2147483647);
    visibilityTimer=win.setTimeout(()=>{render();updateButton();schedulePlacementUpdate();},delay);
  }
  function markRead(items) {
    rememberSeen(items);
    updateButton();
  }
  function updateButton() {
    const unread=countUnread(visible(),getSeenIds());
    dot.hidden=unread===0;
    openButton.setAttribute('aria-label',unread?`Announcements, ${unread} unread`:'Announcements');
    openButton.title=unread?`${unread} unread announcement${unread===1?'':'s'}`:'Announcements';
  }
  function render() {
    list.replaceChildren();
    const seen=new Set(getSeenIds());
    for (const item of visible()) {
      const entry=doc.createElement('article');
      const isEditorialPin=item.kind!=='Sponsored' && item.pinned===true && !dismissedPins.has(item.id);
      if (item.kind==='Sponsored') entry.className='scsv-announcement-entry scsv-announcement-sponsored';
      if (item.kind!=='Sponsored') entry.className=isEditorialPin
        ?'scsv-announcement-entry scsv-announcement-pinned':'scsv-announcement-entry';
      const head=doc.createElement('button');
      head.type='button';head.className='scsv-announcement-toggle';
      const bodyId=`scsv-announcement-body-${item.id}`;
      const headId=`scsv-announcement-head-${item.id}`;
      head.id=headId;
      head.setAttribute('aria-controls',bodyId);
      const isExpanded=expanded.has(item.id);
      head.setAttribute('aria-expanded',String(isExpanded));
      const chevron=addText(doc,head,'span','scsv-announcement-chevron','▸');
      chevron.setAttribute('aria-hidden','true');
      const heading=doc.createElement('span');heading.className='scsv-announcement-heading';
      addText(doc,heading,'span','scsv-announcement-meta',item.kind==='Sponsored'
        ? `SPONSORED · ${item.sponsor_name} · ${displayDate(item.published_at)}`
        : `${isEditorialPin?'PINNED · ':''}${item.kind} · ${displayDate(item.published_at)}`);
      addText(doc,heading,'span','scsv-announcement-title',item.title.replace(/Version 1\b/,'Version\u00a01'));
      head.append(heading);
      const unreadBadge=addText(doc,head,'span','scsv-announcement-new','NEW');
      unreadBadge.hidden=item.kind==='Sponsored'||seen.has(item.id);
      const body=doc.createElement('div');
      body.id=bodyId;body.className='scsv-announcement-body';
      body.hidden=!isExpanded;
      body.setAttribute('role','region');body.setAttribute('aria-labelledby',headId);
      for (const block of item.blocks) renderBlock(doc,body,block,feedUrl);
      if (item.kind==='Sponsored') {
        const row=doc.createElement('p');row.className='scsv-announcement-sponsor-link';
        const link=addText(doc,row,'a','','Visit sponsor');
        link.href=item.sponsor_url;
        link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
        body.append(row);
      }
      const controls=doc.createElement('div');controls.className='scsv-announcement-actions';
      if (isEditorialPin) {
        const dismiss=addText(doc,controls,'button','scsv-announcement-dismiss-pin','Dismiss pin');
        dismiss.type='button';
        dismiss.addEventListener('click',()=>dismissEditorialPin(item.id));
      }
      const copy=addText(doc,controls,'button','','Copy Announcement');
      copy.type='button';
      const feedback=addText(doc,controls,'span','scsv-announcement-copy-feedback','');
      feedback.setAttribute('role','status');
      copy.addEventListener('click',async()=>{
        copy.disabled=true;
        try {
          const ok=await copyToClipboard(doc,plainAnnouncementText(item));
          feedback.textContent=ok?'Copied to clipboard.':'Unable to copy automatically. Select the text to copy.';
        } finally {copy.disabled=false;}
      });
      head.addEventListener('click',()=>{
        const next=!expanded.has(item.id);
        if (next) {
          expanded.add(item.id);
          if (item.kind!=='Sponsored') {
            markRead([item]);
            unreadBadge.hidden=true;
          }
        } else expanded.delete(item.id);
        head.setAttribute('aria-expanded',String(next));
        body.hidden=!next;
      });
      body.append(controls);
      entry.append(head,body);
      list.append(entry);
    }
    // Successful updates need no banner; preserve warning space only when offline.
    status.hidden=source==='online';
    status.textContent=source==='online'?'':'Showing built-in announcements (online updates unavailable)';
  }
  async function refresh() {
    refreshButton.disabled=true;
    try {
      const response=await fetchImpl(feedUrl.href,{cache:'no-store',credentials:'same-origin'});
      if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
      const body=await response.text();
      if (body.length>70000) throw new Error('Announcement feed too large');
      feed=normalizeAnnouncementsFeed(JSON.parse(body));
      source='online';
      // Discard stale expansion state when entries disappear from the feed.
      const ids=new Set(visible().map(item=>item.id));
      for (const id of expanded) if (!ids.has(id)) expanded.delete(id);
    } catch {
      if (source!=='online') {feed=normalizeAnnouncementsFeed(OFFLINE_WELCOME);source='bundled';}
    } finally {
      refreshButton.disabled=false;render();updateButton();schedulePlacementUpdate();
    }
  }
  openButton.addEventListener('click',()=>{
    if (!hasOpened) {
      hasOpened=true;
      // A paid placement can be pinned first, but must NEVER auto-expand.
      // Do not automatically expand a feedback invitation when Announcements opens.
      const firstEditorial=visible().find(item=>item.kind!=='Sponsored' &&
        !(item.pinned===true && !dismissedPins.has(item.id)));
      if (firstEditorial) expanded.add(firstEditorial.id);
    }
    markRead(visible().filter(item=>item.kind!=='Sponsored'&&expanded.has(item.id)));
    render();
    if (typeof dialog.showModal==='function') dialog.showModal();
    else dialog.setAttribute('open','');
  });
  closeButton.addEventListener('click',()=>dialog.close());
  refreshButton.addEventListener('click',()=>void refresh());
  expandAllButton.addEventListener('click',()=>{
    for (const item of visible()) expanded.add(item.id);
    markRead(feed.messages);
    render();
  });
  collapseAllButton.addEventListener('click',()=>{
    expanded.clear();render();
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  render();updateButton();void refresh();
}
if (typeof document!=='undefined') {
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>mountAnnouncements(),{once:true});
  else mountAnnouncements();
}
