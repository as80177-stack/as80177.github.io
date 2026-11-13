const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalizeCycle} = require('../data-model.js');
const clone = x => JSON.parse(JSON.stringify(x));
function legacy(oddNotes = [], evenNotes = []) {
  const weeks = notes => [{id:'week-1',number:1,name:'第1週資料夾',days:[{id:'friday',label:'星期五',homilies:notes}]}];
  return {cycle:'a',sundays:[{id:'original-sunday'}],other:[{id:'original-feast'}],weekdays:{odd:{label:'單數年平日',weeks:weeks(oddNotes)},even:{label:'雙數年平日',weeks:weeks(evenNotes)}}};
}
const note = {title:'道理',content:'第一段\n\n第二段',uploaded_at:'2026-11-13T16:29:01+08:00',translations:{en:{title:'Homily',content:'Paragraph one\n\nParagraph two'}}};
const notes = d => d.weekdays.weeks[0].days[0].homilies;
test('identical undated legacy copies become one sermon without inventing an original year', () => {
  const data = normalizeCycle(legacy([clone(note)],[clone(note)]));
  assert.equal(data.weekdays.weeks.length,1); assert.equal(notes(data).length,1);
  assert.equal(notes(data)[0].title,'道理'); assert.equal(notes(data)[0].translations.en.title,'Homily');
  assert.equal(notes(data)[0].content,note.content); assert.equal(notes(data)[0].translations.en.content,note.translations.en.content);
  assert(!data.weekdays.odd && !data.weekdays.even);
});
test('different versions retain their source parity and full content', () => {
  const data = normalizeCycle(legacy([{...clone(note),content:'單數版本'}],[{...clone(note),content:'雙數版本'}]));
  assert.deepEqual(notes(data).map(h=>[h.title,h.content]),[['單-道理','單數版本'],['雙-道理','雙數版本']]);
});
test('known original years control parity; upload dates never supply the original year', () => {
  const data = normalizeCycle(legacy([{...clone(note),composition_year:2022}],[{...clone(note),composition_year:2023}]));
  assert.deepEqual(notes(data).map(h=>h.title),['雙-道理','單-道理']);
  assert.deepEqual(notes(data).map(h=>h.translations.en.title),['Even-Homily','Odd-Homily']);
});
test('normalization is idempotent and preserves Sunday and feast data', () => {
  const original = legacy([clone(note)],[clone(note)]);
  const data = normalizeCycle(clone(original)); const once = clone(data);
  assert.deepEqual(normalizeCycle(data),once);
  for (const folder of original.sundays) assert.deepEqual(data.sundays.find(f=>f.id===folder.id),folder);
  for (const folder of original.other) assert.deepEqual(data.other.find(f=>f.id===folder.id),folder);
});
test('unknown original years are not guessed from upload year', () => {
  const data = normalizeCycle({...legacy(),advent_weekdays:{label:'將臨期平日',weeks:[{id:'advent-week-4',days:[{id:'thursday',homilies:[clone(note)]}]}]}});
  assert.equal(data.advent_weekdays.weeks[0].days[0].homilies[0].title,'道理');
});
test('incomplete legacy structure is left for the backup validator to reject', () => {
  const bad = {cycle:'a',weekdays:{odd:{weeks:[]}}};
  assert.deepEqual(normalizeCycle(clone(bad)),bad);
});

test('Lent and Holy Week folders are repeatable and preserve legacy Holy Thursday notes', () => {
  const input = legacy(); input.other.push({id:'holy-thursday',name:'聖週四',homilies:[clone(note)]});
  const data = normalizeCycle(input);
  assert.equal(data.sundays.filter(f=>f.id.startsWith('lent-')).length,5);
  assert.equal(data.lent_weekdays.weeks.length,5);
  assert(data.lent_weekdays.weeks.every(w=>w.days.length===6));
  assert(!data.other.some(f=>f.id==='holy-thursday'));
  const thursday = data.holy_week.weeks[0].days.find(d=>d.id==='thursday');
  assert.equal(thursday.homilies.length,1); assert.equal(thursday.homilies[0].content,note.content);
  assert.equal(thursday.homilies[0].translations.en.content,note.translations.en.content);
  assert.deepEqual(normalizeCycle(clone(data)),data);
});
