((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HomilySearchMatching = api;
})(globalThis, () => {
  const groups = [
    ['祈禱','祈求','禱告','代禱','祈祷','祷告','代祷','prayer','pray'],
    ['寬恕','饒恕','原諒','赦免','宽恕','饶恕','原谅','forgive','forgiveness'],
    ['十字架','苦架','背負苦架','cross'],
    ['苦難','受苦','苦痛','suffering'],
    ['希望','盼望','望德','盼望','hope'],
    ['婚姻','夫妻','夫婦','結婚','婚約','结婚','marriage'],
    ['聖洗','洗禮','受洗','洗礼','入門聖事','baptism'],
    ['聖體','彌撒','感恩祭','感恩禮','領聖體','圣体','弥撒','eucharist','mass'],
    ['復活','永生','死後生命','复活','resurrection'],
    ['慈悲','憐憫','仁慈','憐愛','怜悯','mercy','compassion'],
    ['愛德','愛人','愛近人','彼此相愛','愛仇人','爱德','charity'],
    ['信德','信心','相信天主','信仰','faith'],
    ['悔改','懺悔','告解','認罪','忏悔','repentance'],
    ['傳教','福傳','宣講福音','傳福音','传教','evangelization'],
    ['亡者','過世','去世','逝者','追思','煉獄','purgatory'],
    ['聖母','瑪利亞','馬利亞','圣母','mary'],
    ['自由意志','自由選擇','自由选择','freewill']
  ];
  const characters = {圣:'聖',诞:'誕',节:'節',祷:'禱',宽:'寬',饶:'饒',谅:'諒',灵:'靈',弥:'彌',传:'傳',讲:'講',门:'門',爱:'愛',体:'體',复:'復',后:'後',仰:'仰',约:'約',恶:'惡',难:'難',怜:'憐',悯:'憫',归:'歸',禄:'祿',于:'於',与:'與',帮:'幫',关:'關',个:'個',听:'聽',说:'說',过:'過',丧:'喪',礼:'禮',经:'經',虑:'慮',盼:'盼',臺:'台',週:'周',裏:'裡'};
  const aliases = [['祈島','祈禱'],['祈倒','祈禱'],['祈導','祈禱'],['原量','原諒'],['原亮','原諒'],['十字價','十字架'],['十字假','十字架'],['婚因','婚姻'],['保羅','保祿'],['保罗','保祿'],['西門','西滿'],['彼得','伯多祿'],['長年期','常年期'],['降臨期','將臨期']];
  function prepare(text) {
    text = String(text).normalize('NFKC').replace(/./gu, char => characters[char] || char);
    for (const [from,to] of aliases) text = text.split(from).join(to);
    return text.replace(/[假加家]年/g,'甲年').replace(/[餅饼柄炳]年/g,'丙年').replace(/[以已]年/g,'乙年').replace(/第([0-9一二三四五六七八九十廿卅]+)(?:個)?(?:星期天|星期日|禮拜天|禮拜日)/g,'第$1主日').replace(/([0-9一二三四五六七八九十廿卅]+)個主日/g,'$1主日');
  }
  function normalize(text) { return prepare(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu,''); }
  function cleanQuery(text) {
    return prepare(text).replace(/我想要|我想|我需要|我要|我想聽|我想看|可以幫我|可不可以|能不能|麻煩你|麻煩|請你|幫我|幫忙|替我|給我看|給我|請|尋找|找一下|找一找|找找|搜尋|搜索|找出|查找|打開|找/g,'')
      .replace(/有沒有|有哪些|有關於|關於|有關|講到|講的是|談到|主題是|主題|那一篇|這一篇|一篇|一則|一個|一些|那篇|這篇|那個|內容|一下|的道理|道理|講道|講章|筆記|資料夾|平日|主日/g,'').replace(/[，。！？、,.!?：:\s]/g,'').replace(/^的|的$/g,'');
  }
  const normalizedGroups = groups.map(g => [...new Set(g.map(normalize))]);
  function bigrams(value) { const chars=Array.from(value); return new Set(chars.slice(1).map((_,i)=>chars[i]+chars[i+1])); }
  function overlap(query, text) { const q=bigrams(query), t=bigrams(text); const hits=[...q].filter(v=>t.has(v)).length; return {hits,ratio:q.size?hits/q.size:0}; }
  function distance(a,b) {
    let row=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next;}
    return row[b.length];
  }
  function nearTitle(query,title) {
    if(query.length<3 || query.length>18)return false;
    const limit=query.length<=5?1:2;
    for(let length=Math.max(2,query.length-1);length<=query.length+1;length++)for(let i=0;i<=title.length-length;i++)if(distance(query,title.slice(i,i+length))<=limit)return true;
    return false;
  }
  function score(query, title, content = '') {
    const q=normalize(cleanQuery(query));if(!q)return 0;
    const t=normalize(title),b=normalize(content);
    if(t.includes(q))return 120;const exactBody=b.includes(q)?85:0;
    const concepts=normalizedGroups.filter(g=>g.some(term=>q.includes(term)));
    if(concepts.length){
      const matched=concepts.filter(g=>g.some(term=>t.includes(term)||b.includes(term)));
      if(matched.length===concepts.length){
        const titleMatches=concepts.filter(g=>g.some(term=>t.includes(term))).length;
        return Math.max(exactBody,Math.min(115,65+titleMatches*30+concepts.length*3));
      }
    }
    if(nearTitle(q,t))return Math.max(exactBody,55);
    if(q.length>=4){const a=overlap(q,t),c=overlap(q,b);if(a.hits>=2&&a.ratio>=.55)return Math.max(exactBody,40+a.ratio*10);if(c.hits>=2&&c.ratio>=.7)return Math.max(exactBody,30+c.ratio*10);}
    return exactBody;
  }
  // A mention is not necessarily the subject. Apply this evidence check to
  // every query, including topics outside the synonym dictionary.
  function topicEvidence(query, title, content) {
    const q = normalize(cleanQuery(query));
    const concept = normalizedGroups.find(g => g.includes(q));
    const terms = concept || [q];
    function mentions(text) {
      return terms.some(term => /^[a-z]+$/.test(term)
        ? new RegExp('\\b' + term + '(?:s|ed|ing)?\\b', 'i').test(prepare(text))
        : normalize(text).includes(term));
    }
    const titleScore = score(query, title);
    if (mentions(title)) return 150;
    if (!concept && titleScore >= 40) return titleScore + 30;
    let paragraphs = String(content || '').split(/\n\s*\n|\n/)
      .map(p => p.trim()).filter(Boolean)
      .filter(p => !/^(?:願|愿|May\s+(?:Our\s+Lady|God|the\s+Lord)\b)/i.test(p));
    // Older backups sometimes store a whole homily on one line.
    if (paragraphs.length < 3) paragraphs = paragraphs.flatMap(p =>
      p.split(/(?<=[。！？.!?])\s*/u).filter(s => normalize(s).length >= 8));
    if (!paragraphs.length) return 0;
    const matches = paragraphs.map(mentions);
    const count = matches.filter(Boolean).length;
    const coverage = count / paragraphs.length;
    const opening = matches.slice(0, 2).filter(Boolean).length;
    // Require repeated discussion and meaningful coverage, not a closing
    // invocation, isolated quotation or single example in a different topic.
    if (count < 2 || coverage < .3 || (!opening && coverage < .5)) return 0;
    return 60 + coverage * 30 + opening * 5 + titleScore / 10;
  }
  function topicScore(query, note) {
    const q = normalize(cleanQuery(query));
    if (!q) return 0;
    const concepts = normalizedGroups.filter(g => g.some(term => q.includes(term)));
    const versions = [note, ...Object.values(note.translations || {})];
    // Evaluate languages separately so a translation does not count as a
    // second independent discussion of an incidental mention.
    return Math.max(0, ...versions.map(version => {
      if (concepts.length) {
        const evidence = concepts.map(g => Math.max(...g.map(term =>
          topicEvidence(term, (version.title || '') + ' ' + (note.search_topics || []).join(' '), version.content || ''))));
        return evidence.every(Boolean) ? evidence.reduce((a,b) => a+b,0)/evidence.length : 0;
      }
      return topicEvidence(query, (version.title || '') + ' ' + (note.search_topics || []).join(' '), version.content || '');
    }));
  }
  function catalog(data,key) {
    const result=[];
    function add(folders,section,sectionLabel,cycle) {
      for(const folder of folders || []){
        const days=folder.days || [null];
        for(const day of days)for(const note of (day||folder).homilies || []){
          if(!note.content?.trim() || note.content.trim()==='待補')continue;
          result.push({cycle,section,location:[cycle?data.label:null,sectionLabel,folder.display_name||folder.name,day?.label].filter(Boolean).join(' → '),folderId:folder.id,day:day?.id,note});
        }
      }
    }
    if(['a','b','c'].includes(key)){
      add(data.sundays,'sundays','主日',key);add(data.weekdays?.weeks,'weekdays','常年期平日',key);add(data.other,'other','其他節日',key);
      for(const [field,section,label] of [['advent_weekdays','advent-weekdays','將臨期平日'],['lent_weekdays','lent-weekdays','四旬期平日'],['holy_week','holy-week','聖週']])add(data[field]?.weeks,section,label,key);
    }else add(data.folders,key,data.label,null);
    return result;
  }
  function keywordScore(query, note) {
    const q = normalize(query);
    if (!q) return 0;
    return Math.max(0, ...[note, ...Object.values(note.translations || {})].map(version =>
      normalize(version.title || '').includes(q) ? 120 : normalize(version.content || '').includes(q) ? 85 : 0));
  }
  function rank(documents, command, alternatives=[]) {
    const allKeywords = command.matchMode === 'keywords';
    // Literal mode uses the accepted transcript only; alternatives must not
    // silently broaden a request to unrelated words or synonyms.
    const queries = allKeywords ? [command.query] : [command.query,...alternatives.map(cleanQuery)].filter(Boolean);
    const results = documents.filter(d=>(!command.cycle || d.cycle===command.cycle || (!d.cycle&&command.section===d.section)) && (!command.section || d.section===command.section))
      .map(d=>({...d,score:Math.max(0,...queries.map(query=>allKeywords ? keywordScore(query,d.note) : topicScore(query,d.note)))}))
      .filter(d=>d.score>0).sort((a,b)=>b.score-a.score);
    return allKeywords ? results : results.slice(0,15);
  }
  return {prepare,normalize,cleanQuery,score,topicScore,keywordScore,catalog,rank};
});
