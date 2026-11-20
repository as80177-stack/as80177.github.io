((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HomilyDataModel = api;
})(globalThis, () => {
  const strip = title => String(title).replace(/^(?:單／雙|單\/雙|單|雙)-\s*/, '');
  const stripEnglish = title => String(title).replace(/^(?:Odd\/Even|Odd|Even)-\s*/i, '');
  // The owner confirmed these existing weekday drafts were written in 2023.
  // Match their content, not upload timestamps; an explicit original year wins.
  const confirmedDraftYears = {"519:cf03cd17":2023,"480:0f1e384f":2023,"552:a1712a93":2023,"639:5dec6cab":2023};
  function originalYear(note) {
    if (Number.isInteger(note.composition_year) && note.composition_year > 0) return note.composition_year;
    let hash = 2166136261;
    for (let i = 0; i < note.content.length; i++) hash = Math.imul(hash ^ note.content.charCodeAt(i),16777619) >>> 0;
    return confirmedDraftYears[`${note.content.length}:${hash.toString(16).padStart(8,'0')}`];
  }
  function parityOf(note, fallback = 'both') {
    const year = originalYear(note);
    if (year) return year % 2 ? 'odd' : 'even';
    if (['odd','even','both'].includes(note.liturgical_parity)) return note.liturgical_parity;
    if (/^單-/.test(note.title)) return 'odd';
    if (/^雙-/.test(note.title)) return 'even';
    if (/^(單／雙|單\/雙)-/.test(note.title)) return 'both';
    return fallback;
  }
  function label(note, parity) {
    const year = originalYear(note);
    if (year) { note.composition_year = year; parity = year % 2 ? 'odd' : 'even'; }
    // Unknown dates stay unclassified rather than displaying a combined prefix.
    const prefix = {odd:'單-',even:'雙-'}[parity] || '';
    if (prefix) note.liturgical_parity = parity;
    else delete note.liturgical_parity;
    note.title = prefix + strip(note.title);
    if (note.translations?.en && typeof note.translations.en.title === 'string') {
      note.translations.en.title = ({odd:'Odd-',even:'Even-'}[parity] || '') + stripEnglish(note.translations.en.title);
    }
    return note;
  }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  function signature(note) {
    const copy = JSON.parse(JSON.stringify(note));
    delete copy.liturgical_parity;
    copy.title = strip(copy.title);
    if (copy.translations?.en) copy.translations.en.title = stripEnglish(copy.translations.en.title);
    return stable(copy);
  }
  function validWeeks(weeks) {
    return Array.isArray(weeks) && weeks.every(w => w && typeof w.id === 'string' && Array.isArray(w.days) && w.days.every(d => d && typeof d.id === 'string' && Array.isArray(d.homilies) && d.homilies.every(h => h && typeof h.title === 'string' && typeof h.content === 'string')));
  }
  function seasonalWeeks(prefix, label, count) {
    const names = ['星期一','星期二','星期三','星期四','星期五','星期六'];
    const ids = ['monday','tuesday','wednesday','thursday','friday','saturday'];
    return {label, weeks:Array.from({length:count}, (_, i) => ({
      id:`${prefix}-week-${i+1}`,number:i+1,name:count === 1 ? `${label}資料夾` : `${label}第${i+1}週資料夾`,
      days:ids.map((id,index) => ({id,label:prefix === 'holy' ? ['聖週一','聖週二','聖週三','聖週四','聖週五','聖週六'][index] : names[index],homilies:[]}))
    }))};
  }
  function ensureAdventSundays(data) {
    if (!Array.isArray(data.sundays) || !Array.isArray(data.other)) return;
    const adventIds = ['advent-1', 'advent-2', 'advent-3', 'advent-4'];
    const ordinals = ['一', '二', '三', '四'];
    // Older backups may lack some or all Advent Sunday folders.
    const adventFolders = adventIds.map((id, index) => {
      const name = `將臨期第${ordinals[index]}主日`;
      return data.sundays.find(folder => folder?.id === id) ||
        {id, name, display_name: `${name}資料夾`, homilies: []};
    });
    const otherSundays = data.sundays.filter(folder => !adventFolders.includes(folder));
    data.sundays = [...adventFolders, ...otherSundays];
  }
  function ensureLentAndHolyWeek(data, includeLegacyLentWeekdays) {
    if (!Array.isArray(data.sundays) || !Array.isArray(data.other)) return;
    const ordinals = ['一','二','三','四','五'];
    for (let i=1;i<=5;i++) if (!data.sundays.some(f => f.id === `lent-${i}`)) {
      const folder = {id:`lent-${i}`,name:`四旬期第${ordinals[i-1]}主日`,display_name:`四旬期第${ordinals[i-1]}主日資料夾`,homilies:[]};
      const position = data.sundays.findIndex(f => typeof f.id === 'string' && f.id.startsWith('ordinary-'));
      data.sundays.splice(position < 0 ? data.sundays.length : position,0,folder);
    }
    if (includeLegacyLentWeekdays && data.lent_weekdays === undefined) data.lent_weekdays = seasonalWeeks('lent','四旬期',5);
    if (data.holy_week === undefined) data.holy_week = seasonalWeeks('holy','聖週',1);
    const thursday = data.holy_week?.weeks?.[0]?.days?.find(day => day.id === 'thursday');
    if (!thursday || !Array.isArray(thursday.homilies)) return;
    // Move old standalone Holy Thursday notes before removing the duplicate folder.
    data.other = data.other.filter(folder => {
      if (folder.id !== 'holy-thursday' || !Array.isArray(folder.homilies) || !folder.homilies.every(h => h && typeof h.title === 'string' && typeof h.content === 'string')) return true;
      for (const note of folder.homilies) {
        if (!thursday.homilies.some(h => signature(h) === signature(note))) thursday.homilies.push(JSON.parse(JSON.stringify(note)));
      }
      return false;
    });
  }
  function normalizeCycle(data, {includeLegacyLentWeekdays = true} = {}) {
    if (!data || !['a','b','c'].includes(data.cycle)) return data;
    ensureAdventSundays(data);
    ensureLentAndHolyWeek(data, includeLegacyLentWeekdays);
    const vigil = Array.isArray(data.other) && data.other.find(folder => folder?.id === 'easter-vigil');
    if (vigil?.name === '復活前夕' && vigil.display_name === '復活前夕資料夾') {
      const year = {a:'甲年', b:'乙年', c:'丙年'}[data.cycle];
      vigil.name = `${year}復活節前夕`;
      vigil.display_name = `${vigil.name}資料夾`;
    }
    const weekdays = data.weekdays;
    if (weekdays && !Array.isArray(weekdays.weeks) && validWeeks(weekdays.odd?.weeks) && validWeeks(weekdays.even?.weeks)) {
      const merged = {label:'平日',weeks:[]};
      for (const parity of ['odd','even']) for (const oldWeek of weekdays[parity].weeks) {
        let week = merged.weeks.find(w => w.id === oldWeek.id);
        if (!week) { week = {...oldWeek,days:[]}; merged.weeks.push(week); }
        for (const oldDay of oldWeek.days) {
          let day = week.days.find(d => d.id === oldDay.id);
          if (!day) { day = {...oldDay,homilies:[]}; week.days.push(day); }
          for (const oldNote of oldDay.homilies) {
            const note = label(JSON.parse(JSON.stringify(oldNote)), parityOf(oldNote,parity));
            const same = day.homilies.find(h => signature(h) === signature(note));
            if (same) {
              if (same.liturgical_parity !== note.liturgical_parity) label(same,'both');
            } else day.homilies.push(note);
          }
        }
      }
      data.weekdays = merged;
    }
    if (validWeeks(data.weekdays?.weeks)) {
      for (const week of data.weekdays.weeks) for (const day of week.days) for (const note of day.homilies) label(note,parityOf(note));
    }
    for (const key of ['advent_weekdays','lent_weekdays','holy_week']) if (validWeeks(data[key]?.weeks)) {
      for (const week of data[key].weeks) for (const day of week.days) for (const note of day.homilies) label(note,parityOf(note));
    }
    return data;
  }
  function mergeWeekdays(sources, label) {
    const weeks = [];
    for (const source of sources) for (const incomingWeek of source.weeks) {
      let week = weeks.find(item => item.id === incomingWeek.id);
      if (!week) {
        week = {...incomingWeek, days: []};
        weeks.push(week);
      }
      for (const incomingDay of incomingWeek.days) {
        let day = week.days.find(item => item.id === incomingDay.id);
        if (!day) {
          day = {...incomingDay, homilies: []};
          week.days.push(day);
        }
        for (const note of incomingDay.homilies) {
          if (!day.homilies.some(existing => stable(existing) === stable(note))) day.homilies.push(note);
        }
      }
    }
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const week of weeks) week.days.sort((a, b) => dayOrder.indexOf(a.id) - dayOrder.indexOf(b.id));
    const weekNumber = week => Number(week.number ?? week.id.split('-').at(-1));
    weeks.sort((a, b) => weekNumber(a) - weekNumber(b));
    return {label, weeks};
  }
  function normalizeEaster(data) {
    const folders = new Map();
    for (const folder of data.folders) {
      const legacy = /^(easter-sunday-\d+)-([abc])$/.exec(folder.id);
      const current = legacy ? {
        ...folder,
        id: legacy[1],
        name: folder.name.replace(/（[甲乙丙]年）$/, ''),
        display_name: folder.display_name.replace(/（[甲乙丙]年）$/, ''),
        homilies: folder.homilies.map(note => ({...note, liturgical_cycle: note.liturgical_cycle ?? legacy[2]}))
      } : folder;
      const existing = folders.get(current.id);
      if (existing && /^easter-sunday-\d+$/.test(current.id)) {
        folders.set(current.id, {...existing, homilies: [...existing.homilies, ...current.homilies]});
      } else {
        folders.set(current.id, current);
      }
    }
    return {...data, folders: [...folders.values()]};
  }
  return {normalizeCycle, mergeWeekdays, normalizeEaster};
});
