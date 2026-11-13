const {test}=require('node:test');const assert=require('node:assert/strict');const {parse,number}=require('../voice-search-commands.js');
test('Chinese and Arabic ordinal numbers',()=>{for(const [s,n] of [['二',2],['十二',12],['二十二',22],['三十四',34],['廿三',23],['卅一',31],['22',22]])assert.equal(number(s),n)});
test('year and Sunday command',()=>{const c=parse('請幫我找甲年第七主日道理');assert.equal(c.cycle,'a');assert.equal(c.section,'sundays');assert.equal(c.folderId,'ordinary-7');assert.equal(c.query,'')});
test('specific week and day',()=>{const c=parse('找乙年常年期第二十二週星期五');assert.equal(c.cycle,'b');assert.equal(c.folderId,'week-22');assert.equal(c.day,'friday');assert.equal(c.query,'')});
test('Advent and Lent dates',()=>{assert.equal(parse('找甲年四旬期第一主日').folderId,'lent-1');const c=parse('找甲年將臨期第四週星期六早上');assert.equal(c.section,'advent-weekdays');assert.equal(c.folderId,'advent-week-4');assert.equal(c.day,'saturday');assert.equal(c.query,'早上')});
test('Holy Thursday must not be confused with an ordinary Thursday',()=>{const c=parse('找聖週四');assert.equal(c.section,'holy-week');assert.equal(c.folderId,'holy-week-1');assert.equal(c.day,'thursday');assert.equal(c.query,'')});
test('festival and independent folder commands',()=>{assert.equal(parse('找甲年聖誕節').folderId,'christmas');assert.equal(parse('找婚姻').section,'theology');assert.equal(parse('找聖母其他節日').section,'marian');assert.equal(parse('找聖保祿歸化').section,'apostles')});
test('plain keywords keep the current scope',()=>{const c=parse('幫我找祈禱');assert.equal(c.query,'祈禱');assert.equal(c.section,null);assert.equal(c.cycle,null)});
test('invalid week numbers explain the error',()=>{assert.throws(()=>parse('四旬期第九週星期五'),/沒有第9週/)});
