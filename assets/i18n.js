/* La Bonne Aventure — i18n top 10 languages + DE
   Usage:
     - Mark text with data-i18n="key" (or data-i18n-html / data-i18n-placeholder / data-i18n-aria)
     - Call LBA_I18N.mount() once; language follows the phone/browser locale automatically
*/
(function (global) {
  var LANGS = ['fr', 'en', 'zh', 'hi', 'es', 'ar', 'bn', 'pt', 'ru', 'ur', 'de'];
  var LABELS = { fr: 'FR', en: 'EN', zh: '中文', hi: 'हिंदी', es: 'ES', ar: 'عربي', bn: 'বাংলা', pt: 'PT', ru: 'RU', ur: 'اردو', de: 'DE' };
  var NAMES = { fr: 'Français', en: 'English', zh: '中文', hi: 'हिन्दी', es: 'Español', ar: 'العربية', bn: 'বাংলা', pt: 'Português', ru: 'Русский', ur: 'اردو', de: 'Deutsch' };

  var D = {
    'nav.account': {
      fr: "Mon espace",
      en: "My account",
      es: "Mi espacio",
      de: "Mein Bereich",
      zh: "我的账户",
      hi: "मेरा खाता",
      ar: "حسابي",
      bn: "আমার অ্যাকাউন্ট",
      pt: "A minha conta",
      ru: "Мой кабинет",
      ur: "میرا اکاؤنٹ"
    },
    'nav.home': {
      fr: "Accueil",
      en: "Home",
      es: "Inicio",
      de: "Start",
      zh: "首页",
      hi: "होम",
      ar: "الرئيسية",
      bn: "হোম",
      pt: "Início",
      ru: "Главная",
      ur: "ہوم"
    },
    'nav.back': {
      fr: "← Retour",
      en: "← Back",
      es: "← Volver",
      de: "← Zurück",
      zh: "← 返回",
      hi: "← वापस",
      ar: "← رجوع",
      bn: "← ফিরে যান",
      pt: "← Voltar",
      ru: "← Назад",
      ur: "← واپس"
    },
    'nav.legal': {
      fr: "Mentions légales",
      en: "Legal notice",
      es: "Aviso legal",
      de: "Impressum",
      zh: "法律声明",
      hi: "कानूनी सूचना",
      ar: "الإشعار القانوني",
      bn: "আইনি নোটিশ",
      pt: "Aviso legal",
      ru: "Юридическая информация",
      ur: "قانونی نوٹس"
    },
    'hero.kick': {
      fr: "Maison d'hôtes · Aix-les-Bains",
      en: "Guesthouse · Aix-les-Bains",
      es: "Casa de huéspedes · Aix-les-Bains",
      de: "Gästehaus · Aix-les-Bains",
      zh: "民宿 · Aix-les-Bains",
      hi: "गेस्टहाउस · Aix-les-Bains",
      ar: "بيت ضيافة · Aix-les-Bains",
      bn: "গেস্টহাউস · Aix-les-Bains",
      pt: "Casa de hóspedes · Aix-les-Bains",
      ru: "Гостевой дом · Aix-les-Bains",
      ur: "گیسٹ ہاؤس · Aix-les-Bains"
    },
    'hero.h1.a': {
      fr: "Un studio",
      en: "A studio",
      es: "Un estudio",
      de: "Ein Studio",
      zh: "一间工作室公寓",
      hi: "एक स्टूडियो",
      ar: "استوديو",
      bn: "একটি স্টুডিও",
      pt: "Um estúdio",
      ru: "Студия",
      ur: "ایک اسٹوڈیو"
    },
    'hero.h1.b': {
      fr: "au cœur d'Aix",
      en: "in the heart of Aix",
      es: "en el corazón de Aix",
      de: "im Herzen von Aix",
      zh: "位于艾克斯市中心",
      hi: "ऐक्स के हृदय में",
      ar: "في قلب إكس",
      bn: "এইক্সের হৃদয়ে",
      pt: "no coração de Aix",
      ru: "в самом сердце Экса",
      ur: "ایکس کے دل میں"
    },
    'hero.p': {
      fr: "Face au lac du Bourget, aux thermes et à la ville — un cocon ~25 m² pour se sentir chez soi.",
      en: "By Lake Bourget, the spas and the town — a ~25 m² cocoon that feels like home.",
      es: "Junto al lago del Bourget, las termas y el centro — un rincón de ~25 m² para sentirte como en casa.",
      de: "Am Lac du Bourget, den Thermen und der Stadt — ein ~25 m² Cocoon zum Ankommen.",
      zh: "毗邻 Lac du Bourget、温泉与市中心——约 25 m² 的温馨小窝，宾至如归。",
      hi: "Lac du Bourget, स्पा और शहर के पास — ~25 m² का कोकून जो घर जैसा लगे।",
      ar: "بجانب Lac du Bourget والمنتجعات الحرارية والمدينة — عشّ مريح بمساحة ~25 m² يشعر كالمنزل.",
      bn: "Lac du Bourget, স্পা ও শহরের পাশে — ~25 m²-এর আরামদায়ক কুকুন যা বাড়ির মতো লাগে।",
      pt: "Junto ao Lac du Bourget, às termas e à cidade — um casulo de ~25 m² que parece casa.",
      ru: "У Lac du Bourget, терм и города — уютный кокон ~25 m², где чувствуешь себя как дома.",
      ur: "Lac du Bourget، سپا اور شہر کے قریب — تقریباً 25 m² کا آرام دہ کوکون جو گھر جیسا لگے۔"
    },
    'hero.cta.book': {
      fr: "Voir les disponibilités",
      en: "Check availability",
      es: "Ver disponibilidad",
      de: "Verfügbarkeit prüfen",
      zh: "查看空房",
      hi: "उपलब्धता देखें",
      ar: "تحقق من التوافر",
      bn: "উপলব্ধতা দেখুন",
      pt: "Ver disponibilidade",
      ru: "Проверить наличие",
      ur: "دستیابی دیکھیں"
    },
    'hero.cta.discover': {
      fr: "Découvrir le logement",
      en: "Discover the flat",
      es: "Descubrir el alojamiento",
      de: "Die Unterkunft entdecken",
      zh: "探索公寓",
      hi: "फ्लैट जानें",
      ar: "اكتشف الشقة",
      bn: "ফ্ল্যাটটি আবিষ্কার করুন",
      pt: "Descobrir o apartamento",
      ru: "Открыть квартиру",
      ur: "فلیٹ دریافت کریں"
    },
    'sec.logement.kicker': {
      fr: "Le logement",
      en: "The flat",
      es: "El alojamiento",
      de: "Die Unterkunft",
      zh: "公寓",
      hi: "फ्लैट",
      ar: "الشقة",
      bn: "ফ্ল্যাট",
      pt: "O apartamento",
      ru: "Квартира",
      ur: "فلیٹ"
    },
    'sec.logement.h2': {
      fr: "Un studio <span class=\"it\">entièrement rénové</span>",
      en: "A <span class=\"it\">fully renovated</span> studio",
      es: "Un estudio <span class=\"it\">completamente renovado</span>",
      de: "Ein <span class=\"it\">komplett renoviertes</span> Studio",
      zh: "一间<span class=\"it\">全面翻新</span>的工作室公寓",
      hi: "एक <span class=\"it\">पूरी तरह नवीनीकृत</span> स्टूडियो",
      ar: "استوديو <span class=\"it\">مجدَّد بالكامل</span>",
      bn: "একটি <span class=\"it\">সম্পূর্ণ সংস্কারকৃত</span> স্টুডিও",
      pt: "Um estúdio <span class=\"it\">totalmente renovado</span>",
      ru: "Студия <span class=\"it\">полностью обновлённая</span>",
      ur: "ایک <span class=\"it\">مکمل طور پر تجدید شدہ</span> اسٹوڈیو"
    },
    'sec.logement.pull': {
      fr: "25 m² en plein hypercentre d'Aix-les-Bains, refait à neuf. Lit queen size, kitchenette complète, clim réversible, et un patio privé rien qu'à vous pour le café du matin. Commerces, restaurants et gare à pied — le lac du Bourget à 5 min en voiture.",
      en: "25 m² in the heart of Aix-les-Bains, fully renovated. Queen-size bed, complete kitchenette, reversible air conditioning, and a private patio just for you for morning coffee. Shops, restaurants and station on foot — Lake Bourget 5 min by car.",
      es: "25 m² en pleno centro de Aix-les-Bains, totalmente renovado. Cama queen size, cocina completa, climatización reversible y un patio privado solo para ti. Comercios, restaurantes y estación a pie — el lago Bourget a 5 min en coche.",
      de: "25 m² mitten im Zentrum von Aix-les-Bains, komplett renoviert. Queensize-Bett, vollausgestattete Küchenzeile, reversible Klimaanlage und eine private Terrasse nur für Sie. Geschäfte, Restaurants und Bahnhof zu Fuß — Lac du Bourget 5 min mit dem Auto.",
      zh: "25 m²，位于 Aix-les-Bains 市中心，全面翻新。Queen 尺寸大床、齐全厨具区、可逆空调，以及专属私密露台，适合清晨品咖啡。商店、餐厅与车站步行即达——Lac du Bourget 驾车 5 分钟。",
      hi: "Aix-les-Bains के हृदय में 25 m², पूरी तरह नवीनीकृत। Queen आकार का बिस्तर, पूर्ण किचननेट, रिवर्सिबल एयर कंडीशनिंग, और सुबह की कॉफ़ी के लिए आपका निजी पैटियो। दुकानें, रेस्तराँ और स्टेशन पैदल — Lac du Bourget कार से 5 मिनट।",
      ar: "25 m² في قلب Aix-les-Bains، مجدَّد بالكامل. سرير بحجم Queen، مطبخ صغير كامل، تكييف عكسي، وفناء خاص لقهوة الصباح. محلات ومطاعم ومحطة سيراً على الأقدام — Lac du Bourget خلال 5 دقائق بالسيارة.",
      bn: "Aix-les-Bains-এর হৃদয়ে 25 m², সম্পূর্ণ সংস্কারকৃত। Queen সাইজের বিছানা, সম্পূর্ণ কিচেনেট, রিভার্সিবল এয়ার কন্ডিশনিং, এবং সকালের কফির জন্য আপনার ব্যক্তিগত প্যাটিও। দোকান, রেস্তোরাঁ ও স্টেশন হেঁটে — Lac du Bourget গাড়িতে ৫ মিনিট।",
      pt: "25 m² no coração de Aix-les-Bains, totalmente renovado. Cama Queen, kitchenette completa, ar condicionado reversível e um pátio privado só para si para o café da manhã. Comércios, restaurantes e estação a pé — Lac du Bourget a 5 min de carro.",
      ru: "25 m² в самом сердце Aix-les-Bains, полностью обновлённая. Кровать Queen, полноценная кухня, реверсивный кондиционер и частный патио для утреннего кофе. Магазины, рестораны и вокзал пешком — Lac du Bourget 5 мин на машине.",
      ur: "Aix-les-Bains کے دل میں 25 m²، مکمل تجدید شدہ۔ Queen سائز کا بستر، مکمل کچنٹی، ریورسیبل ایئر کنڈیشنگ، اور صبح کی کافی کے لیے آپ کا نجی پیٹیو۔ دکانیں، ریسٹورنٹ اور اسٹیشن پیدل — Lac du Bourget گاڑی سے 5 منٹ۔"
    },
    'fact.m2': {
      fr: "Hypercentre, à pied de tout",
      en: "Town centre, everything on foot",
      es: "Hipercentro, todo a pie",
      de: "Zentrum, alles zu Fuß",
      zh: "市中心，步行可达一切",
      hi: "शहर केंद्र, सब पैदल",
      ar: "وسط المدينة، كل شيء سيراً",
      bn: "শহর কেন্দ্র, সবকিছু হেঁটে",
      pt: "Centro da cidade, tudo a pé",
      ru: "Центр города, всё пешком",
      ur: "شہر کا مرکز، سب کچھ پیدل"
    },
    'fact.bed': {
      fr: "Matelas neuf, stores occultants",
      en: "New mattress, blackout blinds",
      es: "Colchón nuevo, persianas opacas",
      de: "Neue Matratze, Verdunkelungsrollos",
      zh: "全新床垫，遮光窗帘",
      hi: "नया गद्दा, ब्लैकआउट ब्लाइंड्स",
      ar: "مرتبة جديدة، ستائر معتمة",
      bn: "নতুন ম্যাট্রেস, ব্ল্যাকআউট ব্লাইন্ডস",
      pt: "Colchão novo, estores blackout",
      ru: "Новый матрас, блэкаут-шторы",
      ur: "نیا گدا، بلیک آؤٹ بلائنڈز"
    },
    'fact.lake': {
      fr: "À 5 min en voiture",
      en: "5 min by car",
      es: "A 5 min en coche",
      de: "5 Min. mit dem Auto",
      zh: "驾车 5 分钟",
      hi: "कार से 5 मिनट",
      ar: "5 دقائق بالسيارة",
      bn: "গাড়িতে ৫ মিনিট",
      pt: "5 min de carro",
      ru: "5 мин на машине",
      ur: "گاڑی سے 5 منٹ"
    },
    'fact.ac': {
      fr: "Frais l’été, chaud l’hiver",
      en: "Cool in summer, warm in winter",
      es: "Frío en verano, calor en invierno",
      de: "Kühl im Sommer, warm im Winter",
      zh: "夏凉冬暖",
      hi: "गर्मी में ठंडा, सर्दी में गर्म",
      ar: "بارد صيفاً، دافئ شتاءً",
      bn: "গ্রীষ্মে ঠান্ডা, শীতে উষ্ণ",
      pt: "Fresco no verão, quente no inverno",
      ru: "Прохладно летом, тепло зимой",
      ur: "گرمی میں ٹھنڈا، سردی میں گرم"
    },
    'fact.checkin': {
      fr: "Boîte à clés 24h/24",
      en: "Lockbox, any time",
      es: "Caja de llaves, a cualquier hora",
      de: "Schlüsselbox, jederzeit",
      zh: "钥匙盒，随时入住",
      hi: "लॉकबॉक्स, कभी भी",
      ar: "صندوق مفاتيح، في أي وقت",
      bn: "লকবক্স, যেকোনো সময়",
      pt: "Caixa de chaves, a qualquer hora",
      ru: "Ключница, в любое время",
      ur: "لاک باکس، کسی بھی وقت"
    },
    'fact.extras': {
      fr: "Terrasse avec mobilier",
      en: "Terrace with furniture",
      es: "Terraza con mobiliario",
      de: "Terrasse mit Möbeln",
      zh: "带家具的露台",
      hi: "फर्नीचर वाली टेरेस",
      ar: "تراس مع أثاث",
      bn: "আসবাবসহ টেরেস",
      pt: "Terraço com mobiliário",
      ru: "Терраса с мебелью",
      ur: "فرنیچر والا ٹیرس"
    },
    'sec.amenities.h3': {
      fr: "Équipements",
      en: "Amenities",
      es: "Equipamiento",
      de: "Ausstattung",
      zh: "设施",
      hi: "सुविधाएँ",
      ar: "المرافق",
      bn: "সুবিধাসমূহ",
      pt: "Equipamentos",
      ru: "Удобства",
      ur: "سہولیات"
    },
    'amen.ac': {
      fr: "Climatisation réversible",
      en: "Reversible air conditioning",
      es: "Climatización reversible",
      de: "Reversible Klimaanlage",
      zh: "可逆空调",
      hi: "रिवर्सिबल एयर कंडीशनिंग",
      ar: "تكييف عكسي",
      bn: "রিভার্সিবল এয়ার কন্ডিশনিং",
      pt: "Ar condicionado reversível",
      ru: "Реверсивный кондиционер",
      ur: "ریورسیبل ایئر کنڈیشنگ"
    },
    'amen.wifi': {
      fr: "Wifi fibre 38 Mbps",
      en: "Fibre WiFi 38 Mbps",
      es: "WiFi fibra 38 Mbps",
      de: "Glasfaser-WLAN 38 Mbps",
      zh: "光纤 WiFi 38 Mbps",
      hi: "फ़ाइबर WiFi 38 Mbps",
      ar: "واي فاي ألياف 38 Mbps",
      bn: "ফাইবার WiFi ৩৮ Mbps",
      pt: "WiFi fibra 38 Mbps",
      ru: "Оптоволокно WiFi 38 Mbps",
      ur: "فائبر WiFi 38 Mbps"
    },
    'amen.kitchen': {
      fr: "Cuisine équipée",
      en: "Fully equipped kitchen",
      es: "Cocina equipada",
      de: "Vollausgestattete Küche",
      zh: "设备齐全的厨房",
      hi: "पूर्ण सुसज्जित रसोई",
      ar: "مطبخ مجهز بالكامل",
      bn: "সম্পূর্ণ সজ্জিত রান্নাঘর",
      pt: "Cozinha totalmente equipada",
      ru: "Полностью оборудованная кухня",
      ur: "مکمل لیس کچن"
    },
    'amen.patio': {
      fr: "Patio privé avec mobilier",
      en: "Private patio with furniture",
      es: "Patio privado con mobiliario",
      de: "Private Terrasse mit Möbeln",
      zh: "带家具的私密露台",
      hi: "फर्नीचर वाला निजी पैटियो",
      ar: "فناء خاص مع أثاث",
      bn: "আসবাবসহ ব্যক্তিগত প্যাটিও",
      pt: "Pátio privado com mobiliário",
      ru: "Частное патио с мебелью",
      ur: "فرنیچر والا نجی پیٹیو"
    },
    'amen.coffee': {
      fr: "Cafetière + café offert",
      en: "Coffee maker + complimentary coffee",
      es: "Cafetera + café de regalo",
      de: "Kaffeemaschine + Kaffee gratis",
      zh: "咖啡机 + 免费咖啡",
      hi: "कॉफ़ी मेकर + मुफ़्त कॉफ़ी",
      ar: "آلة قهوة + قهوة مجانية",
      bn: "কফি মেকার + বিনামূল্যে কফি",
      pt: "Máquina de café + café oferecido",
      ru: "Кофеварка + кофе в подарок",
      ur: "کافی میکر + مفت کافی"
    },
    'amen.fridge': {
      fr: "Réfrigérateur + congélateur",
      en: "Fridge + freezer",
      es: "Nevera + congelador",
      de: "Kühlschrank + Tiefkühlschrank",
      zh: "冰箱 + 冷冻室",
      hi: "फ्रिज + फ्रीज़र",
      ar: "ثلاجة + فريزر",
      bn: "ফ্রিজ + ফ্রিজার",
      pt: "Frigorífico + congelador",
      ru: "Холодильник + морозилка",
      ur: "فریج + فریزر"
    },
    'amen.shower': {
      fr: "Salle d'eau avec douche",
      en: "Shower room",
      es: "Cuarto de baño con ducha",
      de: "Duschbad",
      zh: "淋浴间",
      hi: "शावर रूम",
      ar: "غرفة دش",
      bn: "শাওয়ার রুম",
      pt: "Casa de banho com duche",
      ru: "Душевая",
      ur: "شاور روم"
    },
    'amen.hairdryer': {
      fr: "Sèche-cheveux",
      en: "Hair dryer",
      es: "Secador de pelo",
      de: "Haartrockner",
      zh: "吹风机",
      hi: "हेयर ड्रायर",
      ar: "مجفف شعر",
      bn: "হেয়ার ড্রায়ার",
      pt: "Secador de cabelo",
      ru: "Фен",
      ur: "ہیئر ڈرائر"
    },
    'amen.checkin': {
      fr: "Arrivée autonome (boîte à clés)",
      en: "Self check-in (lockbox)",
      es: "Entrada autónoma (caja de llaves)",
      de: "Selbst-Check-in (Schlüsselbox)",
      zh: "自助入住（钥匙盒）",
      hi: "स्वयं चेक-इन (लॉकबॉक्स)",
      ar: "تسجيل وصول ذاتي (صندوق مفاتيح)",
      bn: "স্ব-চেক-ইন (লকবক্স)",
      pt: "Check-in autónomo (caixa de chaves)",
      ru: "Самостоятельный заезд (ключница)",
      ur: "خود چیک اِن (لاک باکس)"
    },
    'amen.pets': {
      fr: "Animaux acceptés",
      en: "Pets allowed",
      es: "Se admiten mascotas",
      de: "Haustiere erlaubt",
      zh: "可携带宠物",
      hi: "पालतू जानवर अनुमत",
      ar: "الحيوانات الأليفة مسموحة",
      bn: "পোষা প্রাণী অনুমোদিত",
      pt: "Animais de estimação permitidos",
      ru: "Можно с питомцами",
      ur: "پالتو جانوروں کی اجازت"
    },
    'amen.parking': {
      fr: "Parking payant à proximité",
      en: "Paid parking nearby",
      es: "Aparcamiento de pago cercano",
      de: "Kostenpflichtiger Parkplatz in der Nähe",
      zh: "附近有收费停车",
      hi: "पास में सशुल्क पार्किंग",
      ar: "موقف مدفوع قريب",
      bn: "কাছাকাছি পেইড পার্কিং",
      pt: "Estacionamento pago nas proximidades",
      ru: "Платная парковка рядом",
      ur: "قریب ادائیگی والی پارکنگ"
    },
    'amen.smoke': {
      fr: "Détecteur de fumée",
      en: "Smoke detector",
      es: "Detector de humo",
      de: "Rauchmelder",
      zh: "烟雾探测器",
      hi: "स्मोक डिटेक्टर",
      ar: "كاشف دخان",
      bn: "স্মোক ডিটেক্টর",
      pt: "Detetor de fumo",
      ru: "Датчик дыма",
      ur: "اسموک ڈیٹیکٹر"
    },
    'gallery.studio': {
      fr: "Le studio en images",
      en: "The studio in pictures",
      es: "El estudio en imágenes",
      de: "Das Studio in Bildern",
      zh: "工作室公寓图集",
      hi: "चित्रों में स्टूडियो",
      ar: "الاستوديو بالصور",
      bn: "ছবিতে স্টুডিও",
      pt: "O estúdio em imagens",
      ru: "Студия в фотографиях",
      ur: "تصاویر میں اسٹوڈیو"
    },
    'cap.night': {
      fr: "Le coin nuit",
      en: "Sleeping area",
      es: "Zona de noche",
      de: "Schlafbereich",
      zh: "睡眠区",
      hi: "सोने का क्षेत्र",
      ar: "منطقة النوم",
      bn: "ঘুমানোর এলাকা",
      pt: "Zona de dormir",
      ru: "Спальная зона",
      ur: "سونے کا علاقہ"
    },
    'cap.live': {
      fr: "Pièce à vivre",
      en: "Living area",
      es: "Salón",
      de: "Wohnbereich",
      zh: "起居区",
      hi: "लिविंग एरिया",
      ar: "منطقة المعيشة",
      bn: "লিভিং এরিয়া",
      pt: "Zona de estar",
      ru: "Гостиная зона",
      ur: "لِونگ ایریا"
    },
    'cap.kitchen': {
      fr: "Cuisine équipée",
      en: "Equipped kitchen",
      es: "Cocina equipada",
      de: "Ausgestattete Küche",
      zh: "设备齐全的厨房",
      hi: "सुसज्जित रसोई",
      ar: "مطبخ مجهز",
      bn: "সজ্জিত রান্নাঘর",
      pt: "Cozinha equipada",
      ru: "Оборудованная кухня",
      ur: "لیس کچن"
    },
    'cap.yard': {
      fr: "La cour",
      en: "The courtyard",
      es: "El patio",
      de: "Der Hof",
      zh: "庭院",
      hi: "आँगन",
      ar: "الفناء",
      bn: "উঠোন",
      pt: "O pátio",
      ru: "Двор",
      ur: "صحن"
    },
    'cap.bath': {
      fr: "Salle d'eau",
      en: "Bathroom",
      es: "Baño",
      de: "Bad",
      zh: "浴室",
      hi: "बाथरूम",
      ar: "الحمام",
      bn: "বাথরুম",
      pt: "Casa de banho",
      ru: "Ванная",
      ur: "باتھ روم"
    },
    'why.h3': {
      fr: "Pourquoi réserver <span class=\"it\">en direct</span> ?",
      en: "Why book <span class=\"it\">direct</span>?",
      es: "¿Por qué reservar <span class=\"it\">en directo</span>?",
      de: "Warum <span class=\"it\">direkt</span> buchen?",
      zh: "为何<span class=\"it\">直接</span>预订？",
      hi: "<span class=\"it\">सीधे</span> बुक क्यों करें?",
      ar: "لماذا الحجز <span class=\"it\">مباشرة</span>؟",
      bn: "কেন <span class=\"it\">সরাসরি</span> বুক করবেন?",
      pt: "Porquê reservar <span class=\"it\">direto</span>?",
      ru: "Почему бронировать <span class=\"it\">напрямую</span>?",
      ur: "<span class=\"it\">براہِ راست</span> بک کیوں کریں؟"
    },
    'why.p': {
      fr: "En réservant ici plutôt que sur une plateforme, vous profitez d'un tarif plus doux et d'un échange direct pour adapter votre séjour.",
      en: "By booking here instead of on a platform, you get a softer rate and direct contact to tailor your stay.",
      es: "Al reservar aquí en lugar de en una plataforma, disfrutas de una tarifa más suave y un contacto directo para adaptar tu estancia.",
      de: "Wenn du hier statt über eine Plattform buchst, profitierst du von einem günstigeren Preis und direktem Kontakt für deinen Aufenthalt.",
      zh: "在此预订而非通过平台，您可享受更优惠的价格，并与房东直接沟通，定制您的住宿。",
      hi: "प्लेटफ़ॉर्म के बजाय यहाँ बुक करने पर आपको नरम दर और अपने प्रवास को अनुकूलित करने के लिए सीधा संपर्क मिलता है।",
      ar: "بالحجز هنا بدلاً من منصة، تحصل على سعر ألطف وتواصل مباشر لتخصيص إقامتك.",
      bn: "প্ল্যাটফর্মের পরিবর্তে এখানে বুক করলে আপনি নরম রেট এবং থাকার অভিজ্ঞতা সাজাতে সরাসরি যোগাযোগ পান।",
      pt: "Ao reservar aqui em vez de numa plataforma, beneficia de uma tarifa mais suave e de contacto direto para adaptar a sua estadia.",
      ru: "Бронируя здесь, а не на платформе, вы получаете более мягкий тариф и прямой контакт, чтобы подогнать пребывание под себя.",
      ur: "پلیٹ فارم کے بجائے یہاں بک کرنے پر آپ کو نرم نرخ اور اپنے قیام کو ترتیب دینے کے لیے براہِ راست رابطہ ملتا ہے۔"
    },
    'why.fees': {
      fr: "frais de plateforme",
      en: "platform fees",
      es: "comisiones de plataforma",
      de: "Plattformgebühren",
      zh: "平台费用",
      hi: "प्लेटफ़ॉर्म शुल्क",
      ar: "رسوم المنصة",
      bn: "প্ল্যাটফর্ম ফি",
      pt: "taxas de plataforma",
      ru: "комиссии платформы",
      ur: "پلیٹ فارم فیس"
    },
    'why.direct': {
      fr: "avec l'hôte",
      en: "with the host",
      es: "con el anfitrión",
      de: "mit dem Gastgeber",
      zh: "与房东",
      hi: "मेज़बान के साथ",
      ar: "مع المضيف",
      bn: "হোস্টের সাথে",
      pt: "com o anfitrião",
      ru: "с хозяином",
      ur: "میزبان کے ساتھ"
    },
    'why.flex': {
      fr: "sur mesure",
      en: "tailored",
      es: "a medida",
      de: "maßgeschneidert",
      zh: "量身定制",
      hi: "अनुकूलित",
      ar: "مخصّص",
      bn: "মাপসই",
      pt: "à medida",
      ru: "индивидуально",
      ur: "حسبِ ضرورت"
    },
    'why.direct.label': {
      fr: "Direct",
      en: "Direct",
      es: "Directo",
      de: "Direkt",
      zh: "直接",
      hi: "सीधा",
      ar: "مباشر",
      bn: "সরাসরি",
      pt: "Direto",
      ru: "Напрямую",
      ur: "براہِ راست"
    },
    'why.flex.label': {
      fr: "Flexible",
      en: "Flexible",
      es: "Flexible",
      de: "Flexibel",
      zh: "灵活",
      hi: "लचीला",
      ar: "مرن",
      bn: "নমনীয়",
      pt: "Flexível",
      ru: "Гибко",
      ur: "لچکدار"
    },
    'sec.aix.kicker': {
      fr: "Aux alentours",
      en: "Nearby",
      es: "Alrededores",
      de: "In der Nähe",
      zh: "周边",
      hi: "आस-पास",
      ar: "بالقرب",
      bn: "কাছাকাছি",
      pt: "Nas proximidades",
      ru: "Рядом",
      ur: "قریب"
    },
    'sec.aix.h2': {
      fr: "Aix-les-Bains, <span class=\"it\">à vivre</span>",
      en: "Aix-les-Bains, <span class=\"it\">to experience</span>",
      es: "Aix-les-Bains, <span class=\"it\">para vivir</span>",
      de: "Aix-les-Bains, <span class=\"it\">erleben</span>",
      zh: "Aix-les-Bains，<span class=\"it\">值得体验</span>",
      hi: "Aix-les-Bains, <span class=\"it\">अनुभव करने योग्य</span>",
      ar: "Aix-les-Bains، <span class=\"it\">لتُعاش</span>",
      bn: "Aix-les-Bains, <span class=\"it\">অনুভব করার মতো</span>",
      pt: "Aix-les-Bains, <span class=\"it\">para viver</span>",
      ru: "Aix-les-Bains, <span class=\"it\">чтобы прожить</span>",
      ur: "Aix-les-Bains، <span class=\"it\">تجربہ کرنے کے لیے</span>"
    },
    'sec.aix.lede': {
      fr: "Lac du Bourget, abbaye d’Hautecombe, thermes et montagnes — le meilleur d’Aix à portée de main.",
      en: "Lake Bourget, Hautecombe Abbey, spas and mountains — the best of Aix within easy reach.",
      es: "Lago del Bourget, abadía de Hautecombe, termas y montañas: lo mejor de Aix al alcance.",
      de: "Lac du Bourget, Abtei Hautecombe, Thermen und Berge — das Beste von Aix in Reichweite.",
      zh: "Lac du Bourget、Hautecombe 修道院、温泉与群山——艾克斯精华近在咫尺。",
      hi: "Lac du Bourget, Hautecombe ऐबी, स्पा और पहाड़ — ऐक्स का सर्वश्रेष्ठ आसानी से पहुँच में।",
      ar: "Lac du Bourget ودير Hautecombe والمنتجعات الحرارية والجبال — أفضل ما في إكس في متناول اليد.",
      bn: "Lac du Bourget, Hautecombe অ্যাবি, স্পা ও পাহাড় — এইক্সের সেরা সহজেই পৌঁছানোর মধ্যে।",
      pt: "Lac du Bourget, abadia de Hautecombe, termas e montanhas — o melhor de Aix ao alcance.",
      ru: "Lac du Bourget, аббатство Hautecombe, термы и горы — лучшее Экса рядом.",
      ur: "Lac du Bourget، Hautecombe ایبی، سپا اور پہاڑ — ایکس کا بہترین قریب۔"
    },
    'cap.jardins': {
      fr: "Jardins fleuris",
      en: "Flower gardens",
      es: "Jardines en flor",
      de: "Blumenparks",
      zh: "花团锦簇的花园",
      hi: "फूलों के बगीचे",
      ar: "حدائق مزهرة",
      bn: "ফুলের বাগান",
      pt: "Jardins floridos",
      ru: "Цветущие сады",
      ur: "پھولوں کے باغات"
    },
    'cap.hautecombe': {
      fr: "Abbaye d’Hautecombe",
      en: "Hautecombe Abbey",
      es: "Abadía de Hautecombe",
      de: "Abtei Hautecombe",
      zh: "Hautecombe 修道院",
      hi: "Hautecombe ऐबी",
      ar: "دير Hautecombe",
      bn: "Hautecombe অ্যাবি",
      pt: "Abadia de Hautecombe",
      ru: "Аббатство Hautecombe",
      ur: "Hautecombe ایبی"
    },
    'cap.casino': {
      fr: "Casino Grand Cercle",
      en: "Grand Cercle Casino",
      es: "Casino Grand Cercle",
      de: "Casino Grand Cercle",
      zh: "Casino Grand Cercle",
      hi: "Casino Grand Cercle",
      ar: "Casino Grand Cercle",
      bn: "Casino Grand Cercle",
      pt: "Casino Grand Cercle",
      ru: "Casino Grand Cercle",
      ur: "Casino Grand Cercle"
    },
    'cap.mountains': {
      fr: "Les montagnes en hiver",
      en: "The mountains in winter",
      es: "Las montañas en invierno",
      de: "Die Berge im Winter",
      zh: "冬日群山",
      hi: "सर्दियों में पहाड़",
      ar: "الجبال في الشتاء",
      bn: "শীতে পাহাড়",
      pt: "As montanhas no inverno",
      ru: "Горы зимой",
      ur: "سردیوں میں پہاڑ"
    },
    'sec.avis.kicker': {
      fr: "Avis des voyageurs",
      en: "Guest reviews",
      es: "Opiniones de viajeros",
      de: "Gästebewertungen",
      zh: "住客评价",
      hi: "अतिथि समीक्षाएँ",
      ar: "آراء الضيوف",
      bn: "অতিথি রিভিউ",
      pt: "Avaliações dos hóspedes",
      ru: "Отзывы гостей",
      ur: "مہمانوں کے جائزے"
    },
    'sec.avis.h2': {
      fr: "Ils ont <span class=\"it\">adoré</span>",
      en: "They <span class=\"it\">loved</span> it",
      es: "Les ha <span class=\"it\">encantado</span>",
      de: "Sie haben es <span class=\"it\">geliebt</span>",
      zh: "他们<span class=\"it\">爱上了</span>这里",
      hi: "उन्होंने इसे <span class=\"it\">पसंद</span> किया",
      ar: "لقد <span class=\"it\">أحبّوه</span>",
      bn: "তারা এটিকে <span class=\"it\">ভালোবেসেছে</span>",
      pt: "Eles <span class=\"it\">adoraram</span>",
      ru: "Им это <span class=\"it\">понравилось</span>",
      ur: "انہوں نے اسے <span class=\"it\">پسند</span> کیا"
    },
    'sec.avis.summary': {
      fr: "5 avis vérifiés",
      en: "5 verified reviews",
      es: "5 reseñas verificadas",
      de: "5 verifizierte Bewertungen",
      zh: "5 条已验证评价",
      hi: "5 सत्यापित समीक्षाएँ",
      ar: "5 آراء موثّقة",
      bn: "৫টি যাচাইকৃত রিভিউ",
      pt: "5 avaliações verificadas",
      ru: "5 проверенных отзывов",
      ur: "5 تصدیق شدہ جائزے"
    },
    'sec.avis.google': {
      fr: "Laisser un avis Google",
      en: "Leave a Google review",
      es: "Dejar una reseña en Google",
      de: "Google-Bewertung hinterlassen",
      zh: "留下 Google 评价",
      hi: "Google समीक्षा दें",
      ar: "اترك تقييماً على Google",
      bn: "Google রিভিউ দিন",
      pt: "Deixar uma avaliação no Google",
      ru: "Оставить отзыв в Google",
      ur: "Google جائزہ دیں"
    },
    'sec.avis.prev': {
      fr: "Avis précédent",
      en: "Previous review",
      es: "Reseña anterior",
      de: "Vorherige Bewertung",
      zh: "上一条评价",
      hi: "पिछली समीक्षा",
      ar: "الرأي السابق",
      bn: "পূর্ববর্তী রিভিউ",
      pt: "Avaliação anterior",
      ru: "Предыдущий отзыв",
      ur: "پچھلا جائزہ"
    },
    'sec.avis.next': {
      fr: "Avis suivant",
      en: "Next review",
      es: "Reseña siguiente",
      de: "Nächste Bewertung",
      zh: "下一条评价",
      hi: "अगली समीक्षा",
      ar: "الرأي التالي",
      bn: "পরবর্তী রিভিউ",
      pt: "Avaliação seguinte",
      ru: "Следующий отзыв",
      ur: "اگلا جائزہ"
    },
    'sec.avis.carousel': {
      fr: "Avis des voyageurs",
      en: "Guest reviews",
      es: "Opiniones de viajeros",
      de: "Gästebewertungen",
      zh: "住客评价",
      hi: "अतिथि समीक्षाएँ",
      ar: "آراء الضيوف",
      bn: "অতিথি রিভিউ",
      pt: "Avaliações dos hóspedes",
      ru: "Отзывы гостей",
      ur: "مہمانوں کے جائزے"
    },
    'sec.book.kicker': {
      fr: "Disponibilités & réservation",
      en: "Availability & booking",
      es: "Disponibilidad y reserva",
      de: "Verfügbarkeit & Buchung",
      zh: "空房与预订",
      hi: "उपलब्धता और बुकिंग",
      ar: "التوافر والحجز",
      bn: "উপলব্ধতা ও বুকিং",
      pt: "Disponibilidade e reserva",
      ru: "Наличие и бронирование",
      ur: "دستیابی اور بکنگ"
    },
    'sec.book.h2': {
      fr: "Choisissez vos <span class=\"it\">dates</span>",
      en: "Choose your <span class=\"it\">dates</span>",
      es: "Elige tus <span class=\"it\">fechas</span>",
      de: "Wähle deine <span class=\"it\">Daten</span>",
      zh: "选择您的<span class=\"it\">日期</span>",
      hi: "अपनी <span class=\"it\">तिथियाँ</span> चुनें",
      ar: "اختر <span class=\"it\">تواريخك</span>",
      bn: "আপনার <span class=\"it\">তারিখ</span> বেছে নিন",
      pt: "Escolha as suas <span class=\"it\">datas</span>",
      ru: "Выберите свои <span class=\"it\">даты</span>",
      ur: "اپنی <span class=\"it\">تاریخیں</span> منتخب کریں"
    },
    'sec.book.lede': {
      fr: "Réservation en direct, sans frais de plateforme — confirmation immédiate.",
      en: "Book direct, no platform fees — instant confirmation.",
      es: "Reserva directa, sin comisiones de plataforma — confirmación inmediata.",
      de: "Direktbuchung, ohne Plattformgebühren — sofortige Bestätigung.",
      zh: "直接预订，无平台费用——即时确认。",
      hi: "सीधी बुकिंग, कोई प्लेटफ़ॉर्म शुल्क नहीं — तत्काल पुष्टि।",
      ar: "احجز مباشرة، بدون رسوم منصة — تأكيد فوري.",
      bn: "সরাসরি বুক করুন, কোনো প্ল্যাটফর্ম ফি নেই — তাৎক্ষণিক নিশ্চিতকরণ।",
      pt: "Reserve direto, sem taxas de plataforma — confirmação imediata.",
      ru: "Бронируйте напрямую, без комиссий платформы — мгновенное подтверждение.",
      ur: "براہِ راست بک کریں، کوئی پلیٹ فارم فیس نہیں — فوری تصدیق۔"
    },
    'sec.book.fallback': {
      fr: "Chargement du calendrier de réservation…<br><small>Si rien ne s'affiche, vérifiez votre connexion ou réessayez.</small>",
      en: "Loading the booking calendar…<br><small>If nothing appears, check your connection or try again.</small>",
      es: "Cargando el calendario de reservas…<br><small>Si no aparece nada, comprueba tu conexión o inténtalo de nuevo.</small>",
      de: "Buchungskalender wird geladen…<br><small>Wenn nichts erscheint, prüfe deine Verbindung oder versuche es erneut.</small>",
      zh: "正在加载预订日历…<br><small>若无显示，请检查网络连接或重试。</small>",
      hi: "बुकिंग कैलेंडर लोड हो रहा है…<br><small>यदि कुछ न दिखे, कनेक्शन जाँचें या पुनः प्रयास करें।</small>",
      ar: "جاري تحميل تقويم الحجز…<br><small>إن لم يظهر شيء، تحقق من الاتصال أو أعد المحاولة.</small>",
      bn: "বুকিং ক্যালেন্ডার লোড হচ্ছে…<br><small>কিছু না দেখালে সংযোগ পরীক্ষা করুন বা আবার চেষ্টা করুন।</small>",
      pt: "A carregar o calendário de reservas…<br><small>Se nada aparecer, verifique a ligação ou tente novamente.</small>",
      ru: "Загрузка календаря бронирования…<br><small>Если ничего не появляется, проверьте соединение или попробуйте снова.</small>",
      ur: "بکنگ کیلنڈر لوڈ ہو رہا ہے…<br><small>اگر کچھ نظر نہ آئے تو کنکشن چیک کریں یا دوبارہ کوشش کریں۔</small>"
    },
    'sec.book.fine': {
      fr: "Paiement sécurisé par Stripe · confirmation immédiate · taxe de séjour en supplément.",
      en: "Secure payment via Stripe · instant confirmation · tourist tax extra.",
      es: "Pago seguro con Stripe · confirmación inmediata · tasa turística aparte.",
      de: "Sichere Zahlung über Stripe · sofortige Bestätigung · Kurtaxe extra.",
      zh: "通过 Stripe 安全支付 · 即时确认 · 旅游税另计。",
      hi: "Stripe के माध्यम से सुरक्षित भुगतान · तत्काल पुष्टि · पर्यटक कर अतिरिक्त।",
      ar: "دفع آمن عبر Stripe · تأكيد فوري · ضريبة سياحية إضافية.",
      bn: "Stripe দিয়ে নিরাপদ পেমেন্ট · তাৎক্ষণিক নিশ্চিতকরণ · পর্যটক কর অতিরিক্ত।",
      pt: "Pagamento seguro via Stripe · confirmação imediata · taxa turística extra.",
      ru: "Безопасная оплата через Stripe · мгновенное подтверждение · туристический налог отдельно.",
      ur: "Stripe کے ذریعے محفوظ ادائیگی · فوری تصدیق · سیاحتی ٹیکس الگ۔"
    },
    'sec.book.airbnb': {
      fr: "Vous préférez passer par Airbnb&nbsp;? <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">Voir l’annonce</a>",
      en: "Prefer Airbnb&nbsp;? <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">View the listing</a>",
      es: "¿Prefieres Airbnb&nbsp;? <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">Ver el anuncio</a>",
      de: "Lieber über Airbnb&nbsp;? <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">Zur Anzeige</a>",
      zh: "更喜欢 Airbnb&nbsp;？ <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">查看房源</a>",
      hi: "Airbnb&nbsp;? पसंद है <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">लिस्टिंग देखें</a>",
      ar: "تفضل Airbnb&nbsp;؟ <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">عرض الإعلان</a>",
      bn: "Airbnb&nbsp;? পছন্দ <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">লিস্টিং দেখুন</a>",
      pt: "Prefere Airbnb&nbsp;? <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">Ver o anúncio</a>",
      ru: "Предпочитаете Airbnb&nbsp;? <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">Смотреть объявление</a>",
      ur: "Airbnb&nbsp;؟ پسند ہے <a href=\"https://www.airbnb.fr/h/labonneaventure\" target=\"_blank\" rel=\"noopener\">فہرست دیکھیں</a>"
    },
    'sec.book.whatsapp': {
      fr: "Une question ? Écrivez-moi sur WhatsApp",
      en: "A question? Message me on WhatsApp",
      es: "¿Una pregunta? Escríbeme por WhatsApp",
      de: "Eine Frage? Schreib mir auf WhatsApp",
      zh: "有问题？通过 WhatsApp 联系我",
      hi: "कोई प्रश्न? WhatsApp पर संदेश भेजें",
      ar: "سؤال؟ راسلني على WhatsApp",
      bn: "প্রশ্ন আছে? WhatsApp-এ মেসেজ করুন",
      pt: "Uma pergunta? Envie-me mensagem no WhatsApp",
      ru: "Вопрос? Напишите мне в WhatsApp",
      ur: "سوال؟ WhatsApp پر پیغام بھیجیں"
    },
    'footer.credit': {
      fr: "La Bonne Aventure · Aix-les-Bains ·",
      en: "La Bonne Aventure · Aix-les-Bains ·",
      es: "La Bonne Aventure · Aix-les-Bains ·",
      de: "La Bonne Aventure · Aix-les-Bains ·",
      zh: "La Bonne Aventure · Aix-les-Bains ·",
      hi: "La Bonne Aventure · Aix-les-Bains ·",
      ar: "La Bonne Aventure · Aix-les-Bains ·",
      bn: "La Bonne Aventure · Aix-les-Bains ·",
      pt: "La Bonne Aventure · Aix-les-Bains ·",
      ru: "La Bonne Aventure · Aix-les-Bains ·",
      ur: "La Bonne Aventure · Aix-les-Bains ·"
    },
    'extras.kicker': {
      fr: "Petits plus",
      en: "Little extras",
      es: "Pequeños extras",
      de: "Kleine Extras",
      zh: "小额加项",
      hi: "छोटे अतिरिक्त",
      ar: "إضافات صغيرة",
      bn: "ছোটো অতিরিক্ত",
      pt: "Pequenos extras",
      ru: "Маленькие дополнения",
      ur: "چھوٹی اضافی چیزیں"
    },
    'extras.h2': {
      fr: "Vos <span class=\"it\">extras</span>",
      en: "Your <span class=\"it\">extras</span>",
      es: "Tus <span class=\"it\">extras</span>",
      de: "Deine <span class=\"it\">Extras</span>",
      zh: "您的<span class=\"it\">加项服务</span>",
      hi: "आपके <span class=\"it\">एक्स्ट्रा</span>",
      ar: "الـ<span class=\"it\">إضافات</span> الخاصة بك",
      bn: "আপনার <span class=\"it\">এক্সট্রা</span>",
      pt: "Os seus <span class=\"it\">extras</span>",
      ru: "Ваши <span class=\"it\">дополнения</span>",
      ur: "آپ کے <span class=\"it\">ایکسٹراز</span>"
    },
    'extras.lede': {
      fr: "Prolongez le plaisir : réservez et payez vos options en ligne, en quelques secondes.",
      en: "Extend the pleasure: book and pay for your options online in seconds.",
      es: "Prolonga el placer: reserva y paga tus opciones en línea en unos segundos.",
      de: "Verlängere den Genuss: buche und bezahle deine Optionen online in Sekunden.",
      zh: "延长愉悦：在线预订并支付您的选项，几秒即可完成。",
      hi: "आनंद बढ़ाएँ: सेकंडों में ऑनलाइन विकल्प बुक और भुगतान करें।",
      ar: "مدّد المتعة: احجز وادفع خياراتك عبر الإنترنت في ثوانٍ.",
      bn: "আনন্দ বাড়ান: সেকেন্ডে অনলাইনে অপশন বুক ও পেমেন্ট করুন।",
      pt: "Prolongue o prazer: reserve e pague as suas opções online em segundos.",
      ru: "Продлите удовольствие: бронируйте и оплачивайте опции онлайн за секунды.",
      ur: "خوشی بڑھائیں: سیکنڈوں میں آن لائن آپشنز بک اور ادائیگی کریں۔"
    },
    'extras.loading': {
      fr: "Chargement des extras…",
      en: "Loading extras…",
      es: "Cargando extras…",
      de: "Extras werden geladen…",
      zh: "正在加载加项…",
      hi: "एक्स्ट्रा लोड हो रहे हैं…",
      ar: "جاري تحميل الإضافات…",
      bn: "এক্সট্রা লোড হচ্ছে…",
      pt: "A carregar extras…",
      ru: "Загрузка дополнений…",
      ur: "ایکسٹراز لوڈ ہو رہے ہیں…"
    },
    'extras.how': {
      fr: "<b>Comment ça marche ?</b> Choisissez votre extra et réglez en ligne — paiement sécurisé par Stripe. Votre confirmation vous est envoyée par email dans la foulée. La disponibilité des arrivées anticipées et départs tardifs est vérifiée <b>automatiquement</b> selon la date.",
      en: "<b>How does it work?</b> Choose your extra and pay online — secure Stripe payment. Confirmation is emailed right away. Early check-in and late check-out availability is checked <b>automatically</b> for your date.",
      es: "<b>¿Cómo funciona?</b> Elige tu extra y paga en línea — pago seguro con Stripe. La confirmación se envía por email de inmediato. La disponibilidad de llegadas anticipadas y salidas tardías se verifica <b>automáticamente</b> según la fecha.",
      de: "<b>Wie funktioniert’s?</b> Wähle dein Extra und zahle online — sichere Stripe-Zahlung. Die Bestätigung kommt sofort per E-Mail. Die Verfügbarkeit von frühem Check-in und spätem Check-out wird <b>automatisch</b> für dein Datum geprüft.",
      zh: "<b>如何运作？</b>选择您的加项并在线支付——Stripe 安全付款。确认邮件将立即发送。提前入住与延迟退房的可用性会按您的日期<b>自动</b>核验。",
      hi: "<b>यह कैसे काम करता है?</b> अपना एक्स्ट्रा चुनें और ऑनलाइन भुगतान करें — सुरक्षित Stripe भुगतान। पुष्टि तुरंत ईमेल होती है। अर्ली चेक-इन और लेट चेक-आउट उपलब्धता आपकी तिथि के लिए <b>स्वचालित रूप से</b> जाँची जाती है।",
      ar: "<b>كيف يعمل؟</b> اختر إضافتك وادفع عبر الإنترنت — دفع آمن عبر Stripe. يُرسل التأكيد فوراً بالبريد. تُتحقق من توافر الوصول المبكر والمغادرة المتأخرة <b>تلقائياً</b> لتاريخك.",
      bn: "<b>এটি কীভাবে কাজ করে?</b> আপনার এক্সট্রা বেছে নিন এবং অনলাইনে পেমেন্ট করুন — নিরাপদ Stripe পেমেন্ট। নিশ্চিতকরণ সাথে সাথে ইমেইল হয়। আর্লি চেক-ইন ও লেট চেক-আউট উপলব্ধতা আপনার তারিখের জন্য <b>স্বয়ংক্রিয়ভাবে</b> যাচাই হয়।",
      pt: "<b>Como funciona?</b> Escolha o seu extra e pague online — pagamento seguro Stripe. A confirmação é enviada de imediato por email. A disponibilidade de check-in antecipado e check-out tardio é verificada <b>automaticamente</b> para a sua data.",
      ru: "<b>Как это работает?</b> Выберите дополнение и оплатите онлайн — безопасная оплата Stripe. Подтверждение сразу приходит на email. Доступность раннего заезда и позднего выезда проверяется <b>автоматически</b> по вашей дате.",
      ur: "<b>یہ کیسے کام کرتا ہے؟</b> اپنا ایکسٹرا منتخب کریں اور آن لائن ادائیگی کریں — محفوظ Stripe ادائیگی۔ تصدیق فوراً ای میل ہوتی ہے۔ ارلی چیک اِن اور لیٹ چیک آؤٹ دستیابی آپ کی تاریخ کے لیے <b>خودکار طور پر</b> چیک ہوتی ہے۔"
    },
    'acct.kicker': {
      fr: "Espace voyageur",
      en: "Guest area",
      es: "Espacio viajero",
      de: "Gästebereich",
      zh: "住客专区",
      hi: "अतिथि क्षेत्र",
      ar: "مساحة الضيف",
      bn: "অতিথি এলাকা",
      pt: "Área do hóspede",
      ru: "Зона гостя",
      ur: "مہمان کا علاقہ"
    },
    'acct.h2': {
      fr: "Vos réservations & <span class=\"it\">votre fidélité</span>",
      en: "Your bookings & <span class=\"it\">loyalty</span>",
      es: "Tus reservas y <span class=\"it\">fidelidad</span>",
      de: "Deine Buchungen & <span class=\"it\">Treue</span>",
      zh: "您的预订与<span class=\"it\">忠诚计划</span>",
      hi: "आपकी बुकिंग और <span class=\"it\">लॉयल्टी</span>",
      ar: "حجوزاتك و<span class=\"it\">الولاء</span>",
      bn: "আপনার বুকিং ও <span class=\"it\">লয়্যালটি</span>",
      pt: "As suas reservas e <span class=\"it\">fidelidade</span>",
      ru: "Ваши бронирования и <span class=\"it\">лояльность</span>",
      ur: "آپ کی بکنگز اور <span class=\"it\">وفاداری</span>"
    },
    'acct.lede': {
      fr: "Retrouvez vos séjours et vos points fidélité avec l'email utilisé à la réservation.",
      en: "Find your stays and loyalty points with the email used at booking.",
      es: "Consulta tus estancias y puntos de fidelidad con el email usado al reservar.",
      de: "Finde deine Aufenthalte und Treuepunkte mit der E-Mail aus der Buchung.",
      zh: "使用预订时的邮箱，查找您的住宿与忠诚积分。",
      hi: "बुकिंग पर उपयोग किए ईमेल से अपने प्रवास और लॉयल्टी पॉइंट खोजें।",
      ar: "اعثر على إقاماتك ونقاط الولاء بالبريد المستخدم عند الحجز.",
      bn: "বুকিংয়ে ব্যবহৃত ইমেইল দিয়ে আপনার থাকার অভিজ্ঞতা ও লয়্যালটি পয়েন্ট খুঁজুন।",
      pt: "Encontre as suas estadias e pontos de fidelidade com o email usado na reserva.",
      ru: "Найдите свои пребывания и баллы лояльности по email, указанному при бронировании.",
      ur: "بکنگ پر استعمال شدہ ای میل سے اپنے قیام اور وفاداری پوائنٹس تلاش کریں۔"
    },
    'acct.email': {
      fr: "Votre email",
      en: "Your email",
      es: "Tu email",
      de: "Deine E-Mail",
      zh: "您的邮箱",
      hi: "आपका ईमेल",
      ar: "بريدك الإلكتروني",
      bn: "আপনার ইমেইল",
      pt: "O seu email",
      ru: "Ваш email",
      ur: "آپ کا ای میل"
    },
    'acct.login': {
      fr: "Recevoir mon lien de connexion",
      en: "Send me a login link",
      es: "Recibir mi enlace de acceso",
      de: "Login-Link senden",
      zh: "发送登录链接",
      hi: "मुझे लॉगिन लिंक भेजें",
      ar: "أرسل لي رابط تسجيل الدخول",
      bn: "আমাকে লগইন লিংক পাঠান",
      pt: "Enviar-me um link de acesso",
      ru: "Прислать ссылку для входа",
      ur: "مجھے لاگ اِن لنک بھیجیں"
    },
    'acct.hint': {
      fr: "Aucun mot de passe : vous recevrez un lien de connexion à usage unique par email, valable 15 minutes.",
      en: "No password: you’ll get a one-time login link by email, valid for 15 minutes.",
      es: "Sin contraseña: recibirás un enlace de acceso de un solo uso por email, válido 15 minutos.",
      de: "Kein Passwort: du erhältst einen einmaligen Login-Link per E-Mail, 15 Minuten gültig.",
      zh: "无需密码：您将收到一次性登录链接邮件，有效期 15 分钟。",
      hi: "कोई पासवर्ड नहीं: आपको ईमेल पर एक बार उपयोग वाला लॉगिन लिंक मिलेगा, 15 मिनट वैध।",
      ar: "بدون كلمة مرور: ستحصل على رابط دخول لمرة واحدة بالبريد، صالح 15 دقيقة.",
      bn: "কোনো পাসওয়ার্ড নেই: আপনি ইমেইলে একবার-ব্যবহারযোগ্য লগইন লিংক পাবেন, ১৫ মিনিট বৈধ।",
      pt: "Sem palavra-passe: receberá um link de acesso de utilização única por email, válido durante 15 minutos.",
      ru: "Без пароля: вы получите одноразовую ссылку для входа по email, действительную 15 минут.",
      ur: "کوئی پاس ورڈ نہیں: آپ کو ای میل پر ایک بار استعمال ہونے والا لاگ اِن لنک ملے گا، 15 منٹ تک درست۔"
    },
    'acct.hello': {
      fr: "Bonjour,",
      en: "Hello,",
      es: "Hola,",
      de: "Hallo,",
      zh: "您好，",
      hi: "नमस्ते,",
      ar: "مرحباً،",
      bn: "হ্যালো,",
      pt: "Olá,",
      ru: "Здравствуйте,",
      ur: "ہیلو،"
    },
    'acct.logout': {
      fr: "Se déconnecter",
      en: "Log out",
      es: "Cerrar sesión",
      de: "Abmelden",
      zh: "退出登录",
      hi: "लॉग आउट",
      ar: "تسجيل الخروج",
      bn: "লগ আউট",
      pt: "Terminar sessão",
      ru: "Выйти",
      ur: "لاگ آؤٹ"
    },
    'acct.loyalty': {
      fr: "Programme fidélité",
      en: "Loyalty programme",
      es: "Programa de fidelidad",
      de: "Treueprogramm",
      zh: "忠诚计划",
      hi: "लॉयल्टी कार्यक्रम",
      ar: "برنامج الولاء",
      bn: "লয়্যালটি প্রোগ্রাম",
      pt: "Programa de fidelidade",
      ru: "Программа лояльности",
      ur: "وفاداری پروگرام"
    },
    'acct.points': {
      fr: "points",
      en: "points",
      es: "puntos",
      de: "Punkte",
      zh: "积分",
      hi: "पॉइंट",
      ar: "نقاط",
      bn: "পয়েন্ট",
      pt: "pontos",
      ru: "баллов",
      ur: "پوائنٹس"
    },
    'acct.stays': {
      fr: "Vos séjours",
      en: "Your stays",
      es: "Tus estancias",
      de: "Deine Aufenthalte",
      zh: "您的住宿",
      hi: "आपके प्रवास",
      ar: "إقاماتك",
      bn: "আপনার থাকার অভিজ্ঞতা",
      pt: "As suas estadias",
      ru: "Ваши пребывания",
      ur: "آپ کے قیام"
    },
    'acct.pending.title': {
      fr: "Séjour en attente",
      en: "Pending stay",
      es: "Estancia pendiente",
      de: "Ausstehender Aufenthalt",
      zh: "待确认住宿",
      hi: "लंबित प्रवास",
      ar: "إقامة معلّقة",
      bn: "মুলতুবি থাকার অভিজ্ঞতা",
      pt: "Estadia pendente",
      ru: "Ожидающее пребывание",
      ur: "زیر التواء قیام"
    },
    'acct.pending.body': {
      fr: "Les dates sont bloquées 3 h pour les autres. Après, elles se libèrent — finalisez le paiement pour confirmer.",
      en: "Dates are held for 3 h for others. Then they free up — finish payment to confirm.",
      es: "Las fechas se bloquean 3 h para los demás. Luego se liberan: finaliza el pago para confirmar.",
      de: "Die Daten sind 3 Std. für andere blockiert. Danach werden sie frei — schließe die Zahlung ab, um zu bestätigen.",
      zh: "日期已为他人保留 3 小时。之后将释放——完成付款以确认。",
      hi: "तिथियाँ दूसरों के लिए 3 घंटे रोकी जाती हैं। फिर मुक्त हो जाती हैं — पुष्टि के लिए भुगतान पूरा करें।",
      ar: "التواريخ محجوزة 3 ساعات عن الآخرين. ثم تُحرَّر — أكمل الدفع للتأكيد.",
      bn: "তারিখ অন্যদের জন্য 3 ঘণ্টা ধরে রাখা হয়। তারপর মুক্ত হয় — নিশ্চিত করতে পেমেন্ট শেষ করুন।",
      pt: "As datas ficam bloqueadas 3 h para outros. Depois libertam-se — conclua o pagamento para confirmar.",
      ru: "Даты заблокированы на 3 ч для других. Затем освобождаются — завершите оплату для подтверждения.",
      ur: "تاریخیں دوسروں کے لیے 3 گھنٹے روک دی جاتی ہیں۔ پھر خالی ہو جاتی ہیں — تصدیق کے لیے ادائیگی مکمل کریں۔"
    },
    'acct.empty': {
      fr: "Aucune réservation trouvée pour cet email.",
      en: "No booking found for this email.",
      es: "No se encontró ninguna reserva para este email.",
      de: "Keine Buchung für diese E-Mail gefunden.",
      zh: "未找到此邮箱的预订。",
      hi: "इस ईमेल के लिए कोई बुकिंग नहीं मिली।",
      ar: "لم يُعثر على حجز لهذا البريد.",
      bn: "এই ইমেইলের জন্য কোনো বুকিং পাওয়া যায়নি।",
      pt: "Nenhuma reserva encontrada para este email.",
      ru: "Бронирование для этого email не найдено.",
      ur: "اس ای میل کے لیے کوئی بکنگ نہیں ملی۔"
    },
    'acct.cta': {
      fr: "Réserver un séjour",
      en: "Book a stay",
      es: "Reservar una estancia",
      de: "Aufenthalt buchen",
      zh: "预订住宿",
      hi: "प्रवास बुक करें",
      ar: "احجز إقامة",
      bn: "থাকার অভিজ্ঞতা বুক করুন",
      pt: "Reservar uma estadia",
      ru: "Забронировать пребывание",
      ur: "قیام بک کریں"
    },
    'bw.loading': {
      fr: "Chargement du calendrier…",
      en: "Loading calendar…",
      es: "Cargando calendario…",
      de: "Kalender wird geladen…",
      zh: "正在加载日历…",
      hi: "कैलेंडर लोड हो रहा है…",
      ar: "جاري تحميل التقويم…",
      bn: "ক্যালেন্ডার লোড হচ্ছে…",
      pt: "A carregar o calendário…",
      ru: "Загрузка календаря…",
      ur: "کیلنڈر لوڈ ہو رہا ہے…"
    },
    'bw.unavailable': {
      fr: "Le calendrier est momentanément indisponible.",
      en: "The calendar is temporarily unavailable.",
      es: "El calendario no está disponible por el momento.",
      de: "Der Kalender ist vorübergehend nicht verfügbar.",
      zh: "日历暂时不可用。",
      hi: "कैलेंडर अस्थायी रूप से अनुपलब्ध है।",
      ar: "التقويم غير متاح مؤقتاً.",
      bn: "ক্যালেন্ডার সাময়িকভাবে অনুপলব্ধ।",
      pt: "O calendário está temporariamente indisponível.",
      ru: "Календарь временно недоступен.",
      ur: "کیلنڈر عارضی طور پر دستیاب نہیں۔"
    },
    'bw.unavailableHint': {
      fr: "Réessayez dans un instant, ou écrivez-nous sur WhatsApp.",
      en: "Try again in a moment, or message us on WhatsApp.",
      es: "Inténtalo de nuevo en un momento o escríbenos por WhatsApp.",
      de: "Versuche es gleich noch einmal oder schreib uns auf WhatsApp.",
      zh: "请稍后再试，或通过 WhatsApp 联系我们。",
      hi: "थोड़ी देर बाद पुनः प्रयास करें, या WhatsApp पर संदेश भेजें।",
      ar: "أعد المحاولة بعد لحظة، أو راسلنا على WhatsApp.",
      bn: "কিছুক্ষণ পর আবার চেষ্টা করুন, বা WhatsApp-এ মেসেজ করুন।",
      pt: "Tente novamente dentro de momentos, ou envie-nos mensagem no WhatsApp.",
      ru: "Попробуйте через мгновение или напишите нам в WhatsApp.",
      ur: "کچھ دیر بعد دوبارہ کوشش کریں، یا WhatsApp پر پیغام بھیجیں۔"
    },
    'bw.retry': {
      fr: "Réessayer",
      en: "Try again",
      es: "Reintentar",
      de: "Erneut versuchen",
      zh: "重试",
      hi: "पुनः प्रयास",
      ar: "أعد المحاولة",
      bn: "আবার চেষ্টা করুন",
      pt: "Tentar novamente",
      ru: "Повторить",
      ur: "دوبارہ کوشش"
    },
    'bw.confirmed': {
      fr: "Merci ! Votre réservation est confirmée — un email vient de vous être envoyé.",
      en: "Thank you! Your booking is confirmed — an email has just been sent.",
      es: "¡Gracias! Tu reserva está confirmada: te acabamos de enviar un email.",
      de: "Danke! Deine Buchung ist bestätigt — eine E-Mail wurde soeben gesendet.",
      zh: "谢谢！您的预订已确认——邮件刚刚已发送。",
      hi: "धन्यवाद! आपकी बुकिंग पुष्टि हो गई — ईमेल अभी भेजा गया है।",
      ar: "شكراً! تم تأكيد حجزك — أُرسل بريد للتو.",
      bn: "ধন্যবাদ! আপনার বুকিং নিশ্চিত — ইমেইল এইমাত্র পাঠানো হয়েছে।",
      pt: "Obrigado! A sua reserva está confirmada — acabámos de enviar um email.",
      ru: "Спасибо! Бронирование подтверждено — email только что отправлен.",
      ur: "شکریہ! آپ کی بکنگ تصدیق شدہ ہے — ای میل ابھی بھیجی گئی ہے۔"
    },
    'bw.cancelled': {
      fr: "Paiement annulé — vos dates n’ont pas été réservées. Vous pouvez réessayer.",
      en: "Payment cancelled — your dates were not booked. You can try again.",
      es: "Pago cancelado: tus fechas no se han reservado. Puedes intentarlo de nuevo.",
      de: "Zahlung abgebrochen — deine Daten wurden nicht gebucht. Du kannst es erneut versuchen.",
      zh: "付款已取消——您的日期未被预订。您可以重试。",
      hi: "भुगतान रद्द — आपकी तिथियाँ बुक नहीं हुईं। आप पुनः प्रयास कर सकते हैं।",
      ar: "أُلغي الدفع — لم تُحجز تواريخك. يمكنك المحاولة مجدداً.",
      bn: "পেমেন্ট বাতিল — আপনার তারিখ বুক হয়নি। আপনি আবার চেষ্টা করতে পারেন।",
      pt: "Pagamento cancelado — as suas datas não foram reservadas. Pode tentar novamente.",
      ru: "Оплата отменена — ваши даты не забронированы. Можно попробовать снова.",
      ur: "ادائیگی منسوخ — آپ کی تاریخیں بک نہیں ہوئیں۔ آپ دوبارہ کوشش کر سکتے ہیں۔"
    },
    'bw.prevMonth': {
      fr: "Mois précédent",
      en: "Previous month",
      es: "Mes anterior",
      de: "Vorheriger Monat",
      zh: "上个月",
      hi: "पिछला महीना",
      ar: "الشهر السابق",
      bn: "আগের মাস",
      pt: "Mês anterior",
      ru: "Предыдущий месяц",
      ur: "پچھلا مہینہ"
    },
    'bw.nextMonth': {
      fr: "Mois suivant",
      en: "Next month",
      es: "Mes siguiente",
      de: "Nächster Monat",
      zh: "下个月",
      hi: "अगला महीना",
      ar: "الشهر التالي",
      bn: "পরের মাস",
      pt: "Mês seguinte",
      ru: "Следующий месяц",
      ur: "اگلا مہینہ"
    },
    'bw.free': {
      fr: "Libre",
      en: "Available",
      es: "Libre",
      de: "Frei",
      zh: "可订",
      hi: "उपलब्ध",
      ar: "متاح",
      bn: "উপলব্ধ",
      pt: "Disponível",
      ru: "Свободно",
      ur: "دستیاب"
    },
    'bw.sel': {
      fr: "Votre séjour",
      en: "Your stay",
      es: "Tu estancia",
      de: "Dein Aufenthalt",
      zh: "您的住宿",
      hi: "आपका प्रवास",
      ar: "إقامتك",
      bn: "আপনার থাকা",
      pt: "A sua estadia",
      ru: "Ваше пребывание",
      ur: "آپ کا قیام"
    },
    'bw.busy': {
      fr: "Occupé",
      en: "Booked",
      es: "Ocupado",
      de: "Belegt",
      zh: "已订",
      hi: "बुक",
      ar: "محجوز",
      bn: "বুক করা",
      pt: "Reservado",
      ru: "Занято",
      ur: "بک شدہ"
    },
    'bw.arrival': {
      fr: "Arrivée",
      en: "Check-in",
      es: "Llegada",
      de: "Anreise",
      zh: "入住",
      hi: "चेक-इन",
      ar: "الوصول",
      bn: "চেক-ইন",
      pt: "Check-in",
      ru: "Заезд",
      ur: "چیک اِن"
    },
    'bw.departure': {
      fr: "Départ",
      en: "Check-out",
      es: "Salida",
      de: "Abreise",
      zh: "退房",
      hi: "चेक-आउट",
      ar: "المغادرة",
      bn: "চেক-আউট",
      pt: "Check-out",
      ru: "Выезд",
      ur: "چیک آؤٹ"
    },
    'bw.total': {
      fr: "Total",
      en: "Total",
      es: "Total",
      de: "Gesamt",
      zh: "合计",
      hi: "कुल",
      ar: "المجموع",
      bn: "মোট",
      pt: "Total",
      ru: "Итого",
      ur: "کل"
    },
    'bw.promo': {
      fr: "Code promo",
      en: "Promo code",
      es: "Código promo",
      de: "Aktionscode",
      zh: "优惠码",
      hi: "प्रोमो कोड",
      ar: "رمز ترويجي",
      bn: "প্রোমো কোড",
      pt: "Código promocional",
      ru: "Промокод",
      ur: "پرومو کوڈ"
    },
    'bw.apply': {
      fr: "Appliquer",
      en: "Apply",
      es: "Aplicar",
      de: "Anwenden",
      zh: "应用",
      hi: "लागू करें",
      ar: "تطبيق",
      bn: "প্রয়োগ",
      pt: "Aplicar",
      ru: "Применить",
      ur: "لاگو کریں"
    },
    'bw.name': {
      fr: "Nom complet",
      en: "Full name",
      es: "Nombre completo",
      de: "Vollständiger Name",
      zh: "全名",
      hi: "पूरा नाम",
      ar: "الاسم الكامل",
      bn: "পূর্ণ নাম",
      pt: "Nome completo",
      ru: "Полное имя",
      ur: "پورا نام"
    },
    'bw.email': {
      fr: "Email",
      en: "Email",
      es: "Email",
      de: "E-Mail",
      zh: "邮箱",
      hi: "ईमेल",
      ar: "البريد الإلكتروني",
      bn: "ইমেইল",
      pt: "Email",
      ru: "Email",
      ur: "ای میل"
    },
    'bw.phone': {
      fr: "Téléphone",
      en: "Phone",
      es: "Teléfono",
      de: "Telefon",
      zh: "电话",
      hi: "फ़ोन",
      ar: "الهاتف",
      bn: "ফোন",
      pt: "Telefone",
      ru: "Телефон",
      ur: "فون"
    },
    'bw.guests': {
      fr: "Voyageurs",
      en: "Guests",
      es: "Viajeros",
      de: "Gäste",
      zh: "住客",
      hi: "अतिथि",
      ar: "الضيوف",
      bn: "অতিথি",
      pt: "Hóspedes",
      ru: "Гости",
      ur: "مہمان"
    },
    'bw.pay': {
      fr: "Réserver et payer",
      en: "Book and pay",
      es: "Reservar y pagar",
      de: "Buchen und zahlen",
      zh: "预订并付款",
      hi: "बुक करें और भुगतान करें",
      ar: "احجز وادفع",
      bn: "বুক ও পেমেন্ট করুন",
      pt: "Reservar e pagar",
      ru: "Забронировать и оплатить",
      ur: "بک کریں اور ادائیگی کریں"
    },
    'bw.redirect': {
      fr: "Redirection…",
      en: "Redirecting…",
      es: "Redirigiendo…",
      de: "Weiterleitung…",
      zh: "正在跳转…",
      hi: "रीडायरेक्ट हो रहा है…",
      ar: "جاري التحويل…",
      bn: "রিডাইরেক্ট হচ্ছে…",
      pt: "A redirecionar…",
      ru: "Перенаправление…",
      ur: "ری ڈائریکٹ ہو رہا ہے…"
    },
    'bw.secure': {
      fr: "Paiement sécurisé par Stripe · confirmation immédiate",
      en: "Secure payment via Stripe · instant confirmation",
      es: "Pago seguro con Stripe · confirmación inmediata",
      de: "Sichere Zahlung über Stripe · sofortige Bestätigung",
      zh: "通过 Stripe 安全支付 · 即时确认",
      hi: "Stripe के माध्यम से सुरक्षित भुगतान · तत्काल पुष्टि",
      ar: "دفع آمن عبر Stripe · تأكيد فوري",
      bn: "Stripe দিয়ে নিরাপদ পেমেন্ট · তাৎক্ষণিক নিশ্চিতকরণ",
      pt: "Pagamento seguro via Stripe · confirmação imediata",
      ru: "Безопасная оплата через Stripe · мгновенное подтверждение",
      ur: "Stripe کے ذریعے محفوظ ادائیگی · فوری تصدیق"
    },
    'bw.caution': {
      fr: "Caution de {amount} — simple empreinte bancaire, <b>non débitée</b>, sauf en cas de dégât.",
      en: "Security deposit of {amount} — card hold only, <b>not charged</b>, except in case of damage.",
      es: "Fianza de {amount}: solo huella bancaria, <b>no se cobra</b>, salvo en caso de daños.",
      de: "Kaution von {amount} — nur Kartenvormerkung, <b>nicht belastet</b>, außer bei Schäden.",
      zh: "押金 {amount}——仅银行卡预授权，<b>不扣款</b>，除非发生损坏。",
      hi: "{amount} की सिक्योरिटी डिपॉज़िट — केवल कार्ड होल्ड, <b>चार्ज नहीं</b>, सिवाय क्षति के।",
      ar: "تأمين بمبلغ {amount} — حجز على البطاقة فقط، <b>دون خصم</b>، إلا في حال الضرر.",
      bn: "{amount}-এর সিকিউরিটি ডিপোজিট — শুধু কার্ড হোল্ড, <b>চার্জ নয়</b>, ক্ষতি ছাড়া।",
      pt: "Caução de {amount} — apenas bloqueio no cartão, <b>não cobrada</b>, salvo em caso de danos.",
      ru: "Залог {amount} — только холд на карте, <b>не списывается</b>, кроме случаев повреждения.",
      ur: "{amount} کی سیکیورٹی ڈپازٹ — صرف کارڈ ہولڈ، <b>چارج نہیں</b>، سوائے نقصان کے۔"
    },
    'bw.err.name': {
      fr: "Merci d’indiquer votre nom.",
      en: "Please enter your name.",
      es: "Indica tu nombre.",
      de: "Bitte gib deinen Namen an.",
      zh: "请输入您的姓名。",
      hi: "कृपया अपना नाम दर्ज करें।",
      ar: "يرجى إدخال اسمك.",
      bn: "অনুগ্রহ করে আপনার নাম লিখুন।",
      pt: "Indique o seu nome.",
      ru: "Пожалуйста, укажите имя.",
      ur: "براہِ کرم اپنا نام درج کریں۔"
    },
    'bw.err.email': {
      fr: "Merci d’indiquer un email valide.",
      en: "Please enter a valid email.",
      es: "Indica un email válido.",
      de: "Bitte gib eine gültige E-Mail an.",
      zh: "请输入有效的邮箱。",
      hi: "कृपया मान्य ईमेल दर्ज करें।",
      ar: "يرجى إدخال بريد إلكتروني صالح.",
      bn: "অনুগ্রহ করে একটি বৈধ ইমেইল লিখুন।",
      pt: "Indique um email válido.",
      ru: "Пожалуйста, укажите действительный email.",
      ur: "براہِ کرم درست ای میل درج کریں۔"
    },
    'bw.months': {
      fr: "Janvier,Février,Mars,Avril,Mai,Juin,Juillet,Août,Septembre,Octobre,Novembre,Décembre",
      en: "January,February,March,April,May,June,July,August,September,October,November,December",
      es: "Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre",
      de: "Januar,Februar,März,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember",
      zh: "一月,二月,三月,四月,五月,六月,七月,八月,九月,十月,十一月,十二月",
      hi: "जनवरी,फ़रवरी,मार्च,अप्रैल,मई,जून,जुलाई,अगस्त,सितंबर,अक्टूबर,नवंबर,दिसंबर",
      ar: "يناير,فبراير,مارس,أبريل,مايو,يونيو,يوليو,أغسطس,سبتمبر,أكتوبر,نوفمبر,ديسمبر",
      bn: "জানুয়ারি,ফেব্রুয়ারি,মার্চ,এপ্রিল,মে,জুন,জুলাই,আগস্ট,সেপ্টেম্বর,অক্টোবর,নভেম্বর,ডিসেম্বর",
      pt: "Janeiro,Fevereiro,Março,Abril,Maio,Junho,Julho,Agosto,Setembro,Outubro,Novembro,Dezembro",
      ru: "Январь,Февраль,Март,Апрель,Май,Июнь,Июль,Август,Сентябрь,Октябрь,Ноябрь,Декабрь",
      ur: "جنوری,فروری,مارچ,اپریل,مئی,جون,جولائی,اگست,ستمبر,اکتوبر,نومبر,دسمبر"
    },
    'bw.dow': {
      fr: "Lu,Ma,Me,Je,Ve,Sa,Di",
      en: "Mo,Tu,We,Th,Fr,Sa,Su",
      es: "Lu,Ma,Mi,Ju,Vi,Sá,Do",
      de: "Mo,Di,Mi,Do,Fr,Sa,So",
      zh: "一,二,三,四,五,六,日",
      hi: "सो,मं,बु,गु,शु,श,र",
      ar: "إث,ثل,أر,خم,جم,سب,أح",
      bn: "সো,ম,বু,বৃ,শু,শ,র",
      pt: "Seg,Ter,Qua,Qui,Sex,Sáb,Dom",
      ru: "Пн,Вт,Ср,Чт,Пт,Сб,Вс",
      ur: "پیر,منگ,بدھ,جمعر,جمعہ,ہفتہ,اتوار"
    },
    'lang.label': {
      fr: "Langue",
      en: "Language",
      es: "Idioma",
      de: "Sprache",
      zh: "语言",
      hi: "भाषा",
      ar: "اللغة",
      bn: "ভাষা",
      pt: "Idioma",
      ru: "Язык",
      ur: "زبان"
    }
  };

var state = { lang: 'fr', ready: false };

  function matchLang(code) {
    if (!code) return null;
    var nav = String(code).toLowerCase().replace('_', '-');
    var short = nav.split('-')[0];
    if (short === 'zh' || nav.indexOf('zh-') === 0) return LANGS.indexOf('zh') >= 0 ? 'zh' : null;
    if (LANGS.indexOf(short) >= 0) return short;
    return null;
  }

  function detect() {
    var list = [];
    try {
      if (navigator.languages && navigator.languages.length) {
        list = Array.prototype.slice.call(navigator.languages);
      }
    } catch (e) {}
    if (!list.length) {
      list = [navigator.language || navigator.userLanguage || 'fr'];
    }
    for (var i = 0; i < list.length; i++) {
      var hit = matchLang(list[i]);
      if (hit) return hit;
    }
    return 'fr';
  }

  function t(key, vars) {
    var row = D[key];
    var lang = state.lang;
    var s = (row && (row[lang] || row.fr)) || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }

  function applyNode(el) {
    var key = el.getAttribute('data-i18n');
    if (key) {
      var val = t(key);
      if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) el.textContent = val;
      else if (!el.querySelector('[data-i18n],[data-i18n-html]')) el.textContent = val;
      else {
        // replace only direct text if mixed — prefer data-i18n-html for markup
        el.textContent = val;
      }
    }
    var htmlKey = el.getAttribute('data-i18n-html');
    if (htmlKey) el.innerHTML = t(htmlKey);
    var ph = el.getAttribute('data-i18n-placeholder');
    if (ph) el.setAttribute('placeholder', t(ph));
    var ar = el.getAttribute('data-i18n-aria');
    if (ar) el.setAttribute('aria-label', t(ar));
    var ti = el.getAttribute('data-i18n-title');
    if (ti) el.setAttribute('title', t(ti));
  }

  var RTL = { ar: true, ur: true };

  function apply() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = RTL[state.lang] ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-aria],[data-i18n-title]').forEach(applyNode);
    document.querySelectorAll('[data-lba-lang]').forEach(function (btn) {
      var on = btn.getAttribute('data-lba-lang') === state.lang;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var lab = document.getElementById('langLabel');
    if (lab) lab.textContent = LABELS[state.lang];
    try { document.dispatchEvent(new CustomEvent('lba:lang', { detail: { lang: state.lang } })); } catch (e) {}
  }

  function setLang(lang) {
    if (LANGS.indexOf(lang) < 0) return;
    state.lang = lang;
    apply();
  }

  function switcherHTML(compact) {
    // Sélecteur masqué : la langue suit automatiquement le téléphone / navigateur.
    return '';
  }

  function mountSwitcher(target) {
    if (!target) return;
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target) return;
    target.innerHTML = '';
    target.hidden = true;
    target.setAttribute('aria-hidden', 'true');
  }

  function mount() {
    state.lang = detect();
    // Nettoyage d’une éventuelle ancienne préférence manuelle
    try { localStorage.removeItem('lba_lang'); } catch (e) {}
    document.querySelectorAll('[data-lba-switcher]').forEach(mountSwitcher);
    apply();
    state.ready = true;
  }

  // Si la langue du téléphone change pendant la visite
  try {
    window.addEventListener('languagechange', function () {
      var next = detect();
      if (next !== state.lang) setLang(next);
    });
  } catch (e) {}

  global.LBA_I18N = {
    LANGS: LANGS,
    LABELS: LABELS,
    NAMES: NAMES,
    t: t,
    get lang() { return state.lang; },
    setLang: setLang,
    apply: apply,
    mount: mount,
    mountSwitcher: mountSwitcher,
    switcherHTML: switcherHTML,
    detect: detect
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
