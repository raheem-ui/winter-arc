// Achievements engine — pure functions, no DOM, no storage.
// Computed from the same `days` rows that buildDays() produces, so it works
// offline, in demo mode, and with Supabase without any schema change.

export const ACHIEVEMENTS = [
  { id: 'first-log', icon: '🌱', name: 'First Entry', desc: 'Log your first day', total: 1 },
  { id: 'logger-7', icon: '📅', name: 'Week Logger', desc: 'Log 7 days', total: 7 },
  { id: 'logger-30', icon: '🗓️', name: 'Month Logger', desc: 'Log 30 days', total: 30 },
  { id: 'perfect-day', icon: '💯', name: 'Perfect Day', desc: 'Score 100% on any day', total: 1 },
  { id: 'streak-3', icon: '🔥', name: 'Kindling', desc: '3-day good-day streak', total: 3 },
  { id: 'streak-7', icon: '🔥', name: 'Week on Fire', desc: '7-day good-day streak', total: 7 },
  { id: 'streak-14', icon: '❄️', name: 'Unbreakable', desc: '14-day good-day streak', total: 14 },
  { id: 'streak-30', icon: '👑', name: 'Arc Master', desc: '30-day good-day streak', total: 30 },
  { id: 'gym-15', icon: '🏋️', name: 'Gym Rat', desc: 'Hit gym 15 times', total: 15 },
  { id: 'diet-15', icon: '🥗', name: 'Clean Eater', desc: 'Stay on diet 15 days', total: 15 },
  { id: 'sleep-15', icon: '🌅', name: 'Early Bird', desc: '15 nights on sleep target', total: 15 },
  { id: 'skill-20h', icon: '📚', name: 'Scholar', desc: '20 hours of skill study', total: 20 },
  { id: 'tasks-5', icon: '✅', name: 'Task Closer', desc: 'Submit 5 assignments', total: 5 },
  { id: 'weight-5', icon: '⚖️', name: 'Moving Down', desc: 'Drop 5 kg from start weight', total: 5 },
];

const count = (days, key, val = 'Y') => days.filter((d) => d[key] === val).length;

function stats(days, assignments, settings) {
  const logged = days.filter((d) => d.logged).length;
  const bestStreak = Math.max(0, ...days.map((d) => d.streak || 0));
  const perfectDay = days.some((d) => d.score === 1) ? 1 : 0;
  const gym = count(days, 'gym');
  const diet = count(days, 'diet');
  const sleep = count(days, 'sleepOk');
  const skillHours = days.reduce((a, d) => a + (Number(d.skillMin) || 0), 0) / 60;
  const submitted = (assignments || []).filter((a) => a.status === 'Submitted').length;
  const weighed = days.filter((d) => d.weight);
  const latest = weighed.length ? Number(weighed[weighed.length - 1].weight) : null;
  const lost = latest == null ? 0 : Math.max(0, (settings?.startWeight ?? 0) - latest);
  return {
    'first-log': logged >= 1 ? 1 : logged,
    'logger-7': Math.min(logged, 7),
    'logger-30': Math.min(logged, 30),
    'perfect-day': perfectDay,
    'streak-3': Math.min(bestStreak, 3),
    'streak-7': Math.min(bestStreak, 7),
    'streak-14': Math.min(bestStreak, 14),
    'streak-30': Math.min(bestStreak, 30),
    'gym-15': Math.min(gym, 15),
    'diet-15': Math.min(diet, 15),
    'sleep-15': Math.min(sleep, 15),
    'skill-20h': Math.min(Math.floor(skillHours), 20),
    'tasks-5': Math.min(submitted, 5),
    'weight-5': Math.min(Math.floor(lost), 5),
  };
}

export function evaluateAchievements(days = [], assignments = [], settings = {}) {
  const s = stats(days, assignments, settings);
  return ACHIEVEMENTS.map((a) => {
    const progress = s[a.id] ?? 0;
    const unlocked = progress >= a.total;
    return { ...a, progress, unlocked, pct: Math.min(100, Math.round((progress / a.total) * 100)) };
  });
}

export function getLevel(unlockedCount) {
  if (unlockedCount >= 13) return { name: 'Legend', icon: '👑' };
  if (unlockedCount >= 10) return { name: 'Elite', icon: '❄️' };
  if (unlockedCount >= 7) return { name: 'Disciplined', icon: '💪' };
  if (unlockedCount >= 4) return { name: 'Rising', icon: '🚀' };
  return { name: 'Novice', icon: '🌱' };
}

export function achievementXP(evaluated, days = []) {
  const unlocked = evaluated.filter((a) => a.unlocked).length;
  const bestStreak = Math.max(0, ...days.map((d) => d.streak || 0));
  const logged = days.filter((d) => d.logged).length;
  return unlocked * 100 + bestStreak * 10 + logged * 5;
}
