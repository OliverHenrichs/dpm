/**
 * What changed in each released version, newest first. The Settings screen lists all of it, and
 * the what's-new hint shows the entries a user has not seen yet (see `src/changelog/AGENTS.md`).
 *
 * A release adds an entry at the top whose `version` is the app's version (`app.config.ts`), with
 * notes in every shipped language. `__tests__/unit/changelog.test.ts` fails on a missing language,
 * a language with a different number of notes, versions out of order, or a newest entry that is
 * not the app's version.
 */

export interface ChangelogEntry {
  /** The app version this entry describes, `major.minor.patch`. */
  version: string;
  /** Release day, `YYYY-MM-DD`; left out while the version is not released yet. */
  date?: string;
  /** Short notes per language code (`src/settings/types/Languages.ts`), the same ones in each. */
  notes: Record<string, string[]>;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.1",
    notes: {
      en: [
        "Videos now sit near the top of the pattern editor. Rhythm, description, prerequisites and tags fold away until you need them.",
        "Sorted by date added, patterns sit under a heading for each day.",
        "Downloading an on-device model carries on when you switch to another app.",
        "The rhythm field no longer offers whole rhythms before you start; the step-by-step suggestions stay.",
        "New: a short note like this one after each update, and the full list of changes in Settings, where you can also turn the note off.",
      ],
      zh: [
        "视频现在位于舞步编辑器的顶部附近。节奏、说明、前置舞步和标签会先折叠起来，需要时再展开。",
        "按添加日期排序时，舞步按天分组，每天有一个标题。",
        "切换到其他应用时，本机模型的下载会继续进行。",
        "开始输入之前，节奏字段不再提供完整的节奏；逐步建议仍然保留。",
        "更新后会显示这条说明，完整的更新记录在设置中，也可以在那里关闭这条说明。",
      ],
      hi: [
        "वीडियो अब पैटर्न संपादक में ऊपर की ओर हैं। लय, विवरण, पूर्वापेक्षाएँ और टैग तब तक सिमटे रहते हैं जब तक आपको उनकी ज़रूरत न हो।",
        "जोड़ने की तारीख़ से क्रमबद्ध करने पर पैटर्न हर दिन के शीर्षक के नीचे दिखते हैं।",
        "किसी दूसरे ऐप पर जाने पर भी डिवाइस पर मॉडल की डाउनलोडिंग जारी रहती है।",
        "लय वाला फ़ील्ड अब शुरू करने से पहले पूरी लय नहीं सुझाता; चरण-दर-चरण सुझाव बने रहते हैं।",
        "अपडेट के बाद यह सूचना, और सेटिंग्स में बदलावों की पूरी सूची, जहाँ आप यह सूचना बंद भी कर सकते हैं।",
      ],
      es: [
        "Los vídeos están ahora cerca del principio del editor de figuras. Ritmo, descripción, requisitos previos y etiquetas se pliegan hasta que los necesites.",
        "Al ordenar por fecha de creación, las figuras aparecen bajo un encabezado por día.",
        "La descarga de un modelo en el dispositivo continúa cuando cambias a otra app.",
        "El campo de ritmo ya no ofrece ritmos completos antes de empezar; las sugerencias paso a paso se mantienen.",
        "Esta nota después de una actualización y la lista completa de cambios en Ajustes, donde también puedes desactivar la nota.",
      ],
      fr: [
        "Les vidéos sont désormais en haut de l'éditeur de figure. Rythme, description, prérequis et étiquettes restent repliés jusqu'à ce que vous en ayez besoin.",
        "Triées par date d'ajout, les figures se rangent sous un titre par jour.",
        "Le téléchargement d'un modèle sur l'appareil continue quand vous passez à une autre app.",
        "Le champ rythme ne propose plus de rythmes complets avant que vous commenciez ; les suggestions pas à pas restent.",
        "Cette note après une mise à jour, et la liste complète des changements dans Réglages, où vous pouvez aussi désactiver la note.",
      ],
      ar: [
        "أصبحت مقاطع الفيديو الآن قرب أعلى محرر الخطوة. ويبقى الإيقاع والوصف والمتطلبات السابقة والوسوم مطويّة حتى تحتاج إليها.",
        "عند الترتيب حسب تاريخ الإضافة، تظهر الخطوات تحت عنوان لكل يوم.",
        "يستمر تنزيل نموذج على الجهاز عند الانتقال إلى تطبيق آخر.",
        "لم يعد حقل الإيقاع يقترح إيقاعات كاملة قبل أن تبدأ؛ وتبقى الاقتراحات خطوة بخطوة.",
        "هذه الملاحظة بعد كل تحديث، والقائمة الكاملة للتغييرات في الإعدادات، حيث يمكنك أيضًا إيقاف الملاحظة.",
      ],
      bn: [
        "ভিডিও এখন প্যাটার্ন সম্পাদকের উপরের দিকে থাকে। ছন্দ, বিবরণ, পূর্বশর্ত আর ট্যাগ দরকার না হওয়া পর্যন্ত গুটিয়ে থাকে।",
        "যোগ করার তারিখ অনুযায়ী সাজালে প্যাটার্নগুলো প্রতিটি দিনের শিরোনামের নিচে থাকে।",
        "অন্য অ্যাপে গেলেও ডিভাইসে থাকা মডেলের ডাউনলোড চলতে থাকে।",
        "ছন্দের ঘর এখন শুরু করার আগে পুরো ছন্দ প্রস্তাব করে না; ধাপে ধাপে প্রস্তাবগুলো থাকছে।",
        "আপডেটের পরে এই বার্তা, আর সেটিংসে পরিবর্তনের পুরো তালিকা, যেখানে বার্তাটি বন্ধও করা যায়।",
      ],
      pt: [
        "Os vídeos agora ficam perto do topo do editor de passos. Ritmo, descrição, pré-requisitos e etiquetas ficam recolhidos até você precisar deles.",
        "Ao ordenar por data de inclusão, os passos aparecem sob um título para cada dia.",
        "O download de um modelo no dispositivo continua quando você muda para outro app.",
        "O campo de ritmo não oferece mais ritmos completos antes de você começar; as sugestões passo a passo continuam.",
        "Esta nota depois de uma atualização e a lista completa de mudanças nas Configurações, onde você também pode desativar a nota.",
      ],
      de: [
        "Videos stehen jetzt weit oben im Figuren-Editor. Rhythmus, Beschreibung, Voraussetzungen und Tags sind eingeklappt, bis du sie brauchst.",
        "Nach Hinzufügedatum sortiert, stehen die Figuren unter einer Überschrift pro Tag.",
        "Das Herunterladen eines Modells auf das Gerät läuft weiter, wenn du zu einer anderen App wechselst.",
        "Das Rhythmusfeld bietet keine ganzen Rhythmen mehr an, bevor du anfängst; die Vorschläge Schritt für Schritt bleiben.",
        "Neu: ein kurzer Hinweis wie dieser nach jedem Update und die vollständige Liste der Änderungen in den Einstellungen, wo du den Hinweis auch abschalten kannst.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-10-10",
    notes: {
      en: [
        "First alpha: keep your figures in lists with counts, rhythm, level, tags, prerequisites and videos.",
        "See on the Map how figures build on each other, and browse your videos in Reels.",
        'Add variations as modifiers, like "with inside turn".',
        "Shorten, anonymize or transcribe a video on your phone.",
        "Share a list by code or QR, or export it as a file.",
      ],
      zh: [
        "首个测试版：把舞步整理成列表，包含拍数、节奏、级别、标签、前置舞步和视频。",
        "在地图上查看舞步之间的关系，并在短视频中浏览你的视频。",
        "把变体作为变化添加到舞步上，例如“带内转”。",
        "在手机上剪短视频、匿名化视频或转写视频中的讲解。",
        "通过代码或二维码分享列表，或导出为文件。",
      ],
      hi: [
        "पहला अल्फ़ा: अपने पैटर्न सूचियों में रखें, गिनती, लय, स्तर, टैग, पूर्वापेक्षाओं और वीडियो के साथ।",
        "मानचित्र पर देखें कि पैटर्न एक-दूसरे पर कैसे आधारित हैं, और रील्स में अपने वीडियो देखें।",
        'विविधताओं को मॉडिफ़ायर के रूप में जोड़ें, जैसे "इनसाइड टर्न के साथ"।',
        "अपने फ़ोन पर ही वीडियो छोटा करें, गुमनाम करें या उसका प्रतिलेख बनाएँ।",
        "कोड या QR से सूची साझा करें, या उसे फ़ाइल के रूप में निर्यात करें।",
      ],
      es: [
        "Primera alfa: guarda tus figuras en listas con tiempos, ritmo, nivel, etiquetas, requisitos previos y vídeos.",
        "Mira en el Mapa cómo se construyen unas figuras sobre otras y repasa tus vídeos en Reels.",
        'Añade variaciones como modificadores, por ejemplo "con giro interior".',
        "Acorta, anonimiza o transcribe un vídeo en tu teléfono.",
        "Comparte una lista con un código o QR, o expórtala como archivo.",
      ],
      fr: [
        "Première alpha : rangez vos figures dans des listes avec temps, rythme, niveau, étiquettes, prérequis et vidéos.",
        "Voyez sur la Carte comment les figures s'enchaînent, et parcourez vos vidéos dans Reels.",
        "Ajoutez des variantes comme modificateurs, par exemple « avec inside turn ».",
        "Raccourcissez, anonymisez ou transcrivez une vidéo sur votre téléphone.",
        "Partagez une liste par code ou QR, ou exportez-la en fichier.",
      ],
      ar: [
        "أول نسخة ألفا: احفظ خطواتك في قوائم مع العدّات والإيقاع والمستوى والوسوم والمتطلبات السابقة ومقاطع الفيديو.",
        "شاهد على الخريطة كيف تُبنى الخطوات بعضها على بعض، وتصفّح مقاطعك في قسم المقاطع.",
        "أضف التنويعات كمُعدِّلات، مثل «مع دوران داخلي».",
        "اختصر مقطع فيديو أو أخفِ هوية الراقصين فيه أو حوّل كلامه إلى نص على هاتفك.",
        "شارك قائمة برمز أو QR، أو صدّرها كملف.",
      ],
      bn: [
        "প্রথম আলফা: আপনার প্যাটার্নগুলো তালিকায় রাখুন, গণনা, ছন্দ, স্তর, ট্যাগ, পূর্বশর্ত আর ভিডিওসহ।",
        "মানচিত্রে দেখুন প্যাটার্নগুলো কীভাবে একটির উপর আরেকটি দাঁড়ায়, আর রিলসে ভিডিওগুলো দেখুন।",
        'ভিন্নরূপগুলো মডিফায়ার হিসেবে যোগ করুন, যেমন "ইনসাইড টার্ন সহ"।',
        "ফোনেই ভিডিও ছোট করুন, পরিচয় লুকান বা কথাগুলো লিখিত রূপে আনুন।",
        "কোড বা QR দিয়ে তালিকা শেয়ার করুন, অথবা ফাইল হিসেবে রপ্তানি করুন।",
      ],
      pt: [
        "Primeira alfa: guarde seus passos em listas com contagens, ritmo, nível, etiquetas, pré-requisitos e vídeos.",
        "Veja no Mapa como os passos se apoiam uns nos outros e percorra seus vídeos em Reels.",
        'Adicione variações como modificadores, por exemplo "com giro para dentro".',
        "Encurte, anonimize ou transcreva um vídeo no seu celular.",
        "Compartilhe uma lista por código ou QR, ou exporte-a como arquivo.",
      ],
      de: [
        "Erste Alpha: Halte deine Figuren in Listen fest, mit Zählzeiten, Rhythmus, Level, Tags, Voraussetzungen und Videos.",
        "Sieh auf der Karte, wie Figuren aufeinander aufbauen, und blättere in Reels durch deine Videos.",
        "Füge Variationen als Modifikatoren hinzu, etwa „mit Inside Turn“.",
        "Kürze, anonymisiere oder transkribiere ein Video auf deinem Handy.",
        "Teile eine Liste per Code oder QR, oder exportiere sie als Datei.",
      ],
    },
  },
];

/** Compares two `major.minor.patch` versions: negative, zero or positive, like a sort comparator. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((part) => parseInt(part, 10) || 0);
  const pb = b.split(".").map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** The entry's notes in `language`, or in English where it has none (a region code falls back to its base). */
export function notesFor(entry: ChangelogEntry, language: string): string[] {
  return (
    entry.notes[language] ??
    entry.notes[language.split("-")[0]] ??
    entry.notes.en ??
    []
  );
}

export interface WhatsNewInput {
  entries: ChangelogEntry[];
  /** The newest version whose notes the user has seen, or `null` if none was ever recorded. */
  seenVersion: string | null;
  /** Whether the user wants the hint (Settings). */
  hintEnabled: boolean;
  /** Whether the app holds data from before this launch (any list), i.e. this is an update. */
  hasExistingData: boolean;
}

export interface WhatsNewDecision {
  /** Entries to show in the hint, newest first; empty for no hint. */
  show: ChangelogEntry[];
  /** The version to record as seen once the hint is closed, or right away when nothing shows. */
  markSeen: string | null;
}

/**
 * Whether to show the what's-new hint on this launch, and with which entries.
 *
 * A first install shows nothing: everything is new, and the app is its own introduction. An app
 * that already holds lists but has never recorded a version was updated from a build without the
 * hint, so it gets the newest entry. A user who turned the hint off still has the version
 * recorded, so turning it back on does not replay every update since.
 */
export function decideWhatsNew({
  entries,
  seenVersion,
  hintEnabled,
  hasExistingData,
}: WhatsNewInput): WhatsNewDecision {
  const latest = entries[0]?.version;
  if (!latest) return { show: [], markSeen: null };
  if (seenVersion !== null && compareVersions(seenVersion, latest) >= 0) {
    return { show: [], markSeen: null };
  }

  let unseen: ChangelogEntry[];
  if (seenVersion === null) {
    unseen = hasExistingData ? [entries[0]] : [];
  } else {
    unseen = entries.filter((e) => compareVersions(e.version, seenVersion) > 0);
  }
  return { show: hintEnabled ? unseen : [], markSeen: latest };
}
