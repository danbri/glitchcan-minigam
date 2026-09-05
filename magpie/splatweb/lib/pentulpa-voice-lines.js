// pentulpa-voice-lines.js — Toki Pona dialogue lines for Pentulpa Capulet's
// five personas, written by the owner for future ElevenLabs voice
// generation. Not wired into demo-lam-pentagram.html yet — this is just
// the reference script, saved so it isn't lost, in a shape that's easy to
// pull from once voices exist (one voice per persona, cycling/random line
// selection per persona on-switch or on-talk-burst).
//
// `id` matches PERSONAS[].id in demo-lam-pentagram.html exactly, so a
// future integration can do e.g.
//   import { VOICE_LINES } from './lib/pentulpa-voice-lines.js';
//   const lines = VOICE_LINES.find(p => p.id === persona.id).lines;
export const VOICE_LINES = [
  {
    id: 'architect',
    lines: [
      { tokiPona: 'sina musi taso. mi sona e nasin ale.', english: 'YOU ARE ONLY A GAME. I KNOW ALL PATHS.' },
      { tokiPona: 'sina lili. mi pakala e sina.', english: 'YOU ARE SMALL. I WILL BREAK YOU.' },
      { tokiPona: 'tenpo sina li kama pini. mi lawa e ale.', english: 'YOUR TIME IS ENDING. I RULE ALL.' },
      { tokiPona: 'o utala. mi sona e tenpo kama sina.', english: 'FIGHT. I KNOW YOUR FUTURE.' },
      { tokiPona: 'mi pali e nasin. sina tawa lon ona.', english: 'I MAKE THE PATH. YOU WALK IT.' },
    ],
  },
  {
    id: 'executioner',
    lines: [
      { tokiPona: 'mi pakala e sijelo sina! telo loje!', english: 'I BREAK YOUR BODY! BLOOD!' },
      { tokiPona: 'utala taso! mi wile e moli sina!', english: 'ONLY BATTLE! I WANT YOUR DEATH!' },
      { tokiPona: 'ilo utala mi li pakala e lawa sina!', english: 'MY WEAPON SMASHES YOUR HEAD!' },
      { tokiPona: 'mi mu! sina ken ala awen lon!', english: 'I ROAR! YOU CANNOT SURVIVE!' },
      { tokiPona: 'pilin mi li seli! o moli!', english: 'MY HEART BURNS! DIE!' },
    ],
  },
  {
    id: 'corruptor',
    lines: [
      { tokiPona: 'sina pona lukin. o kama tawa mi.', english: 'YOU ARE BEAUTIFUL. COME TO ME.' },
      { tokiPona: 'mi pana e ijo pona. o pana e pilin sina.', english: 'I GIVE GOOD THINGS. GIVE ME YOUR HEART.' },
      { tokiPona: 'jan ante li ike. mi taso li olin e sina.', english: 'OTHERS ARE BAD. ONLY I LOVE YOU.' },
      { tokiPona: 'o kute e kalama mi. mi pana e wawa.', english: 'LISTEN TO MY VOICE. I GIVE YOU POWER.' },
      { tokiPona: 'o weka e jan pona sina. mi taso li pona.', english: 'CAST AWAY YOUR FRIENDS. ONLY I AM GOOD.' },
    ],
  },
  {
    id: 'mourner',
    lines: [
      { tokiPona: 'ale li pakala. telo lukin li pini ala.', english: 'EVERYTHING IS BROKEN. THE TEARS NEVER END.' },
      { tokiPona: 'mi pilin ike tan sina. o pini.', english: 'I SUFFER BECAUSE OF YOU. STOP.' },
      { tokiPona: 'pini li kama. ale li anpa.', english: 'THE END IS COMING. EVERYTHING FALLS.' },
      { tokiPona: 'sina ken ala pona e ijo. ale li weka.', english: 'YOU CANNOT FIX ANYTHING. ALL IS LOST.' },
      { tokiPona: 'moli taso li awen. o kalama ala.', english: 'ONLY DEATH REMAINS. MAKE NO SOUND.' },
    ],
  },
  {
    id: 'prophet',
    lines: [
      { tokiPona: 'mu! sewi li anpa! tenpo pini li tenpo kama!', english: 'MU! THE SKY IS BELOW! THE PAST IS THE FUTURE!' },
      { tokiPona: 'o lukin e oko mi! ona li moku e sina!', english: 'LOOK INTO MY EYES! THEY EAT YOU!' },
      { tokiPona: 'toki li nasa! tenpo li jo ala e suno!', english: 'WORDS ARE MAD! TIME HAS NO LIGHT!' },
      { tokiPona: 'telo sewi li loje! mi mute li tawa lon kon!', english: 'THE RAIN IS RED! WE MOVE THROUGH THE AIR!' },
      { tokiPona: 'kiwen li mu! sina moli lon tenpo pini!', english: 'THE STONE CRIES OUT! YOU DIE IN THE PAST!' },
    ],
  },
];
