// ============================================================================
// ZAKOVAT & VIKTORINA ENGINE — Hybrid Curated + Infinite Dynamic Generator
// ============================================================================

const CURATED_QUESTIONS = [
  // 🧠 MANTIQ VA ZAKOVAT
  {
    id: 'zq_1',
    cat: '🧠 Mantiq va Zakovat',
    q: "U narsa sizga tegishli, lekin uni sizdan ko'ra boshqa odamlar ko'proq ishlatishadi. U nima?",
    opts: ['Ismingiz', 'Telefon raqamingiz', 'Uy manzilingiz', 'Soat'],
    ans: 0
  },
  {
    id: 'zq_2',
    cat: '🧠 Mantiq va Zakovat',
    q: 'Qaysi oyda 28 kun bor?',
    opts: ['Barcha 12 oyda', 'Faqat fevralda', 'Kabisa yilida', 'Faqat qish oylarida'],
    ans: 0
  },
  {
    id: 'zq_3',
    cat: '🧠 Mantiq va Zakovat',
    q: "Qorong'i xonaga kirdingiz. Qo'lingizda faqat 1 dona gugurt bor. Xonada sham, kerosin lampa va pechka bor. Birinchi bo'lib nimani yoqasiz?",
    opts: ["Gugurtning o'zini", 'Shamni', 'Kerosin lampani', 'Pechkani'],
    ans: 0
  },
  {
    id: 'zq_4',
    cat: '🧠 Mantiq va Zakovat',
    q: '1 kg paxta og\'irmi yoki 1 kg temir?',
    opts: ['Ikkalasi teng (1 kg)', '1 kg temir og\'ir', '1 kg paxta og\'ir', 'Hajmiga bog\'liq'],
    ans: 0
  },
  {
    id: 'zq_5',
    cat: '🧠 Mantiq va Zakovat',
    q: "Yugurish musobaqasida siz 2-o'rindagi sportchini quvib o'tdingiz. Hozir nechanchi o'rindasiz?",
    opts: ["2-o'rinda", "1-o'rinda", "3-o'rinda", "Aniqlab bo'lmaydi"],
    ans: 0
  },
  {
    id: 'zq_6',
    cat: '🧠 Mantiq va Zakovat',
    q: "Fermerning 17 ta qo'yi bor edi. 9 tasidan boshqa hammasi qochib ketdi. Fermerda nechta qo'y qoldi?",
    opts: ['9 ta', '8 ta', '17 ta', '0 ta'],
    ans: 0
  },
  {
    id: 'zq_7',
    cat: '🧠 Mantiq va Zakovat',
    q: "Qaysi savolga hech qachon rostdan 'Ha' deb javob berib bo'lmaydi?",
    opts: ['Uxlayapsizmi?', 'Eshityapsizmi?', 'Charchadingizmi?', 'Ovqatlandingizmi?'],
    ans: 0
  },
  {
    id: 'zq_8',
    cat: '🧠 Mantiq va Zakovat',
    q: "Suvda tug'iladi, lekin suvga tushsa erib yo'qoladi. Bu nima?",
    opts: ['Tuz', 'Muz', 'Baliq', 'Ko\'pik'],
    ans: 0
  },
  {
    id: 'zq_9',
    cat: '🧠 Mantiq va Zakovat',
    q: 'O\'rdak oldinda 2 ta o\'rdak, orqada 2 ta o\'rdak va o\'rtada 1 ta o\'rdak ketmoqda. Jami nechta o\'rdak bor?',
    opts: ['3 ta', '5 ta', '4 ta', '6 ta'],
    ans: 0
  },
  {
    id: 'zq_10',
    cat: '🧠 Mantiq va Zakovat',
    q: "Undan qancha ko'p olsangiz, u shuncha kattalashib boradi. Gap nima haqida?",
    opts: ['Chuqur (o\'ra)', 'Qarz', 'Bilim', 'Vaqt'],
    ans: 0
  },
  {
    id: 'zq_11',
    cat: '🧠 Mantiq va Zakovat',
    q: 'Shifokor sizga 3 ta dori berdi va har yarim soatda bittadan ichishni buyurdi. Dorilar qancha vaqtda tugaydi?',
    opts: ['1 soatda', '1.5 soatda', '2 soatda', '30 daqiqada'],
    ans: 0
  },
  {
    id: 'zq_12',
    cat: '🧠 Mantiq va Zakovat',
    q: 'Shaxmat taxtasida jami nechta katak (1x1) bor?',
    opts: ['64 ta', '32 ta', '100 ta', '81 ta'],
    ans: 0
  },
  {
    id: 'zq_13',
    cat: '🧠 Mantiq va Zakovat',
    q: "Dengiz tubida qanday tosh bo'lmaydi?",
    opts: ['Quruq tosh', 'Oq tosh', 'Katta tosh', 'Qimmatbaho tosh'],
    ans: 0
  },
  {
    id: 'zq_14',
    cat: '🧠 Mantiq va Zakovat',
    q: "Maryamning otasining 5 ta qizi bor: Nana, Nene, Nini, Nono. Beshinchi qizning ismi nima?",
    opts: ['Maryam', 'Nunu', 'Nana', 'Malika'],
    ans: 0
  },
  {
    id: 'zq_15',
    cat: '🧠 Mantiq va Zakovat',
    q: 'Qaysi soat sutkada faqat ikki marta to\'g\'ri vaqtni ko\'rsatadi?',
    opts: ['To\'xtab qolgan soat', 'Qum soati', 'Quyosh soati', 'Elektron soat'],
    ans: 0
  },

  // 🇺🇿 O'ZBEKISTON TARIXI, GEOGRAFIYASI VA ADABIYOTI
  {
    id: 'uz_1',
    cat: "🇺🇿 O'zbekiston",
    q: 'Amir Temur qaysi yilda tavallud topgan?',
    opts: ['1336-yil 9-aprel', '1340-yil 12-mart', '1405-yil 18-fevral', '1370-yil 10-aprel'],
    ans: 0
  },
  {
    id: 'uz_2',
    cat: "🇺🇿 O'zbekiston",
    q: "Alisher Navoiyning 'Xamsa' asari nechta dostondan iborat?",
    opts: ['5 ta', '4 ta', '6 ta', '7 ta'],
    ans: 0
  },
  {
    id: 'uz_3',
    cat: "🇺🇿 O'zbekiston",
    q: "O'zbekistonning maydoni bo'yicha eng katta viloyati qaysi?",
    opts: ['Navoiy viloyati', 'Qashqadaryo viloyati', 'Buxoro viloyati', 'Samarqand viloyati'],
    ans: 0
  },
  {
    id: 'uz_4',
    cat: "🇺🇿 O'zbekiston",
    q: "O'zbekistonning maydoni bo'yicha eng kichik viloyati qaysi?",
    opts: ['Andijon viloyati', 'Sirdaryo viloyati', 'Namangan viloyati', 'Xorazm viloyati'],
    ans: 0
  },
  {
    id: 'uz_5',
    cat: "🇺🇿 O'zbekiston",
    q: "Mashhur 'O'tkan kunlar' romanining muallifi kim?",
    opts: ['Abdulla Qodiriy', 'Cho\'lpon', 'Oybek', 'G\'afur G\'ulom'],
    ans: 0
  },
  {
    id: 'uz_6',
    cat: "🇺🇿 O'zbekiston",
    q: "Mirzo Ulug'bek rasadxonasi qaysi shaharda barpo etilgan?",
    opts: ['Samarqandda', 'Buxoroda', 'Xivada', 'Shahrisabzda'],
    ans: 0
  },
  {
    id: 'uz_7',
    cat: "🇺🇿 O'zbekiston",
    q: "O'zbekiston milliy valyutasi — so'm qaysi yildan muomalaga kiritilgan?",
    opts: ['1994-yil 1-iyul', '1991-yil 1-sentabr', '1992-yil 8-dekabr', '1996-yil 1-yanvar'],
    ans: 0
  },
  {
    id: 'uz_8',
    cat: "🇺🇿 O'zbekiston",
    q: "Zahiriddin Muhammad Boburning mashhur memuar asari qanday nomlanadi?",
    opts: ['Boburnoma', 'Zafarnoma', 'Humoyunnoma', 'Xamsa'],
    ans: 0
  },
  {
    id: 'uz_9',
    cat: "🇺🇿 O'zbekiston",
    q: "Toshkent metropoliteni qaysi yilda ishga tushirilgan?",
    opts: ['1977-yil', '1980-yil', '1966-yil', '1991-yil'],
    ans: 0
  },
  {
    id: 'uz_10',
    cat: "🇺🇿 O'zbekiston",
    q: "Ichan-Qal'a tarixiy majmuasi qaysi shaharda joylashgan?",
    opts: ['Xiva', 'Buxoro', 'Qo\'qon', 'Termiz'],
    ans: 0
  },
  {
    id: 'uz_11',
    cat: "🇺🇿 O'zbekiston",
    q: 'Tibbiyot ilmining sultoni Abu Ali ibn Sino qaysi shahar yaqinidagi Afshona qishlog\'ida tug\'ilgan?',
    opts: ['Buxoro', 'Samarqand', 'Urganch', 'Termiz'],
    ans: 0
  },
  {
    id: 'uz_12',
    cat: "🇺🇿 O'zbekiston",
    q: "O'zbekiston davlat bayrog'ida nechta yulduz tasvirlangan?",
    opts: ['12 ta', '10 ta', '14 ta', '7 ta'],
    ans: 0
  },
  {
    id: 'uz_13',
    cat: "🇺🇿 O'zbekiston",
    q: "Markaziy Osiyodagi eng uzun daryo qaysi?",
    opts: ['Sirdaryo', 'Amudaryo', 'Zarafshon', 'Chirchiq'],
    ans: 0
  },
  {
    id: 'uz_14',
    cat: "🇺🇿 O'zbekiston",
    q: "Markaziy Osiyodagi eng sersuv daryo qaysi?",
    opts: ['Amudaryo', 'Sirdaryo', 'Norin', 'Qashqadaryo'],
    ans: 0
  },
  {
    id: 'uz_15',
    cat: "🇺🇿 O'zbekiston",
    q: "'Shum bola' qissasining muallifi kim?",
    opts: ["G'afur G'ulom", 'Abdulla Qahhor', "O'tkir Hoshimov", 'Said Ahmad'],
    ans: 0
  },

  // ⚽ SPORT VA FUTBOL
  {
    id: 'sp_1',
    cat: '⚽ Sport va Futbol',
    q: 'Futbol bo\'yicha 2022-yilgi Jahon chempionatida qaysi terma jamoa g\'olib bo\'lgan?',
    opts: ['Argentina', 'Fransiya', 'Braziliya', 'Xorvatiya'],
    ans: 0
  },
  {
    id: 'sp_2',
    cat: '⚽ Sport va Futbol',
    q: "Shaxmat bo'yicha 2024-yilgi Butunjahon Shaxmat Olimpiadasida O'zbekiston terma jamoasi (2022-yilda) qaysi medalni qo'lga kiritgan edi?",
    opts: ['Oltin medal (Chempion)', 'Kumush medal', 'Bronza medal', "4-o'rin"],
    ans: 0
  },
  {
    id: 'sp_3',
    cat: '⚽ Sport va Futbol',
    q: 'UEFA Chempionlar Ligasini eng ko\'p marta yutgan klub qaysi?',
    opts: ['Real Madrid', 'Milan', 'Bavariya', 'Barselona'],
    ans: 0
  },
  {
    id: 'sp_4',
    cat: '⚽ Sport va Futbol',
    q: 'Futbol tarixida eng ko\'p "Oltin to\'p" (Ballon d\'Or) sovrinini olgan futbolchi kim?',
    opts: ['Lionel Messi', 'Krishtianu Ronaldu', 'Mishel Platini', 'Yoxan Kroyff'],
    ans: 0
  },
  {
    id: 'sp_5',
    cat: '⚽ Sport va Futbol',
    q: "Futbol maydonida bitta jamoadan bir vaqtda nechta o'yinchi harakat qiladi?",
    opts: ['11 ta', '10 ta', '12 ta', '9 ta'],
    ans: 0
  },
  {
    id: 'sp_6',
    cat: '⚽ Sport va Futbol',
    q: "O'zbekistonlik grossmeyster Nodirbek Abdusattorov shaxmatning qaysi yo'nalishi bo'yicha eng yosh Jahon chempioni bo'lgan?",
    opts: ['Rapid (Tezkor shaxmat)', 'Klassik shaxmat', 'Blits', 'Bullet'],
    ans: 0
  },
  {
    id: 'sp_7',
    cat: '⚽ Sport va Futbol',
    q: 'Boks bo\'yicha ikki karra Olimpiada chempioni bo\'lgan o\'zbekistonlik sportchi kim?',
    opts: ['Bahodir Jalolov / Hasanboy Do\'smatov', 'Ruslan Chagayev', 'Muhammadqodir Abdullayev', 'Bektemir Meliqo\'ziyev'],
    ans: 0
  },
  {
    id: 'sp_8',
    cat: '⚽ Sport va Futbol',
    q: "Futbol bo'yicha Jahon chempionatini eng ko'p (5 marta) yutgan davlat qaysi?",
    opts: ['Braziliya', 'Germaniya', 'Italiya', 'Argentina'],
    ans: 0
  },
  {
    id: 'sp_9',
    cat: '⚽ Sport va Futbol',
    q: 'Olimpiya bayrog\'ida nechta halqa tasvirlangan?',
    opts: ['5 ta', '6 ta', '4 ta', '7 ta'],
    ans: 0
  },
  {
    id: 'sp_10',
    cat: '⚽ Sport va Futbol',
    q: 'Shaxmatda eng kuchli dona qaysi?',
    opts: ['Farzin (Vazir)', 'Ruh (To\'ra)', 'Fil', 'Ot'],
    ans: 0
  },

  // 🔬 FAN, KOSMOS VA TEXNOLOGIYA
  {
    id: 'sc_1',
    cat: '🔬 Fan va Texnologiya',
    q: 'Quyosh tizimidagi eng katta sayyora qaysi?',
    opts: ['Yupiter', 'Saturn', 'Yer', 'Mars'],
    ans: 0
  },
  {
    id: 'sc_2',
    cat: '🔬 Fan va Texnologiya',
    q: 'Suvning kimyoviy formulasi qanday?',
    opts: ['H2O', 'CO2', 'O2', 'NaCl'],
    ans: 0
  },
  {
    id: 'sc_3',
    cat: '🔬 Fan va Texnologiya',
    q: "Quyoshga eng yaqin joylashgan sayyora qaysi?",
    opts: ['Merkuriy', 'Venera', 'Mars', 'Yer'],
    ans: 0
  },
  {
    id: 'sc_4',
    cat: '🔬 Fan va Texnologiya',
    q: 'Inson tanasidagi eng katta ichki a\'zo qaysi?',
    opts: ['Jigar', 'Yurak', 'O\'pka', 'Buyrak'],
    ans: 0
  },
  {
    id: 'sc_5',
    cat: '🔬 Fan va Texnologiya',
    q: 'Kattalar organizmida normal holatda nechta suyak bo\'ladi?',
    opts: ['206 ta', '150 ta', '300 ta', '256 ta'],
    ans: 0
  },
  {
    id: 'sc_6',
    cat: '🔬 Fan va Texnologiya',
    q: 'Telegram messenjerining asoschisi kim?',
    opts: ['Pavel Durov', 'Mark Sukerberg', 'Ilon Mask', 'Bill Geyts'],
    ans: 0
  },
  {
    id: 'sc_7',
    cat: '🔬 Fan va Texnologiya',
    q: 'Kosmosga birinchi bo\'lib parvoz qilgan inson kim?',
    opts: ['Yuriy Gagarin', 'Nil Armstrong', 'Aleksey Leonov', 'Jon Glenn'],
    ans: 0
  },
  {
    id: 'sc_8',
    cat: '🔬 Fan va Texnologiya',
    q: 'Qaysi metall xona haroratida suyuq holatda bo\'ladi?',
    opts: ['Simob', 'Temir', 'Mis', 'Alyuminiy'],
    ans: 0
  },
  {
    id: 'sc_9',
    cat: '🔬 Fan va Texnologiya',
    q: 'Olmos qaysi kimyoviy elementdan tashkil topgan?',
    opts: ['Uglerod', 'Kremniy', 'Oltin', 'Kislorod'],
    ans: 0
  },
  {
    id: 'sc_10',
    cat: '🔬 Fan va Texnologiya',
    q: "Yorug'likning vakuumdagi tezligi sekundiga taxminan qancha?",
    opts: ['300 000 km/s', '150 000 km/s', '1 000 000 km/s', '30 000 km/s'],
    ans: 0
  },

  // 🌍 JAHON GEOGRAFIYASI VA FAKTLAR
  {
    id: 'geo_1',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Dunyodagi eng baland tog\' cho\'qqisi qaysi?',
    opts: ['Everest (Jomolungma)', 'K2 (Chogori)', 'Kilimanjaro', 'Monblan'],
    ans: 0
  },
  {
    id: 'geo_2',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Yer yuzidagi eng katta okean qaysi?',
    opts: ['Tinch okeani', 'Atlantika okeani', 'Hind okeani', 'Shimoliy Muz okeani'],
    ans: 0
  },
  {
    id: 'geo_3',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Dunyodagi eng chuqur ko\'l qaysi?',
    opts: ['Baykal ko\'li', 'Kaspiy dengizi', 'Viktoriya ko\'li', 'Issiqko\'l'],
    ans: 0
  },
  {
    id: 'geo_4',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Dunyodagi maydoni bo\'yicha eng kichik davlat qaysi?',
    opts: ['Vatikan', 'Monako', 'San-Marino', 'Singapur'],
    ans: 0
  },
  {
    id: 'geo_5',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Quyosh chiqish mamlakati deb qaysi davlatga aytiladi?',
    opts: ['Yaponiya', 'Xitoy', 'Janubiy Koreya', 'Hindiston'],
    ans: 0
  },
  {
    id: 'geo_6',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Misr ehromlari (piramidalari) qaysi daryo bo\'yida joylashgan?',
    opts: ['Nil daryosi', 'Amazonka', 'Frot daryosi', 'Gang daryosi'],
    ans: 0
  },
  {
    id: 'geo_7',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Quruqlikdagi eng tez yuguruvchi hayvon qaysi?',
    opts: ['Gepard', 'Arslon', 'Yo\'lbars', 'Bo\'ri'],
    ans: 0
  },
  {
    id: 'geo_8',
    cat: '🌍 Jahon Geografiyasi',
    q: 'Dunyodagi eng katta sutemizuvchi hayvon qaysi?',
    opts: ['Ko\'k kit', 'Afrika fili', 'Jirafa', 'Oq ayiq'],
    ans: 0
  }
];

// ============================================================================
// DYNAMIC DATA TABLES FOR INFINITE PROCEDURAL QUESTION GENERATION
// ============================================================================
const COUNTRIES_DATA = [
  { country: "O'zbekiston", capital: 'Toshkent', currency: "So'm", flag: '🇺🇿', continent: 'Osiyo' },
  { country: 'Qozog\'iston', capital: 'Ostona', currency: 'Tenge', flag: '🇰🇿', continent: 'Osiyo' },
  { country: 'Qirg\'iziston', capital: 'Bishkek', currency: 'Som', flag: '🇰🇬', continent: 'Osiyo' },
  { country: 'Tojikiston', capital: 'Dushanbe', currency: 'Somoni', flag: '🇹🇯', continent: 'Osiyo' },
  { country: 'Turkmaniston', capital: 'Ashxobod', currency: 'Manat', flag: '🇹🇲', continent: 'Osiyo' },
  { country: 'Turkiya', capital: 'Anqara', currency: 'Turk lirasi', flag: '🇹🇷', continent: 'Osiyo/Yevropa' },
  { country: 'Yaponiya', capital: 'Tokio', currency: 'Iyena', flag: '🇯🇵', continent: 'Osiyo' },
  { country: 'Janubiy Koreya', capital: 'Seul', currency: 'Vona', flag: '🇰🇷', continent: 'Osiyo' },
  { country: 'Xitoy', capital: 'Pekin', currency: 'Yuan', flag: '🇨🇳', continent: 'Osiyo' },
  { country: 'Hindiston', capital: 'Yangi Dehli', currency: 'Rupiya', flag: '🇮🇳', continent: 'Osiyo' },
  { country: 'Saudiya Arabistoni', capital: 'Ar-Riyod', currency: 'Rial', flag: '🇸🇦', continent: 'Osiyo' },
  { country: 'BAA (Amirliklar)', capital: 'Abu-Dabi', currency: 'Dirham', flag: '🇦🇪', continent: 'Osiyo' },
  { country: 'Misr', capital: 'Qohira', currency: 'Misr funti', flag: '🇪🇬', continent: 'Afrika' },
  { country: 'Fransiya', capital: 'Parij', currency: 'Yevro', flag: '🇫🇷', continent: 'Yevropa' },
  { country: 'Germaniya', capital: 'Berlin', currency: 'Yevro', flag: '🇩🇪', continent: 'Yevropa' },
  { country: 'Italiya', capital: 'Rim', currency: 'Yevro', flag: '🇮🇹', continent: 'Yevropa' },
  { country: 'Ispaniya', capital: 'Madrid', currency: 'Yevro', flag: '🇪🇸', continent: 'Yevropa' },
  { country: 'Buyuk Britaniya', capital: 'London', currency: 'Funt sterling', flag: '🇬🇧', continent: 'Yevropa' },
  { country: 'AQSH', capital: 'Vashington', currency: 'AQSH dollari', flag: '🇺🇸', continent: 'Shimoliy Amerika' },
  { country: 'Kanada', capital: 'Ottava', currency: 'Kanada dollari', flag: '🇨🇦', continent: 'Shimoliy Amerika' },
  { country: 'Braziliya', capital: 'Brazilia', currency: 'Real', flag: '🇧🇷', continent: 'Janubiy Amerika' },
  { country: 'Argentina', capital: 'Buenos-Ayres', currency: 'Peso', flag: '🇦🇷', continent: 'Janubiy Amerika' },
  { country: 'Avstraliya', capital: 'Kanberra', currency: 'Avstraliya dollari', flag: '🇦🇺', continent: 'Avstraliya' },
  { country: 'Shveysariya', capital: 'Bern', currency: 'Shveysariya franki', flag: '🇨🇭', continent: 'Yevropa' },
  { country: 'Polsha', capital: 'Varshava', currency: 'Zlotiy', flag: '🇵🇱', continent: 'Yevropa' },
  { country: 'Portugaliya', capital: 'Lissabon', currency: 'Yevro', flag: '🇵🇹', continent: 'Yevropa' },
  { country: 'Niderlandiya', capital: 'Amsterdam', currency: 'Yevro', flag: '🇳🇱', continent: 'Yevropa' },
  { country: 'Shvetsiya', capital: 'Stokgolm', currency: 'Shved kronasi', flag: '🇸🇪', continent: 'Yevropa' },
  { country: 'Norvegiya', capital: 'Oslo', currency: 'Norveg kronasi', flag: '🇳🇴', continent: 'Yevropa' },
  { country: 'Gretsiya', capital: 'Afina', currency: 'Yevro', flag: '🇬🇷', continent: 'Yevropa' },
  { country: 'Malayziya', capital: 'Kuala-Lumpur', currency: 'Ringgit', flag: '🇲🇾', continent: 'Osiyo' },
  { country: 'Indoneziya', capital: 'Jakarta', currency: 'Rupiya', flag: '🇮🇩', continent: 'Osiyo' },
  { country: 'Tailand', capital: 'Bangkok', currency: 'Bat', flag: '🇹🇭', continent: 'Osiyo' },
  { country: 'Meksika', capital: 'Mexiko', currency: 'Meksika pesosi', flag: '🇲🇽', continent: 'Shimoliy Amerika' },
  { country: 'Marokash', capital: 'Rabot', currency: 'Dirham', flag: '🇲🇦', continent: 'Afrika' },
  { country: 'Ozarbayjon', capital: 'Boku', currency: 'Manat', flag: '🇦🇿', continent: 'Osiyo' },
  { country: 'Gruziya', capital: 'Tbilisi', currency: 'Lari', flag: '🇬🇪', continent: 'Yevropa/Osiyo' }
];

const ELEMENTS_DATA = [
  { name: 'Oltin', sym: 'Au' },
  { name: 'Kumush', sym: 'Ag' },
  { name: 'Temir', sym: 'Fe' },
  { name: 'Kislorod', sym: 'O' },
  { name: 'Vodorod', sym: 'H' },
  { name: 'Uglerod', sym: 'C' },
  { name: 'Mis', sym: 'Cu' },
  { name: 'Natriy', sym: 'Na' },
  { name: 'Kalsiy', sym: 'Ca' },
  { name: 'Azot', sym: 'N' }
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatQuestionWithShuffledOptions(rawQ) {
  const correctText = String(rawQ.opts[rawQ.ans ?? 0]);
  const shuffledOpts = shuffleArray(rawQ.opts.map(String));
  const newAnsIndex = shuffledOpts.indexOf(correctText);
  return {
    id: rawQ.id,
    cat: rawQ.cat,
    q: rawQ.q,
    opts: shuffledOpts,
    ans: newAnsIndex >= 0 ? newAnsIndex : 0
  };
}

// Procedural dynamic generators so questions never run out
function generateDynamicCountryQuestion() {
  const subType = randInt(1, 3);
  const picked = shuffleArray(COUNTRIES_DATA).slice(0, 4);
  const target = picked[0];

  if (subType === 1) {
    return formatQuestionWithShuffledOptions({
      id: `dyn_cap_${target.country}`,
      cat: '🌍 Poytaxtlar va Davlatlar',
      q: `${target.flag} ${target.country} davlatining poytaxti qaysi shahar?`,
      opts: picked.map((x) => x.capital),
      ans: 0
    });
  }
  if (subType === 2) {
    return formatQuestionWithShuffledOptions({
      id: `dyn_flag_${target.country}`,
      cat: '🏳️ Davlat Bayroqlari',
      q: `${target.flag} — ushbu bayroq qaysi davlatga tegishli?`,
      opts: picked.map((x) => x.country),
      ans: 0
    });
  }
  return formatQuestionWithShuffledOptions({
    id: `dyn_revcap_${target.capital}`,
    cat: '🌍 Poytaxtlar va Davlatlar',
    q: `${target.capital} shahri qaysi davlatning poytaxti hisoblanadi?`,
    opts: picked.map((x) => x.country),
    ans: 0
  });
}

function generateDynamicSequenceQuestion() {
  const patternType = randInt(1, 4);
  let seq = [];
  let answer = 0;

  if (patternType === 1) {
    // Double + constant: x_{n+1} = x_n * 2 + k
    const start = randInt(2, 6);
    const k = randInt(1, 3);
    let cur = start;
    for (let i = 0; i < 4; i++) {
      seq.push(cur);
      cur = cur * 2 + k;
    }
    answer = cur;
  } else if (patternType === 2) {
    // Increasing step: +3, +6, +9, +12...
    const baseStep = randInt(2, 5);
    let cur = randInt(3, 12);
    for (let i = 1; i <= 4; i++) {
      seq.push(cur);
      cur += baseStep * i;
    }
    answer = cur;
  } else if (patternType === 3) {
    // Squares: n^2
    const offset = randInt(1, 5);
    for (let i = offset; i < offset + 4; i++) {
      seq.push(i * i);
    }
    answer = (offset + 4) * (offset + 4);
  } else {
    // Fibonacci-like: a, b, a+b, a+2b...
    let a = randInt(2, 6);
    let b = randInt(3, 8);
    seq = [a, b, a + b, a + 2 * b];
    answer = 2 * a + 3 * b;
  }

  const distractors = new Set();
  while (distractors.size < 3) {
    const delta = randInt(-8, 12);
    const cand = answer + (delta === 0 ? 4 : delta);
    if (cand > 0 && cand !== answer) distractors.add(String(cand));
  }

  return formatQuestionWithShuffledOptions({
    id: `dyn_seq_${seq.join('_')}`,
    cat: '🧩 IQ va Mantiqiy Qator',
    q: `Sonlar qonuniyatini toping va keyingi sonni belgilang:\n${seq.join(' ➔ ')} ➔ ?`,
    opts: [String(answer), ...Array.from(distractors)],
    ans: 0
  });
}

function generateDynamicMathOrElementQuestion() {
  const mode = randInt(1, 3);
  if (mode === 1) {
    const picked = shuffleArray(ELEMENTS_DATA).slice(0, 4);
    const target = picked[0];
    return formatQuestionWithShuffledOptions({
      id: `dyn_elem_${target.sym}`,
      cat: '🔬 Kimyo va Fan',
      q: `Mendeleyev davriy jadvalida "${target.name}" elementining kimyoviy belgisi qanday?`,
      opts: picked.map((e) => e.sym),
      ans: 0
    });
  }
  if (mode === 2) {
    const percents = [10, 15, 20, 25, 30, 40, 50];
    const p = percents[randInt(0, percents.length - 1)];
    const base = randInt(2, 12) * 20;
    const ans = (base * p) / 100;
    const opts = [
      String(ans),
      String(ans + 10),
      String(Math.max(2, ans - 5)),
      String(ans + 15)
    ];
    return formatQuestionWithShuffledOptions({
      id: `dyn_pct_${base}_${p}`,
      cat: '⚡ Tezkor Hisob',
      q: `${base} sonining ${p}% i nechaga teng?`,
      opts,
      ans: 0
    });
  }
  const a = randInt(11, 25);
  const b = randInt(6, 14);
  const c = randInt(10, 40);
  const ans = a * b + c;
  const opts = [
    String(ans),
    String(ans + 10),
    String(ans - 10),
    String(ans + 4)
  ];
  return formatQuestionWithShuffledOptions({
    id: `dyn_calc_${a}_${b}_${c}`,
    cat: '⚡ Tezkor Hisob',
    q: `Tezkor hisoblang: (${a} × ${b}) + ${c} = ?`,
    opts,
    ans: 0
  });
}

/**
 * Picks `count` fresh, non-repeating questions for a room of players.
 * Mixes curated Zakovat/Uzbek/Science/Sports questions with procedural dynamic questions.
 */
function pickQuestionsForZakovatRoom(seenIdsSet = new Set(), count = 8, customQuestions = []) {
  const allCurated = [...customQuestions, ...CURATED_QUESTIONS];
  const unseenCurated = shuffleArray(allCurated.filter((q) => !seenIdsSet.has(q.id)));
  const fallbackCurated = shuffleArray(allCurated);

  const selected = [];
  const usedIds = new Set();

  // Take 5 curated questions (prioritizing unseen)
  const curatedTarget = Math.min(5, count);
  for (const q of [...unseenCurated, ...fallbackCurated]) {
    if (selected.length >= curatedTarget) break;
    if (!usedIds.has(q.id)) {
      usedIds.add(q.id);
      selected.push(formatQuestionWithShuffledOptions(q));
    }
  }

  // Fill remaining 3 slots with fresh procedural questions (Country/Flag, IQ Sequence, Fast Math/Science)
  const dynGenerators = [
    generateDynamicCountryQuestion,
    generateDynamicSequenceQuestion,
    generateDynamicMathOrElementQuestion
  ];
  let genIdx = 0;
  while (selected.length < count) {
    const gen = dynGenerators[genIdx % dynGenerators.length];
    genIdx++;
    const dq = gen();
    if (!usedIds.has(dq.id)) {
      usedIds.add(dq.id);
      selected.push(dq);
    }
  }

  return shuffleArray(selected);
}

module.exports = {
  CURATED_QUESTIONS,
  pickQuestionsForZakovatRoom
};
