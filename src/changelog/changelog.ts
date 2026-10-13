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
    version: "1.0.2",
    notes: {
      en: [
        "In the pattern editor, Save stays greyed out until the pattern has a name. Tapping it says so and takes you to the name field.",
        "A new West Coast Swing list from the template now shows what builds on what (Sugar Tuck on Sugar Push, Tuck Turn on Left Side Pass) and brings turns, hesitation and hand change as modifiers. With no lists yet, you can open an example list to see it all on the Map.",
        "When you tap the dancers to anonymize a video, each one you picked is outlined on the frame in their silhouette's colour, so you can check it is the right person before the render starts.",
        "Brazilian Zouk is a new dance for lists. Its template starts with Basic, Viradinha, Lateral, Elástico and Bonus, on the slow-quick-quick rhythm.",
        "In the pattern editor, tags are picked like prerequisites, right in their section: the pattern's own come first and highlighted, then the list's others, most used first. A newly chosen one moves to the front. Both searches need only a few letters in order, like \"sgpsh\" for Sugar Push.",
        "Text fields in forms, dialogs and sheets now stay above the keyboard while you type.",
      ],
      zh: [
        "在舞步编辑器中，舞步命名之前“保存”按钮会保持灰色。点按它会显示提示，并跳到名称字段。",
        "用模板新建的 West Coast Swing 列表现在会显示舞步之间的依赖关系（Sugar Tuck 基于 Sugar Push，Tuck Turn 基于 Left Side Pass），并自带转圈、hesitation 和换手等修饰。还没有列表时，你可以打开一个示例列表，在地图上看到这一切。",
        "点选舞者以匿名化视频时，你选中的每位舞者都会在画面上以其剪影的颜色勾出轮廓，这样你可以在开始处理之前确认选对了人。",
        "列表新增舞种 Brazilian Zouk（巴西祖克）。它的模板自带 Basic、Viradinha、Lateral、Elástico 和 Bonus，节奏为慢-快-快。",
        "在舞步编辑器中，标签现在像前置舞步一样直接在其栏目中选择：舞步已有的标签排在前面并高亮显示，其后是列表中的其他标签，最常用的在前。新选的会移到最前面。两处搜索只需按顺序输入几个字母即可，例如用“sgpsh”找到 Sugar Push。",
        "表单、对话框和底部面板中的文本框在输入时会保持在键盘上方。",
      ],
      hi: [
        "पैटर्न संपादक में, जब तक पैटर्न का नाम न हो, सहेजें बटन धूसर रहता है। उस पर टैप करने से यही बताया जाता है और आप नाम वाले फ़ील्ड पर पहुँच जाते हैं।",
        "टेम्पलेट से बनी नई West Coast Swing सूची अब दिखाती है कि कौन-सा पैटर्न किस पर आधारित है (Sugar Tuck, Sugar Push पर; Tuck Turn, Left Side Pass पर), और टर्न, hesitation और हाथ बदलना मॉडिफ़ायर के रूप में साथ लाती है। जब तक कोई सूची न हो, आप एक उदाहरण सूची खोलकर यह सब मानचित्र पर देख सकते हैं।",
        "वीडियो गुमनाम करने के लिए डांसरों पर टैप करने पर, आपके चुने हर व्यक्ति की रूपरेखा फ़्रेम पर उसकी सिल्हूट के रंग में दिखती है, ताकि रेंडर शुरू होने से पहले आप जाँच सकें कि सही व्यक्ति चुना गया है।",
        "सूचियों के लिए नया नृत्य: Brazilian Zouk। इसका टेम्पलेट Basic, Viradinha, Lateral, Elástico और Bonus से शुरू होता है, धीमी-तेज़-तेज़ लय पर।",
        'पैटर्न संपादक में, टैग अब पूर्वापेक्षाओं की तरह सीधे अपने भाग में चुने जाते हैं: पैटर्न के अपने टैग पहले और हाइलाइट होकर दिखते हैं, फिर सूची के बाकी टैग, सबसे ज़्यादा इस्तेमाल वाले पहले। नया चुना गया टैग सबसे आगे आ जाता है। दोनों खोजों में बस कुछ अक्षर क्रम से लिखने होते हैं, जैसे Sugar Push के लिए "sgpsh"।',
        "फ़ॉर्म, संवाद और शीट के टेक्स्ट फ़ील्ड अब टाइप करते समय कीबोर्ड के ऊपर दिखते रहते हैं।",
      ],
      es: [
        "En el editor de figuras, Guardar sigue en gris hasta que la figura tenga nombre. Al tocarlo, te lo indica y te lleva al campo del nombre.",
        "Una nueva lista de West Coast Swing creada desde la plantilla ahora muestra qué se basa en qué (Sugar Tuck en Sugar Push, Tuck Turn en Left Side Pass) e incluye giros, hesitation y cambio de mano como modificadores. Si aún no tienes listas, puedes abrir una lista de ejemplo y verlo todo en el Mapa.",
        "Al tocar a los bailarines para anonimizar un vídeo, cada persona elegida aparece contorneada en el fotograma con el color de su silueta, para que compruebes que es la correcta antes de que empiece el proceso.",
        "Zouk brasileño es un nuevo baile para las listas. Su plantilla empieza con Basic, Viradinha, Lateral, Elástico y Bonus, con el ritmo lento-rápido-rápido.",
        "En el editor de figuras, las etiquetas se eligen como los requisitos previos, en su propia sección: primero las de la figura, resaltadas, y después las demás de la lista, las más usadas primero. La que eliges pasa al principio. Para buscar en ambas bastan unas letras en orden, como «sgpsh» para Sugar Push.",
        "Los campos de texto de formularios, diálogos y paneles ahora quedan por encima del teclado mientras escribes.",
      ],
      fr: [
        "Dans l'éditeur de figures, Enregistrer reste grisé tant que la figure n'a pas de nom. Un appui l'indique et vous amène au champ du nom.",
        "Une nouvelle liste West Coast Swing créée depuis le modèle montre désormais ce qui repose sur quoi (Sugar Tuck sur Sugar Push, Tuck Turn sur Left Side Pass) et apporte les tours, l'hésitation et le changement de main comme modificateurs. Sans liste encore, vous pouvez ouvrir une liste d'exemple pour voir tout cela sur la Carte.",
        "Quand vous touchez les danseurs pour anonymiser une vidéo, chaque personne choisie est détourée sur l'image dans la couleur de sa silhouette, pour vérifier que c'est la bonne avant le rendu.",
        "Le zouk brésilien est une nouvelle danse pour les listes. Son modèle commence par Basic, Viradinha, Lateral, Elástico et Bonus, sur le rythme lent-rapide-rapide.",
        "Dans l'éditeur de figures, les étiquettes se choisissent comme les prérequis, dans leur section : celles de la figure d'abord, en surbrillance, puis les autres de la liste, les plus utilisées en premier. Une étiquette choisie passe en tête. Les deux recherches n'ont besoin que de quelques lettres dans l'ordre, comme « sgpsh » pour Sugar Push.",
        "Les champs de texte des formulaires, boîtes de dialogue et panneaux restent désormais au-dessus du clavier pendant la saisie.",
      ],
      ar: [
        "في محرر الخطوات، يبقى زر الحفظ رماديًا حتى يكون للخطوة اسم. يوضّح النقر عليه ذلك وينقلك إلى حقل الاسم.",
        "قائمة West Coast Swing الجديدة من القالب تُظهر الآن ما يُبنى على ماذا (Sugar Tuck على Sugar Push، وTuck Turn على Left Side Pass)، وتأتي بالدورانات والـ hesitation وتبديل اليد كمعدِّلات. إن لم تكن لديك قوائم بعد، يمكنك فتح قائمة مثال لترى كل ذلك على الخريطة.",
        "عند النقر على الراقصين لإخفاء هوية فيديو، يظهر كل شخص اخترته محاطًا بمخطط بلون صورته الظلية على الإطار، لتتأكد من أنه الشخص الصحيح قبل بدء المعالجة.",
        "الزوك البرازيلي رقصة جديدة للقوائم. يبدأ قالبه بـ Basic وViradinha وLateral وElástico وBonus، على إيقاع بطيء-سريع-سريع.",
        'في محرر الخطوات، تُختار الوسوم الآن مثل المتطلبات السابقة في قسمها مباشرة: وسوم الخطوة أولًا ومميزة، ثم بقية وسوم القائمة، الأكثر استخدامًا أولًا. ينتقل الوسم المختار حديثًا إلى البداية. ويكفي في البحثين كتابة بضعة أحرف بالترتيب، مثل "sgpsh" للعثور على Sugar Push.',
        "تبقى حقول النص في النماذج ومربعات الحوار واللوحات الآن فوق لوحة المفاتيح أثناء الكتابة.",
      ],
      bn: [
        "প্যাটার্ন সম্পাদকে, প্যাটার্নের নাম না দেওয়া পর্যন্ত সংরক্ষণ বোতামটি ধূসর থাকে। এতে ট্যাপ করলে সেটাই জানানো হয় এবং আপনাকে নামের ঘরে নিয়ে যাওয়া হয়।",
        "টেমপ্লেট থেকে তৈরি নতুন West Coast Swing তালিকা এখন দেখায় কোনটি কিসের উপর ভিত্তি করে (Sugar Tuck, Sugar Push-এর উপর; Tuck Turn, Left Side Pass-এর উপর), আর টার্ন, hesitation ও হাত বদল মডিফায়ার হিসেবে নিয়ে আসে। এখনও কোনো তালিকা না থাকলে, একটি উদাহরণ তালিকা খুলে মানচিত্রে সব দেখতে পারেন।",
        "ভিডিওর পরিচয় গোপন করতে নৃত্যশিল্পীদের ট্যাপ করলে, আপনার বেছে নেওয়া প্রত্যেকের রূপরেখা ফ্রেমে তাঁর সিলুয়েটের রঙে দেখানো হয়, যাতে রেন্ডার শুরুর আগে আপনি দেখে নিতে পারেন সঠিক মানুষটি বাছা হয়েছে কি না।",
        "তালিকার জন্য নতুন নাচ: ব্রাজিলিয়ান জুক। এর টেমপ্লেট Basic, Viradinha, Lateral, Elástico ও Bonus দিয়ে শুরু হয়, ধীর-দ্রুত-দ্রুত ছন্দে।",
        'প্যাটার্ন সম্পাদকে, ট্যাগ এখন পূর্বশর্তের মতো তার নিজের অংশেই বাছাই করা যায়: প্যাটার্নের নিজের ট্যাগ আগে, হাইলাইট করা, তারপর তালিকার বাকি ট্যাগ, সবচেয়ে বেশি ব্যবহৃতগুলো আগে। নতুন বাছাই করা ট্যাগ সামনে চলে আসে। দুটো খোঁজেই ক্রমানুসারে কয়েকটি অক্ষর লিখলেই হয়, যেমন Sugar Push-এর জন্য "sgpsh"।',
        "ফর্ম, ডায়ালগ ও শিটের লেখার ঘরগুলো এখন টাইপ করার সময় কিবোর্ডের ওপরে থাকে।",
      ],
      pt: [
        "No editor de passos, Salvar fica cinza até o passo ter um nome. Tocar nele avisa isso e leva você ao campo do nome.",
        "Uma nova lista de West Coast Swing criada pelo modelo agora mostra o que se baseia em quê (Sugar Tuck em Sugar Push, Tuck Turn em Left Side Pass) e traz giros, hesitation e troca de mão como modificadores. Sem listas ainda, você pode abrir uma lista de exemplo e ver tudo no Mapa.",
        "Ao tocar nos dançarinos para anonimizar um vídeo, cada pessoa escolhida aparece contornada no quadro com a cor da sua silhueta, para você conferir se é a pessoa certa antes de começar o processamento.",
        "Zouk brasileiro é uma nova dança para as listas. O modelo começa com Basic, Viradinha, Lateral, Elástico e Bonus, no ritmo lento-rápido-rápido.",
        'No editor de passos, as etiquetas são escolhidas como os pré-requisitos, na própria seção: primeiro as do passo, destacadas, depois as outras da lista, as mais usadas primeiro. A recém-escolhida vai para o início. Nas duas buscas bastam algumas letras em ordem, como "sgpsh" para Sugar Push.',
        "Os campos de texto de formulários, diálogos e painéis agora ficam acima do teclado enquanto você digita.",
      ],
      de: [
        "Im Figuren-Editor bleibt Speichern ausgegraut, bis die Figur einen Namen hat. Ein Tippen darauf sagt das und springt zum Namensfeld.",
        "Eine neue West-Coast-Swing-Liste aus der Vorlage zeigt jetzt, was worauf aufbaut (Sugar Tuck auf Sugar Push, Tuck Turn auf Left Side Pass), und bringt Drehungen, Hesitation und Handwechsel als Modifikatoren mit. Solange du noch keine Liste hast, kannst du eine Beispielliste öffnen und alles auf der Karte sehen.",
        "Wenn du zum Anonymisieren die Tanzenden antippst, wird jede gewählte Person im Bild in der Farbe ihrer Silhouette umrandet, damit du vor dem Rendern prüfen kannst, ob es die richtige ist.",
        "Brazilian Zouk ist als neuer Tanz für Listen dabei. Die Vorlage bringt Basic, Viradinha, Lateral, Elástico und Bonus mit, im Rhythmus langsam-schnell-schnell.",
        "Im Figuren-Editor werden Tags jetzt wie Voraussetzungen direkt in ihrem Abschnitt gewählt: die der Figur zuerst und hervorgehoben, dann die übrigen der Liste, die meistgenutzten vorn. Ein neu gewählter Tag rückt nach vorn. Beide Suchen brauchen nur ein paar Buchstaben in der richtigen Reihenfolge, etwa „sgpsh“ für Sugar Push.",
        "Textfelder in Formularen, Dialogen und Blättern bleiben beim Tippen jetzt über der Tastatur.",
      ],
    },
  },
  {
    version: "1.0.1",
    date: "2026-10-12",
    notes: {
      en: [
        "Videos now sit near the top of the pattern editor. Rhythm, description, prerequisites and tags fold away until you need them.",
        "Sorted by date added, patterns sit under a heading for each day.",
        "Downloading an on-device model carries on when you switch to another app.",
        "The rhythm field no longer offers whole rhythms before you start; the step-by-step suggestions stay.",
        "The side menu lists all your lists, with the open one highlighted. Tap one to open it.",
        "Switching between a pattern's variants keeps the video player in place, even for a variant without videos, and variants with videos carry a camera mark.",
        "Anonymizing is marked experimental. Before the full render you can watch the first half second, slowed down, to check that the silhouettes follow the dancers.",
        "The Tags and Videos boxes in the pattern editor are centred, with their buttons in line.",
        "A short note like this one after each update, and the full list of changes in Settings, where you can also turn the note off.",
      ],
      zh: [
        "视频现在位于舞步编辑器的顶部附近。节奏、说明、前置舞步和标签会先折叠起来，需要时再展开。",
        "按添加日期排序时，舞步按天分组，每天有一个标题。",
        "切换到其他应用时，本机模型的下载会继续进行。",
        "开始输入之前，节奏字段不再提供完整的节奏；逐步建议仍然保留。",
        "侧边菜单列出你的所有列表，当前打开的列表会高亮显示。点按一个列表即可打开。",
        "在舞步的各个变体之间切换时，视频播放器保持原位，即使变体没有视频也是如此；有视频的变体带有摄像机标记。",
        "匿名化现在标为实验性功能。在完整处理之前，你可以先慢速观看前半秒，确认剪影是否跟随舞者。",
        "舞步编辑器中的标签框和视频框现已居中，按钮与内容对齐。",
        "更新后会显示这条说明，完整的更新记录在设置中，也可以在那里关闭这条说明。",
      ],
      hi: [
        "वीडियो अब पैटर्न संपादक में ऊपर की ओर हैं। लय, विवरण, पूर्वापेक्षाएँ और टैग तब तक सिमटे रहते हैं जब तक आपको उनकी ज़रूरत न हो।",
        "जोड़ने की तारीख़ से क्रमबद्ध करने पर पैटर्न हर दिन के शीर्षक के नीचे दिखते हैं।",
        "किसी दूसरे ऐप पर जाने पर भी डिवाइस पर मॉडल की डाउनलोडिंग जारी रहती है।",
        "लय वाला फ़ील्ड अब शुरू करने से पहले पूरी लय नहीं सुझाता; चरण-दर-चरण सुझाव बने रहते हैं।",
        "साइड मेनू में अब आपकी सभी सूचियाँ दिखती हैं, खुली हुई सूची हाइलाइट रहती है। किसी सूची पर टैप करके उसे खोलें।",
        "किसी पैटर्न के संस्करणों के बीच बदलने पर वीडियो प्लेयर अपनी जगह बना रहता है, बिना वीडियो वाले संस्करण में भी; जिन संस्करणों में वीडियो हैं उन पर कैमरे का निशान होता है।",
        "गुमनाम करना अब प्रायोगिक के रूप में चिह्नित है। पूरा रेंडर करने से पहले आप पहला आधा सेकंड धीमी गति में देख सकते हैं, ताकि जाँच सकें कि सिल्हूट नर्तकों के साथ चलते हैं या नहीं।",
        "पैटर्न संपादक में टैग और वीडियो वाले बॉक्स अब बीच में हैं, और उनके बटन एक ही पंक्ति में हैं।",
        "अपडेट के बाद यह सूचना, और सेटिंग्स में बदलावों की पूरी सूची, जहाँ आप यह सूचना बंद भी कर सकते हैं।",
      ],
      es: [
        "Los vídeos están ahora cerca del principio del editor de figuras. Ritmo, descripción, requisitos previos y etiquetas se pliegan hasta que los necesites.",
        "Al ordenar por fecha de creación, las figuras aparecen bajo un encabezado por día.",
        "La descarga de un modelo en el dispositivo continúa cuando cambias a otra app.",
        "El campo de ritmo ya no ofrece ritmos completos antes de empezar; las sugerencias paso a paso se mantienen.",
        "El menú lateral muestra todas tus listas, con la abierta resaltada. Toca una para abrirla.",
        "Al cambiar entre las variantes de una figura, el reproductor de vídeo se queda en su sitio, incluso con una variante sin vídeos, y las variantes con vídeos llevan una marca de cámara.",
        "La anonimización está marcada como experimental. Antes del procesado completo puedes ver el primer medio segundo a cámara lenta para comprobar que las siluetas siguen a los bailarines.",
        "Los cuadros de Etiquetas y Vídeos del editor de figuras están centrados, con sus botones alineados.",
        "Esta nota después de una actualización y la lista completa de cambios en Ajustes, donde también puedes desactivar la nota.",
      ],
      fr: [
        "Les vidéos sont désormais en haut de l'éditeur de figure. Rythme, description, prérequis et étiquettes restent repliés jusqu'à ce que vous en ayez besoin.",
        "Triées par date d'ajout, les figures se rangent sous un titre par jour.",
        "Le téléchargement d'un modèle sur l'appareil continue quand vous passez à une autre app.",
        "Le champ rythme ne propose plus de rythmes complets avant que vous commenciez ; les suggestions pas à pas restent.",
        "Le menu latéral affiche toutes vos listes, celle qui est ouverte en surbrillance. Touchez-en une pour l'ouvrir.",
        "Quand vous passez d'une variante d'une figure à l'autre, le lecteur vidéo reste en place, même pour une variante sans vidéo, et les variantes qui ont des vidéos portent une icône de caméra.",
        "L'anonymisation est signalée comme expérimentale. Avant le rendu complet, vous pouvez regarder la première demi-seconde au ralenti pour vérifier que les silhouettes suivent les danseurs.",
        "Les cadres Étiquettes et Vidéos de l'éditeur de figure sont centrés, avec leurs boutons alignés.",
        "Cette note après une mise à jour, et la liste complète des changements dans Réglages, où vous pouvez aussi désactiver la note.",
      ],
      ar: [
        "أصبحت مقاطع الفيديو الآن قرب أعلى محرر الخطوة. ويبقى الإيقاع والوصف والمتطلبات السابقة والوسوم مطويّة حتى تحتاج إليها.",
        "عند الترتيب حسب تاريخ الإضافة، تظهر الخطوات تحت عنوان لكل يوم.",
        "يستمر تنزيل نموذج على الجهاز عند الانتقال إلى تطبيق آخر.",
        "لم يعد حقل الإيقاع يقترح إيقاعات كاملة قبل أن تبدأ؛ وتبقى الاقتراحات خطوة بخطوة.",
        "تعرض القائمة الجانبية الآن كل قوائمك، مع تمييز القائمة المفتوحة. اضغط على إحداها لفتحها.",
        "عند التبديل بين صيغ الخطوة يبقى مشغّل الفيديو في مكانه، حتى مع صيغة بلا مقاطع فيديو، وتحمل الصيغ التي لها مقاطع فيديو علامة كاميرا.",
        "أصبح إخفاء الهوية موسومًا بأنه تجريبي. قبل المعالجة الكاملة يمكنك مشاهدة أول نصف ثانية بالحركة البطيئة للتأكد من أن الظلال تتبع الراقصين.",
        "أصبح مربعا الوسوم ومقاطع الفيديو في محرر الخطوة في المنتصف، وأزرارهما على سطر واحد.",
        "هذه الملاحظة بعد كل تحديث، والقائمة الكاملة للتغييرات في الإعدادات، حيث يمكنك أيضًا إيقاف الملاحظة.",
      ],
      bn: [
        "ভিডিও এখন প্যাটার্ন সম্পাদকের উপরের দিকে থাকে। ছন্দ, বিবরণ, পূর্বশর্ত আর ট্যাগ দরকার না হওয়া পর্যন্ত গুটিয়ে থাকে।",
        "যোগ করার তারিখ অনুযায়ী সাজালে প্যাটার্নগুলো প্রতিটি দিনের শিরোনামের নিচে থাকে।",
        "অন্য অ্যাপে গেলেও ডিভাইসে থাকা মডেলের ডাউনলোড চলতে থাকে।",
        "ছন্দের ঘর এখন শুরু করার আগে পুরো ছন্দ প্রস্তাব করে না; ধাপে ধাপে প্রস্তাবগুলো থাকছে।",
        "পাশের মেনুতে এখন আপনার সব তালিকা দেখা যায়, খোলা তালিকাটি হাইলাইট করা থাকে। কোনো তালিকায় ট্যাপ করলে সেটি খুলবে।",
        "কোনো প্যাটার্নের রূপভেদগুলোর মধ্যে বদলালে ভিডিও প্লেয়ার নিজের জায়গায় থাকে, ভিডিও নেই এমন রূপভেদেও; যে রূপভেদে ভিডিও আছে তাতে ক্যামেরার চিহ্ন থাকে।",
        "পরিচয় লুকানো এখন পরীক্ষামূলক হিসেবে চিহ্নিত। পুরো রেন্ডারের আগে প্রথম আধা সেকেন্ড ধীর গতিতে দেখে নিতে পারেন, সিলুয়েটগুলো নাচিয়েদের অনুসরণ করছে কি না।",
        "প্যাটার্ন সম্পাদকে ট্যাগ আর ভিডিওর বাক্স এখন মাঝখানে, বোতামগুলো একই সারিতে।",
        "আপডেটের পরে এই বার্তা, আর সেটিংসে পরিবর্তনের পুরো তালিকা, যেখানে বার্তাটি বন্ধও করা যায়।",
      ],
      pt: [
        "Os vídeos agora ficam perto do topo do editor de passos. Ritmo, descrição, pré-requisitos e etiquetas ficam recolhidos até você precisar deles.",
        "Ao ordenar por data de inclusão, os passos aparecem sob um título para cada dia.",
        "O download de um modelo no dispositivo continua quando você muda para outro app.",
        "O campo de ritmo não oferece mais ritmos completos antes de você começar; as sugestões passo a passo continuam.",
        "O menu lateral mostra todas as suas listas, com a aberta destacada. Toque em uma para abri-la.",
        "Ao alternar entre as variações de um passo, o player de vídeo fica no lugar, mesmo numa variação sem vídeos, e as variações com vídeos levam uma marca de câmera.",
        "A anonimização está marcada como experimental. Antes da renderização completa, você pode ver o primeiro meio segundo em câmera lenta para conferir se as silhuetas acompanham os dançarinos.",
        "As caixas de Etiquetas e Vídeos no editor de passos estão centralizadas, com os botões alinhados.",
        "Esta nota depois de uma atualização e a lista completa de mudanças nas Configurações, onde você também pode desativar a nota.",
      ],
      de: [
        "Videos stehen jetzt weit oben im Figuren-Editor. Rhythmus, Beschreibung, Voraussetzungen und Tags sind eingeklappt, bis du sie brauchst.",
        "Nach Hinzufügedatum sortiert, stehen die Figuren unter einer Überschrift pro Tag.",
        "Das Herunterladen eines Modells auf das Gerät läuft weiter, wenn du zu einer anderen App wechselst.",
        "Das Rhythmusfeld bietet keine ganzen Rhythmen mehr an, bevor du anfängst; die Vorschläge Schritt für Schritt bleiben.",
        "Das Seitenmenü zeigt alle deine Listen, die geöffnete hervorgehoben. Tippe auf eine, um sie zu öffnen.",
        "Beim Wechsel zwischen den Varianten einer Figur bleibt der Videoplayer an seinem Platz, auch bei einer Variante ohne Videos, und Varianten mit Videos tragen ein Kamerasymbol.",
        "Das Anonymisieren ist als experimentell gekennzeichnet. Vor dem ganzen Durchlauf kannst du die erste halbe Sekunde verlangsamt ansehen und prüfen, ob die Silhouetten den Tanzenden folgen.",
        "Die Felder Tags und Videos im Figuren-Editor sind zentriert, mit ihren Knöpfen in einer Reihe.",
        "Ein kurzer Hinweis wie dieser nach jedem Update und die vollständige Liste der Änderungen in den Einstellungen, wo du den Hinweis auch abschalten kannst.",
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
