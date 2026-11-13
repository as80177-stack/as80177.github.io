const {test}=require('node:test');const assert=require('node:assert/strict');const m=require('../search-matching.js');const {parse}=require('../voice-search-commands.js');
test('natural phrasing and common voice recognition errors',()=>{assert.equal(parse('我想找一篇關於饒恕別人的道理').query,'饒恕別人');assert.equal(parse('找假年第七個主日').folderId,'ordinary-7');assert.equal(parse('祈島').query,'祈禱');assert.equal(parse('找甲年第七個星期天').folderId,'ordinary-7');assert.equal(parse('已年第七主日').cycle,'b');assert.equal(parse('保羅歸化').section,'apostles')});
test('related topics and near spellings do not require literal matching',()=>{assert(m.score('饒恕別人','寬恕與愛仇人','')>0);assert(m.score('背負苦架','背起十字架','')>0);assert(m.score('夫妻相處','婚姻：忠信與盟約','')>0);assert(m.score('十字驾','背起十字架','')>0);assert(m.score('饶恕','寬恕他人','')>0)});
test('multiple requested themes need matching concepts',()=>{assert(m.score('祈禱和原諒','學習祈禱與寬恕','')>0);assert.equal(m.score('祈禱和原諒','祈禱','學習祈禱。'),0)});
test('title-related results rank before incidental body mentions',()=>{const docs=[{cycle:'c',section:'sundays',note:{title:'其他道理',content:'我們也要原諒他人'}},{cycle:'a',section:'sundays',note:{title:'寬恕與愛仇人',content:'這篇談寬恕'}}];const hits=m.rank(docs,{query:'饒恕別人'});assert.equal(hits[0].cycle,'a');assert.equal(m.rank(docs,{query:'原諒'})[0].cycle,'a');assert.equal(m.rank(docs,{query:'饒恕別人',cycle:'c'}).length,0)});
test('unrelated requests are not forced into arbitrary results',()=>{assert.equal(m.score('火星外星人','婚姻與愛德','彼此相愛，努力祈禱。'),0)});
test('catalog excludes empty placeholders and preserves day/location metadata',()=>{const data={label:'甲年',weekdays:{weeks:[{id:'week-2',name:'第2週',days:[{id:'wednesday',label:'星期三',homilies:[{title:'待補',content:'待補'},{title:'道理',content:'全文'}]}]}]}};const docs=m.catalog(data,'a');assert.equal(docs.length,1);assert.equal(docs[0].day,'wednesday');assert(docs[0].location.includes('星期三'))});

test('all topics reject incidental mentions and closing prayers',()=>{
  for(const topic of ['祈禱','寬恕','十字架','復活','婚姻','聖體','工作']) {
    const docs=[{note:{title:'另一個主題',content:`今天我們討論別的事。\n\n順帶提到${topic}。\n\n繼續討論原本的主題。\n\n願聖母幫助我們${topic}。`}}];
    assert.equal(m.rank(docs,{query:topic}).length,0,topic);
    assert.equal(m.rank([{note:{title:'道理',content:`開頭討論別的事。\n\n願聖母幫助我們${topic}。`}}],{query:topic}).length,0,topic);
  }
});
test('sustained discussion is searchable even with a generic title',()=>{
  assert.equal(m.rank([{note:{title:'今日道理',content:'祈禱是我們每天的需要。\n\n祈禱使我們親近天主。\n\n我們應當持之以恆。'}}],{query:'禱告'}).length,1);
});
test('actual corpus keeps main cross homily and excludes incidental cross mentions',()=>{
  const docs=['a','b','c','apostles','marian','theology'].flatMap(key=>m.catalog(require('../data/'+(['a','b','c'].includes(key)?'year-':'')+key+'.json'),key));
  const hits=m.rank(docs,{query:'十字架'});
  assert.equal(hits.length,1);assert(hits[0].note.title.includes('背起十字架'));
  assert(m.rank(docs,{query:'婚姻'}).every(d=>!d.note.title.includes('第32主日')));
  assert(m.rank(docs,{query:'聖體'}).some(d=>d.note.title==='入門聖事'));
  assert(m.rank(docs,{query:'寬恕'})[0].note.title.includes('寬恕'));
});
test('English partial words and translation duplicates are not topic evidence',()=>{
  assert.equal(m.topicScore('聖體',{title:'Christmas',content:'Christmas is here.\n\nChristmas brings joy.'}),0);
  assert.equal(m.topicScore('十字架',{title:'Homily',content:'Words of Christ bring us comfort.\n\nChrist creates all things.'}),0);
  assert.equal(m.topicScore('十字架',{title:'道理',content:'順帶提到十字架。',translations:{en:{title:'Homily',content:'We mention the cross.'}}}),0);
});
