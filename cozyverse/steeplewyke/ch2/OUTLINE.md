# Steeple Wyke, chapter 2: Plain Hunt (draft outline for the owner)

Status: DRAFT for approval. No credits spent. Follows the photo-novel skill. Ten pages, the same format and host as
chapter 1 v2: <https://danbri.github.io/glitchcan-minigam/cozyverse/steeplewyke/v2/>

## The premise in three lines

October, five weeks after the Marrow Show. St Aldhelm's has no vicar (chapter 1 saw to that) and an interim one who
used to be an actuary. On Tuesday practice night, Hugh Daventry, local historian and quizmaster at the Plough, is
found at the foot of the tower stair while six ringers swear they rang without a break. They did not: a phone
recording of the practice says so, if you can read change ringing.

"Plain hunt" is the first method every ringer learns. It is also what Sam does: the same pattern, place to place,
until it comes round again.

## What makes it more puzzling than chapter 1

Two real systems the reader works out, not riddles:

1. **The ringing.** Plain hunt on six bells: each row, pairs of bells swap places; first the pairs (1-2, 3-4, 5-6),
   then (2-3, 4-5), alternately, until the order comes back to 123456 after twelve rows. Page 1 teaches it as
   Win's three-minute lesson to Sam (the reader may skip it, at a cost). Dilys recorded the practice for her
   sister; the 8:14 stretch, written out as rows, has three rows with no 4 in them and the 6 twice. So the bell
   called 4 was silent for about forty seconds, and the band covered with "plain hunt on five" before Win called
   "Stand". The reader must find which bell went quiet (a choice page: tap the bell).
2. **The swap.** The tower board says who rings which bell. But that night "we all moved up one" (Dilys), because
   Hugh was meant to ring the treble and did not come up. Apply the swap to the board, and bell 4 was not Win: it
   was Jeremy Cole. Two steps, each checkable.
3. **The typeface.** Hugh's last parish-magazine proof, in his pocket: "PEAL BOARD: A CORRECTION. H.D." The tower's
   "1897 Jubilee peal board", bought last year for nine thousand pounds of roof money from Jeremy, is lettered in
   Gill Sans. Monotype released Gill Sans in 1928. Question 7 on Hugh's unfinished quiz sheet at the Plough: "In what
   year was the typeface Gill Sans released?" He was going to ask the village, then answer it in print.

A reader can solve it from the ringing and the swap alone, from the board and the quiz sheet alone, or from both
(the evidence count decides how well the accusation holds, as in chapter 1).

## Cast

Kept: DCI Quaile, DS Sam Adeyemi (the reader), Margaret Pike (now churchwarden), Dilys Rudd (rings the 3, loudly),
Toby Pike (selling the old schoolhouse). New (three photographic sheets):

- **Win Haskett**, 78, tower captain for 41 years, deaf from bells as Quaile is deaf from something she will not
  name. Their scene together is conducted at the wrong volume and is the warmest thing in the chapter.
- **Jeremy Cole**, 52, antiques dealer from the barn on the Cirencester road; restores "with sympathy". The culprit.
  He did not mean to push Hugh; he meant to get the proof back. Hugh fell. Jeremy went back up and rang.
- **The Reverend Dr Ruth Achebe**, 44, interim vicar, a former actuary. She gives every suspect a probability out
  loud, and is right more often than Quaile likes.
- **Hugh Daventry**, 70, the victim; seen alive only in the quiz-night photo behind the bar.

## The one moment the plot does not use

Margaret, making the ringers' tea in the vestry before anyone knows about Hugh, puts out two cups by habit, then
puts one back. Nobody comments. No clue depends on it.

## Humour, from wants that collide with the inquiry

- Win cannot hear a question unless it is shouted, and will not answer one that is. Quaile switches her hearing aid
  off in solidarity, and the two of them conduct an interview by note.
- Dr Achebe: "On base rates, Inspector, it is usually the person who found him. That is me. I would put myself at
  eleven per cent."
- Toby is selling the schoolhouse with a drone video; the drone happens to have filmed the churchyard at 8:16.

## The village remembers (chapter 1 pays off)

- Toby warm: he sends the drone video unasked (Jeremy's van leaving at 8:16). Toby cold: he refuses, and the
  footage costs one of the four visits (through Dilys, who is in it).
- Margaret cold (you counted her foxgloves or accused her): she will not unlock the vestry; you go in with
  Dr Achebe's key, and miss the two cups.
- Dilys warm: she offers the recording at once. Otherwise she has to be asked twice.
- Quaile warm: one hint at the pub names the system you have not used ("Have you looked at the board, or just the
  people standing under it?").

## Pages

| page | place | what happens | short loop |
|---|---|---|---|
| 1 | the tower, outside | practice night; Win teaches Sam plain hunt on a bar napkin (the rule, playable) | rooks circling the tower |
| 2 | ringing chamber | the six ropes, the board, the band; the tenor stops; a shout below | sallies swaying |
| 3 | the vestry | Hugh at the foot of the stair, discreet; the proof in his pocket; Margaret's two cups | candle flame |
| hub | four of five | Win's cottage · Jeremy's barn · the Plough quiz night · the schoolhouse · the tower board | |
| 4 | Win's cottage | the interview by note; she rang 4 "as always" (true on any other night) | net curtain |
| 5 | Jeremy's barn | "restored with sympathy"; a sign-writer's brush still wet with gold | dust in a sunbeam |
| 6 | the Plough | quiz sheet, question 7 in Hugh's hand; the photo behind the bar | fire in the grate |
| 7 | the schoolhouse | Toby's drone, the van at 8:16 (or Dilys, by memory route) | swing in the playground |
| 8 | the tower board | gold letters; a magnifying glass; Dr Achebe's eleven per cent | dust motes |
| 9 | the rows | the recording written out; find the silent bell, apply the swap, name the ringer | none (a still: the reader is thinking) |
| 10 | Sunday service | resolution; the board comes down; the canary | the canary |

## The wrong note

The canary. Small, bright, slightly glitching, never mentioned by anyone: once on page 4 of chapter 1 (the marrows),
then once on most pages here, in the background, for a second. On page 10 it sits on the tenor bell's wheel, and the
bell rings once with nobody on the rope. The scarecrow in Sam's clothes from chapter 1 stands in the ringing chamber,
holding the treble rope Hugh never came up to ring.

## Things to check before any media is made

- The ringing rows on page 9 are generated by code (the rule, then the fault), not typed; `tools/walk.mjs` plays
  the chapter with taps; every guard in the photo-novel skill applies.
- A non-ringer can solve page 9 from page 1 alone; test that with someone who has not read this outline.
- Ringing terms used correctly and sparingly: rounds, plain hunt, treble, tenor, sally, "Stand", "Look to".

## Cost, if approved

About 106,000 ElevenLabs credits (about $23): three character sheets (~4,000), forty panels (~75,000), ten short
loops (~21,000), fifty sounds (~6,000), voices on eleven_v4 (0 while it is priced at 0). The ink is about 1,000 lines.
