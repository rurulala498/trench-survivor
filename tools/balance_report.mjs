import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const state = read('src/state.ts');
const config = read('src/config.ts');
const zombies = read('src/data/zombies.ts');
const waves = read('src/sim/waves.ts');

const number = (source, pattern, label) => {
  const match = source.match(pattern);
  if(!match) throw new Error(`Could not read ${label}`);
  return Number(match[1]);
};

const gunBlock = state.match(/gun:\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
const gun = {
  dmg: number(gunBlock, /dmg:\s*([\d.]+)/, 'gun.dmg'),
  rate: number(gunBlock, /rate:\s*([\d.]+)/, 'gun.rate'),
  mag: number(gunBlock, /mag:\s*([\d.]+)/, 'gun.mag'),
  reload: number(gunBlock, /reload:\s*([\d.]+)/, 'gun.reload'),
  crit: number(gunBlock, /crit:\s*([\d.]+)/, 'gun.crit'),
  head: number(gunBlock, /head:\s*([\d.]+)/, 'gun.head'),
};

const enemy = {};
for(const kind of ['walker', 'runner', 'brute', 'boss']){
  const block = zombies.match(new RegExp(`${kind}:\\s*\\{([\\s\\S]*?)(?:\\},|\\},\\n)`))?.[1] ?? '';
  enemy[kind] = {
    hp: number(block, /hp:\s*([\d.]+)/, `${kind}.hp`),
    spd: number(block, /spd:\s*([\d.]+)/, `${kind}.spd`),
    dmg: number(block, /dmg:\s*([\d.]+)/, `${kind}.dmg`),
    hit: number(block, /hit:\s*([\d.]+)/, `${kind}.hit`),
  };
}

const spawn = number(config, /D_SPAWN\s*=\s*([\d.]+)/, 'D_SPAWN');
const melee = number(config, /D_MELEE\s*=\s*([\d.]+)/, 'D_MELEE');
const hpGrowth = number(waves, /hp:\s*1\s*\+\s*\(w-1\)\s*\*\s*([\d.]+)/, 'wave hp growth');
const speedGrowth = number(waves, /spd:\s*1\s*\+\s*\(w-1\)\s*\*\s*([\d.]+)/, 'wave speed growth');
const repair = number(waves, /g\.barMax\s*\*\s*\(([\d.]+)\s*\+\s*g\.repair\)/, 'base repair');

const firingTime = gun.mag / gun.rate;
const cycle = firingTime + gun.reload;
const bodyDps = gun.dmg * gun.mag / cycle;
// Conservative wide-map aim model: 72% hit rate, 28% of hits are headshots.
const mixedDamage = gun.dmg * (0.72 + 0.28 * gun.head) * (1 + gun.crit * 1.2) * 0.72;
const mixedDps = mixedDamage * gun.mag / cycle;

console.log(`Gun: dmg ${gun.dmg}, rate ${gun.rate}/s, mag ${gun.mag}, reload ${gun.reload}s`);
console.log(`Sustained body DPS ${bodyDps.toFixed(1)}, conservative mixed DPS ${mixedDps.toFixed(1)}, firing uptime ${(firingTime/cycle*100).toFixed(1)}%`);
console.log(`Wave growth: HP ${(hpGrowth*100).toFixed(1)}%, speed ${(speedGrowth*100).toFixed(1)}%, between-wave base repair ${(repair*100).toFixed(0)}%`);
console.log('');
console.log('wave | count | hpMul | totalEHP | W arrival | R arrival | Boss arrival | wall DPS');
console.log('---- | ----- | ----- | -------- | --------- | --------- | ------------ | --------');

for(const wave of [1, 2, 5, 10, 15, 20]){
  const total = Math.round(28 + wave*13 + wave*wave*1.1);
  const runnerP = wave < 2 ? 0 : Math.min(0.14 + wave*0.035, 0.46);
  const bruteP = wave < 4 ? 0 : Math.min(0.05 + wave*0.018, 0.20);
  const counts = {
    brute: total * bruteP,
    runner: total * (1 - bruteP) * runnerP,
    walker: total * (1 - bruteP) * (1 - runnerP),
    boss: wave % 5 === 0 ? 1 + Math.floor(Math.floor(wave/5)/2) : 0,
  };
  const hpMul = 1 + (wave - 1) * hpGrowth;
  const speedMul = 1 + (wave - 1) * speedGrowth;
  const distance = (spawn + 0.6) - (melee + 0.21);
  const arrival = kind => distance / (enemy[kind].spd * speedMul);
  const totalEhp = Object.entries(counts)
    .reduce((sum, [kind, count]) => sum + enemy[kind].hp * hpMul * count, 0);
  const wallDps = Object.entries(counts)
    .reduce((sum, [kind, count]) => sum + enemy[kind].dmg / enemy[kind].hit * count, 0);
  console.log(`${String(wave).padStart(4)} | ${String(Math.round(total + counts.boss)).padStart(5)} | ${hpMul.toFixed(2).padStart(5)} | ${String(Math.round(totalEhp)).padStart(8)} | ${arrival('walker').toFixed(1).padStart(9)} | ${arrival('runner').toFixed(1).padStart(9)} | ${arrival('boss').toFixed(1).padStart(12)} | ${String(Math.round(wallDps)).padStart(8)}`);
}

console.log('');
for(const wave of [1, 5, 10]){
  const hpMul = 1 + (wave - 1) * hpGrowth;
  const bodyShots = Math.ceil(enemy.walker.hp * hpMul / gun.dmg);
  const headShots = Math.ceil(enemy.walker.hp * hpMul / (gun.dmg * gun.head));
  console.log(`Wave ${wave} Walker: ${bodyShots} body shot(s), ${headShots} headshot(s)`);
}
