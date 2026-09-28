/**
 * SPIKE (L4 suggestions): written stand-ins for teacher footage we do not have yet — how a
 * teacher talks through a West Coast Swing pattern, in the style Whisper returns it. Each says
 * what a good suggestion would be, so a run can be judged at a glance. The real transcripts on
 * the active list are offered next to these.
 */
export type Sample = {
  id: string;
  language: string;
  transcript: string;
  expect: string;
};

export const SAMPLES: Sample[] = [
  {
    id: "en-sugar-push",
    language: "en",
    transcript:
      "Okay, so this one is the sugar push, very basic, everybody knows it. Leads, on one and two you're bringing her in, compress on three and four, and then on five six you send her back out, triple step, anchor. Followers, don't come in on your own, wait for the compression, keep a little bit of tone in the arm. Okay? And anchor, anchor, anchor. Let's do it with music. Five, six, seven, eight.",
    expect:
      "Sugar Push — lead brings in on 1-2, compression on 3-4, sends out on 5-6; follow waits for the compression, keeps tone.",
  },
  {
    id: "en-sugar-bush",
    language: "en",
    transcript:
      "Alright, from the sugar bush we add a little tuck. On three and four, instead of just compressing, you lift the left hand a bit and turn her wrist, she turns under on five six. Followers, it's a free spin, don't hold on to his hand. That's the sugar tuck.",
    expect:
      "Sugar Tuck turn (vocabulary) — not 'Sugar Bush'; tuck on 3-4, free spin on 5-6.",
  },
  {
    id: "de-left-side-pass",
    language: "de",
    transcript:
      "Also, das hier ist der Links-Seitenpass. Führende, ihr geht auf eins, zwei aus dem Slot raus, nach links, und macht Platz. Die Folgenden laufen einfach gerade durch, eins, zwei, Triple-Step, Triple-Step, und am Ende ankern. Wichtig ist, dass ihr die Hand nicht hochzieht, die bleibt auf Hüfthöhe. Ja? Und nicht zu früh drehen, erst wenn ihr am Ende vom Slot seid. Noch mal mit Musik, fünf, sechs, sieben, acht.",
    expect:
      "Left side pass / Links-Seitenpass (German) — lead leaves the slot to the left on 1-2, follow walks straight through, hand at hip height, turn only at the end.",
  },
  {
    id: "es-whip",
    language: "es",
    transcript:
      "Bueno, ahora vamos con el whip, el látigo. Líder, en el uno y dos traes a la chica hacia ti, en el tres y cuatro la giras con el brazo en la espalda, y en cinco seis la sueltas de vuelta al slot. Son ocho tiempos, no seis, ¿vale? Seguidora, mantén el frame, no te adelantes. Y el ancla al final siempre. Vamos otra vez, cinco, seis, siete, ocho.",
    expect:
      "Whip (Spanish) — eight counts; bring in on 1-2, turn with arm on the back on 3-4, release on 5-6; follow keeps frame, anchors.",
  },
  {
    id: "en-break",
    language: "en",
    transcript:
      "Okay guys, grab some water, we're gonna take five minutes and then, yeah, then we'll switch partners. Who has the speaker? No, the other one. Okay.",
    expect: "Nothing — both empty.",
  },
];
