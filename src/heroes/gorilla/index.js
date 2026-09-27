import { createGorilla } from './model.js';
import { createGorillaKit, GORILLA as S } from './kit.js';

// ГОРИЛЛА — описание героя: всё, что нужно выбору героя, ботам и таблице баланса.
export default {
  id: 'gorilla',
  order: 5,
  name: 'Горилла',
  role: 'Ближний бой · танк',
  about: 'Два удара кулаком, третьим — хватает и швыряет врага в сторону прицела. Ульта — рёв: ускорение на 5 с и прыжок в точку (нажми ульту ещё раз).',
  color: '#7a7f8c',
  // файлы озвучки: public/voices/gorilla_<событие>.mp3
  icons: { attack: '👊', special: '🦍' },
  stats: S,
  radius: 0.78,           // заметно крупнее остальных (у них 0.5); все проходы на картах ≥ 1,6 м — npm run sim -- gaps
  headY: 4.2,
  stride: 1.1,             // галоп на костяшках: ноги длиннее — шаг реже
  sounds: { death: 'gorillaDeath' },
  createModel: createGorilla,
  createKit: createGorillaKit,
  balance: {
    attack: `удар ${S.punchDamage}, вблизи`,
    special: `бросок: ${S.throwDamage} и отброс на ${S.throwDist} м в сторону прицела`,
    ult: `рёв: +${Math.round((S.ultSpeedMul - 1) * 100)}% скорости ${S.ultDuration} с и прыжок до ${S.jumpRange} м: ${S.jumpDamage} в радиусе ${S.jumpRadius}, отброс ${S.jumpKnock} м`,
  },
  bot: {
    melee: true,
    range: 2.0,
    keep: 1.3,
    // рёв — когда враг рядом; прыжок вторым нажатием — с упреждением на время полёта
    ult: { range: 8, recast: { range: S.jumpRange - 0.3, lead: S.jumpTime } },
  },
};
