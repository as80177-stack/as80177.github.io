((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HomilyDataModel = api;
})(globalThis, () => {
  const strip = title => String(title).replace(/^(?:單／雙|單\/雙|單|雙)-\s*/, '');
  const stripEnglish = title => String(title).replace(/^(?:Odd\/Even|Odd|Even)-\s*/i, '');
  function parityOf(note, fallback = 'both') {
    if (Number.isInteger(note.composition_year) && note.composition_year > 0) return note.composition_year % 2 ? 'odd' : 'even';
    if (['odd','even','both'].includes(note.liturgical_parity)) return note.liturgical_parity;
    if (/^單-/.test(note.title)) return 'odd';
    if (/^雙-/.test(note.title)) return 'even';
    if (/^(單／雙|單\/雙)-/.test(note.title)) return 'both';
    return fallback;
  }
  function label(note, parity) {
    note.liturgical_parity = parity;
    note.title = ({odd:'單-',even:'雙-',both:'單／雙-'})[parity] + strip(note.title);
    if (note.translations?.en && typeof note.translations.en.title === 'string') {
      note.translations.en.title = ({odd:'Odd-',even:'Even-',both:'Odd/Even-'})[parity] + stripEnglish(note.translations.en.title);
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
  function normalizeCycle(data) {
    if (!data || !['a','b','c'].includes(data.cycle)) return data;
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
    if (validWeeks(data.advent_weekdays?.weeks)) {
      for (const week of data.advent_weekdays.weeks) for (const day of week.days) for (const note of day.homilies) label(note,parityOf(note));
    }
    return data;
  }
  return {normalizeCycle};
});
