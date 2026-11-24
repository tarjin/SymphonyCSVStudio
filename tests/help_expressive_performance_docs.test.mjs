import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const help=read('site/help/index.html');
const docs={
  pitched:read('site/help/specs/pitched.html'),
  tab:read('site/help/specs/guitar-tab.html'),
  drums:read('site/help/specs/drums.html')
};

test('Prominent expressive section follows getting-started and precedes SoundFonts',()=>{
  const start=help.indexOf('id="start"');
  const expr=help.indexOf('id="expression"');
  const sound=help.indexOf('id="soundfonts"');
  assert.ok(start>=0 && expr>start && sound>expr);
  assert.match(help,/<h2 id="expression-heading">Compose the performance, not just the notes\.<\/h2>/);
  assert.match(help,/href="#expression">Explore performance controls<\/a>/);
  assert.match(help,/<section class="section" id="expression" aria-labelledby="expression-heading">/);
  assert.match(help,/<div class="wide-panel" id="expression-midi">/);
});

test('Each of six musical tracks is explained and linked to its canonical format',()=>{
  for(const [range,path] of [['Tracks 1–2','pitched.html'],['Tracks 3–4','guitar-tab.html'],['Tracks 5–6','drums.html']]){
    const part=help.slice(help.indexOf('id="expression"'),help.indexOf('id="soundfonts"'));
    assert.ok(part.includes(range));
    assert.ok(part.includes('href="/help/specs/'+path+'"'));
    assert.ok(existsSync('site/help/specs/'+path));
  }
  assert.match(help,/individual string velocities, string emphasis/);
  assert.match(help,/optional microtiming offsets/);
});

test('MIDI table states supported velocity, timing, pan routing and portability limits',()=>{
  const fragment=help.slice(help.indexOf('id="expression-midi"'),help.indexOf('id="soundfonts"'));
  for(const phrase of ['MIDI tick','1–127','MIDI CC10','additional MIDI channels',
    'General MIDI guarantees percussion on channel 10 only',
    'not necessarily General MIDI drum keys','CSV remains the source of truth',
    'not embedded']){
    assert.ok(fragment.includes(phrase),'Missing caveat or feature: '+phrase);
  }
  assert.match(fragment,/role="region" tabindex="0"/);
  assert.match(help,/\.expression-table-scroll\{max-width:100%;overflow-x:auto/);
});

test('All format pages explain event velocity and panning accurately',()=>{
  assert.match(docs.pitched,/Expressive note performance in MIDI/);
  assert.match(docs.pitched,/1–127/);
  assert.match(docs.pitched,/MIDI CC10/);
  assert.match(docs.tab,/individual performed-string velocity/);
  assert.match(docs.tab,/Authored per-string stereo positions are exported as MIDI CC10/);
  assert.match(docs.drums,/Expressive drum performance in MIDI/);
  assert.match(docs.drums,/microtiming is rounded to the nearest representable MIDI tick/);
  assert.match(docs.drums,/General MIDI only guarantees drum sounds on channel 10/);
  for(const page of Object.values(docs))
    assert.ok(page.includes('href="/help/#expression-midi"'),'Format guide missing context link');
});

test('Help section ids are unique and local documentation anchors resolve',()=>{
  const ids=[...help.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,'Duplicate help IDs');
  for(const link of ['#start','#expression','#expression-midi','#soundfonts']){
    assert.ok(help.includes('id="'+link.slice(1)+'"'),'Unresolved anchor: '+link);
  }
  assert.equal((help.match(/<section\b/g)||[]).length,(help.match(/<\/section>/g)||[]).length);
  assert.equal((help.match(/<table\b/g)||[]).length,(help.match(/<\/table>/g)||[]).length);
});
