((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HomilyVoiceCommands = api;
})(globalThis, () => {
  const digits = {零:0,〇:0,一:1,二:2,兩:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  const numbers = '[0-9零〇一二兩两三四五六七八九十廿卅]+';
  const dayIds = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const ordinals = ['一','二','三','四','五'];
  function number(text) {
    if (/^\d+$/.test(text)) return Number(text);
    text = text.replace('廿','二十').replace('卅','三十').replace(/两/g,'二').replace(/兩/g,'二');
    if (text.includes('十')) {
      const [tens, units] = text.split('十');
      return (tens ? digits[tens] : 1) * 10 + (units ? digits[units] : 0);
    }
    return digits[text];
  }
  function parse(transcript) {
    let text = transcript.trim().replace(/[，。！？、,.!?：:]/g,'').replace(/\s+/g,'').replace(/将临/g,'將臨').replace(/圣/g,'聖').replace(/弥/g,'彌').replace(/灵/g,'靈');
    const command = {cycle:null,section:null,folderId:null,day:null,query:'',location:[]};
    const year = text.match(/([甲乙丙ABC])年/i);
    if (year) { command.cycle = ({甲:'a',乙:'b',丙:'c',a:'a',b:'b',c:'c'})[year[1].toLowerCase()]; command.location.push(({a:'甲年',b:'乙年',c:'丙年'})[command.cycle]); text = text.replace(year[0],''); }
    text = text.replace(/^(?:請你|請|麻煩|幫我|帮我|給我|我要|我想|想要|找一下|找找|尋找|搜索|搜尋|查找|找|打開|打开)+/,'');
    const holy = text.match(/聖[週周]([一二三四五六日天1-7])?/);
    const dayMatch = text.match(/(?:星期|禮拜|礼拜|週|周)([一二三四五六日天1-7])/);
    if (dayMatch) { const n = /[日天]/.test(dayMatch[1]) ? 7 : number(dayMatch[1]); command.day = dayIds[n-1]; if (!holy || dayMatch[0] !== holy[0].slice(1)) text = text.replace(dayMatch[0],''); }
    const sunday = text.match(new RegExp(`第?(${numbers})(?:週|周)?主日`));
    const week = text.match(new RegExp(`第?(${numbers})(?:週|周)`));
    const festivals = [
      [/聖誕(?:節)?/,'christmas','聖誕節'], [/追思(?:已亡)?(?:節)?|諸靈(?:節)?/,'all-souls','追思已亡節'],
      [/諸聖(?:節)?/,'all-saints','諸聖節'], [/傳教(?:節|主日)?/,'world-mission-sunday','傳教節'],
      [/(?:基督普世|耶穌|基督)?君王(?:節)?/,'christ-the-king','基督普世君王節'], [/聖枝主日/,'palm-sunday','聖枝主日'],
      [/復活主日|復活節/,'easter-sunday','復活主日'], [/聖母蒙召升天(?:節)?/,'assumption','聖母蒙召升天節']
    ];
    const festival = festivals.find(([regex]) => regex.test(text));
    if (holy) {
      command.section = 'holy-week'; command.folderId = 'holy-week-1';
      if (holy[1]) { const n = /[日天]/.test(holy[1]) ? 7 : number(holy[1]); command.day = dayIds[n-1]; }
      command.location.push('聖週'); text = text.replace(holy[0],'');
    } else if (festival) {
      command.section = 'other'; command.folderId = festival[1]; command.location.push(festival[2]); text = text.replace(festival[0],'');
    } else if (sunday || week || command.day) {
      const season = /將臨期/.test(text) ? 'advent' : /四旬期/.test(text) ? 'lent' : 'ordinary';
      const n = number((week || sunday || [null,''])[1]);
      if (command.day || (week && !sunday)) {
        command.section = ({advent:'advent-weekdays',lent:'lent-weekdays',ordinary:'weekdays'})[season];
        if (Number.isInteger(n)) {
          const max = season === 'advent' ? 4 : season === 'lent' ? 5 : 34;
          if (n<1 || n>max) throw new Error(`這個季節沒有第${n}週，請重新說明週次。`);
          command.folderId = season === 'ordinary' ? `week-${n}` : `${season}-week-${n}`;
          command.location.push(`${({advent:'將臨期',lent:'四旬期',ordinary:'常年期'})[season]}第${n}週`);
        }
      } else {
        const max = season === 'advent' ? 4 : season === 'lent' ? 5 : 34;
        if (!Number.isInteger(n) || n<1 || n>max) throw new Error('請說出有效的主日編號。');
        command.section = 'sundays'; command.folderId = `${season}-${n}`;
        command.location.push(season === 'ordinary' ? `第${n}主日` : `${season==='advent'?'將臨期':'四旬期'}第${ordinals[n-1]}主日`);
      }
      text = text.replace(/將臨期|四旬期|常年期/g,'');
      if (sunday) text = text.replace(sunday[0],'');
      if (week) text = text.replace(week[0],'');
    } else if (/12宗徒|十二宗徒|宗徒|保祿歸化|保禄归化|聖路加|聖達陡|聖西滿/.test(text)) {
      command.section = 'apostles'; command.location.push('12宗徒'); text = text.replace(/12宗徒|十二宗徒|宗徒/g,'');
    } else if (/聖母/.test(text)) {
      command.section = 'marian'; command.location.push('聖母其他節日'); text = text.replace(/聖母其他節日(?:資料夾)?/,'');
    } else if (/婚姻|入門聖事|神學|生活道理/.test(text)) {
      command.section = 'theology'; command.location.push('其他神學與生活道理'); text = text.replace(/其他神學與生活道理(?:資料夾)?/,'');
    }
    if (command.day) command.location.push('星期'+['一','二','三','四','五','六','日'][dayIds.indexOf(command.day)]);
    command.query = text.replace(/(?:的)?(?:道理|講道|資料夾|笔记|筆記|平日|主日)/g,'').replace(/^(?:請你|請|麻煩|幫我|帮我|給我|我要|我想|想要|找一下|找找|尋找|搜索|搜尋|查找|找|打開|打开)+/,'').trim();
    return command;
  }
  return {parse,number};
});
