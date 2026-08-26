/* La Bonne Aventure — i18n FR / EN / ES / DE
   Usage:
     - Mark text with data-i18n="key" (or data-i18n-html / data-i18n-placeholder / data-i18n-aria)
     - Call LBA_I18N.mount() once; language persists in localStorage (lba_lang)
*/
(function (global) {
  var LANGS = ['fr', 'en', 'es', 'de'];
  var LABELS = { fr: 'FR', en: 'EN', es: 'ES', de: 'DE' };
  var NAMES = { fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch' };

  var D = {
    /* —— Site / index —— */
    'nav.account': { fr: 'Mon espace', en: 'My account', es: 'Mi espacio', de: 'Mein Bereich' },
    'nav.home': { fr: 'Accueil', en: 'Home', es: 'Inicio', de: 'Start' },
    'nav.back': { fr: '← Retour', en: '← Back', es: '← Volver', de: '← Zurück' },
    'nav.legal': { fr: 'Mentions légales', en: 'Legal notice', es: 'Aviso legal', de: 'Impressum' },

    'hero.kick': { fr: "Maison d'hôtes · Aix-les-Bains", en: 'Guesthouse · Aix-les-Bains', es: 'Casa de huéspedes · Aix-les-Bains', de: 'Gästehaus · Aix-les-Bains' },
    'hero.h1.a': { fr: 'Un studio', en: 'A studio', es: 'Un estudio', de: 'Ein Studio' },
    'hero.h1.b': { fr: "au cœur d'Aix", en: 'in the heart of Aix', es: 'en el corazón de Aix', de: 'im Herzen von Aix' },
    'hero.p': {
      fr: 'Face au lac du Bourget, aux thermes et à la ville — un cocon ~25\u00a0m² pour se sentir chez soi.',
      en: 'By Lake Bourget, the spas and the town — a ~25\u00a0m² cocoon that feels like home.',
      es: 'Junto al lago del Bourget, las termas y el centro — un rincón de ~25\u00a0m² para sentirte como en casa.',
      de: 'Am Lac du Bourget, den Thermen und der Stadt — ein ~25\u00a0m² Cocoon zum Ankommen.'
    },
    'hero.cta.book': { fr: 'Voir les disponibilités', en: 'Check availability', es: 'Ver disponibilidad', de: 'Verfügbarkeit prüfen' },
    'hero.cta.discover': { fr: 'Découvrir le logement', en: 'Discover the flat', es: 'Descubrir el alojamiento', de: 'Die Unterkunft entdecken' },

    'sec.logement.kicker': { fr: 'Le logement', en: 'The flat', es: 'El alojamiento', de: 'Die Unterkunft' },
    'sec.logement.h2': { fr: 'Un studio <span class="it">entièrement rénové</span>', en: 'A <span class="it">fully renovated</span> studio', es: 'Un estudio <span class="it">completamente renovado</span>', de: 'Ein <span class="it">komplett renoviertes</span> Studio' },
    'sec.logement.pull': {
      fr: "25 m² en plein hypercentre d'Aix-les-Bains, refait à neuf. Lit queen size, kitchenette complète, clim réversible, et un patio privé rien qu'à vous pour le café du matin. Commerces, restaurants et gare à pied — le lac du Bourget à 5 min en voiture.",
      en: '25 m² in the heart of Aix-les-Bains, fully renovated. Queen-size bed, complete kitchenette, reversible air conditioning, and a private patio just for you for morning coffee. Shops, restaurants and station on foot — Lake Bourget 5 min by car.',
      es: '25 m² en pleno centro de Aix-les-Bains, totalmente renovado. Cama queen size, cocina completa, climatización reversible y un patio privado solo para ti. Comercios, restaurantes y estación a pie — el lago Bourget a 5 min en coche.',
      de: '25 m² mitten im Zentrum von Aix-les-Bains, komplett renoviert. Queensize-Bett, vollausgestattete Küchenzeile, reversible Klimaanlage und eine private Terrasse nur für Sie. Geschäfte, Restaurants und Bahnhof zu Fuß — Lac du Bourget 5 min mit dem Auto.'
    },
    'fact.m2': { fr: 'Hypercentre, à pied de tout', en: 'Town centre, everything on foot', es: 'Hipercentro, todo a pie', de: 'Zentrum, alles zu Fuß' },
    'fact.bed': { fr: 'Matelas neuf, stores occultants', en: 'New mattress, blackout blinds', es: 'Colchón nuevo, persianas opacas', de: 'Neue Matratze, Verdunkelungsrollos' },
    'fact.lake': { fr: 'À 5 min en voiture', en: '5 min by car', es: 'A 5 min en coche', de: '5 Min. mit dem Auto' },
    'fact.ac': { fr: "Frais l\u2019\u00e9t\u00e9, chaud l\u2019hiver", en: 'Cool in summer, warm in winter', es: 'Frío en verano, calor en invierno', de: 'Kühl im Sommer, warm im Winter' },
    'fact.checkin': { fr: 'Boîte à clés 24h/24', en: 'Lockbox, any time', es: 'Caja de llaves, a cualquier hora', de: 'Schlüsselbox, jederzeit' },
    'fact.extras': { fr: 'Terrasse avec mobilier', en: 'Terrace with furniture', es: 'Terraza con mobiliario', de: 'Terrasse mit Möbeln' },

    'sec.amenities.h3': { fr: 'Équipements', en: 'Amenities', es: 'Equipamiento', de: 'Ausstattung' },
    'amen.ac': { fr: 'Climatisation réversible', en: 'Reversible air conditioning', es: 'Climatización reversible', de: 'Reversible Klimaanlage' },
    'amen.wifi': { fr: 'Wifi fibre 38 Mbps', en: 'Fibre WiFi 38 Mbps', es: 'WiFi fibra 38 Mbps', de: 'Glasfaser-WLAN 38 Mbps' },
    'amen.kitchen': { fr: 'Cuisine équipée', en: 'Fully equipped kitchen', es: 'Cocina equipada', de: 'Vollausgestattete Küche' },
    'amen.patio': { fr: 'Patio privé avec mobilier', en: 'Private patio with furniture', es: 'Patio privado con mobiliario', de: 'Private Terrasse mit Möbeln' },
    'amen.coffee': { fr: 'Cafetière + café offert', en: 'Coffee maker + complimentary coffee', es: 'Cafetera + café de regalo', de: 'Kaffeemaschine + Kaffee gratis' },
    'amen.fridge': { fr: 'Réfrigérateur + congélateur', en: 'Fridge + freezer', es: 'Nevera + congelador', de: 'Kühlschrank + Tiefkühlschrank' },
    'amen.shower': { fr: "Salle d'eau avec douche", en: 'Shower room', es: 'Cuarto de baño con ducha', de: 'Duschbad' },
    'amen.hairdryer': { fr: 'Sèche-cheveux', en: 'Hair dryer', es: 'Secador de pelo', de: 'Haartrockner' },
    'amen.checkin': { fr: 'Arrivée autonome (boîte à clés)', en: 'Self check-in (lockbox)', es: 'Entrada autónoma (caja de llaves)', de: 'Selbst-Check-in (Schlüsselbox)' },
    'amen.pets': { fr: 'Animaux acceptés', en: 'Pets allowed', es: 'Se admiten mascotas', de: 'Haustiere erlaubt' },
    'amen.parking': { fr: 'Parking payant à proximité', en: 'Paid parking nearby', es: 'Aparcamiento de pago cercano', de: 'Kostenpflichtiger Parkplatz in der Nähe' },
    'amen.smoke': { fr: 'Détecteur de fumée', en: 'Smoke detector', es: 'Detector de humo', de: 'Rauchmelder' },

    'gallery.studio': { fr: 'Le studio en images', en: 'The studio in pictures', es: 'El estudio en imágenes', de: 'Das Studio in Bildern' },
    'cap.night': { fr: 'Le coin nuit', en: 'Sleeping area', es: 'Zona de noche', de: 'Schlafbereich' },
    'cap.live': { fr: 'Pièce à vivre', en: 'Living area', es: 'Salón', de: 'Wohnbereich' },
    'cap.kitchen': { fr: 'Cuisine équipée', en: 'Equipped kitchen', es: 'Cocina equipada', de: 'Ausgestattete Küche' },
    'cap.yard': { fr: 'La cour', en: 'The courtyard', es: 'El patio', de: 'Der Hof' },
    'cap.bath': { fr: "Salle d'eau", en: 'Bathroom', es: 'Baño', de: 'Bad' },

    'why.h3': { fr: 'Pourquoi réserver <span class="it">en direct</span> ?', en: 'Why book <span class="it">direct</span>?', es: '¿Por qué reservar <span class="it">en directo</span>?', de: 'Warum <span class="it">direkt</span> buchen?' },
    'why.p': {
      fr: "En réservant ici plutôt que sur une plateforme, vous profitez d'un tarif plus doux et d'un échange direct pour adapter votre séjour.",
      en: 'By booking here instead of on a platform, you get a softer rate and direct contact to tailor your stay.',
      es: 'Al reservar aquí en lugar de en una plataforma, disfrutas de una tarifa más suave y un contacto directo para adaptar tu estancia.',
      de: 'Wenn du hier statt über eine Plattform buchst, profitierst du von einem günstigeren Preis und direktem Kontakt für deinen Aufenthalt.'
    },
    'why.fees': { fr: 'frais de plateforme', en: 'platform fees', es: 'comisiones de plataforma', de: 'Plattformgebühren' },
    'why.direct': { fr: "avec l'hôte", en: 'with the host', es: 'con el anfitrión', de: 'mit dem Gastgeber' },
    'why.flex': { fr: 'sur mesure', en: 'tailored', es: 'a medida', de: 'maßgeschneidert' },
    'why.direct.label': { fr: 'Direct', en: 'Direct', es: 'Directo', de: 'Direkt' },
    'why.flex.label': { fr: 'Flexible', en: 'Flexible', es: 'Flexible', de: 'Flexibel' },

    'sec.aix.kicker': { fr: 'Aux alentours', en: 'Nearby', es: 'Alrededores', de: 'In der Nähe' },
    'sec.aix.h2': { fr: 'Aix-les-Bains, <span class="it">à vivre</span>', en: 'Aix-les-Bains, <span class="it">to experience</span>', es: 'Aix-les-Bains, <span class="it">para vivir</span>', de: 'Aix-les-Bains, <span class="it">erleben</span>' },
    'sec.aix.lede': {
      fr: 'Lac du Bourget, abbaye d’Hautecombe, thermes et montagnes — le meilleur d’Aix à portée de main.',
      en: 'Lake Bourget, Hautecombe Abbey, spas and mountains — the best of Aix within easy reach.',
      es: 'Lago del Bourget, abadía de Hautecombe, termas y montañas: lo mejor de Aix al alcance.',
      de: 'Lac du Bourget, Abtei Hautecombe, Thermen und Berge — das Beste von Aix in Reichweite.'
    },
    'cap.jardins': { fr: 'Jardins fleuris', en: 'Flower gardens', es: 'Jardines en flor', de: 'Blumenparks' },
    'cap.hautecombe': { fr: 'Abbaye d’Hautecombe', en: 'Hautecombe Abbey', es: 'Abadía de Hautecombe', de: 'Abtei Hautecombe' },
    'cap.casino': { fr: 'Casino Grand Cercle', en: 'Grand Cercle Casino', es: 'Casino Grand Cercle', de: 'Casino Grand Cercle' },
    'cap.mountains': { fr: 'Les montagnes en hiver', en: 'The mountains in winter', es: 'Las montañas en invierno', de: 'Die Berge im Winter' },

    'sec.avis.kicker': { fr: 'Avis des voyageurs', en: 'Guest reviews', es: 'Opiniones de viajeros', de: 'Gästebewertungen' },
    'sec.avis.h2': { fr: 'Ils ont <span class="it">adoré</span>', en: 'They <span class="it">loved</span> it', es: 'Les ha <span class="it">encantado</span>', de: 'Sie haben es <span class="it">geliebt</span>' },
    'sec.avis.summary': { fr: '5 avis vérifiés', en: '5 verified reviews', es: '5 reseñas verificadas', de: '5 verifizierte Bewertungen' },
    'sec.avis.google': { fr: 'Laisser un avis Google', en: 'Leave a Google review', es: 'Dejar una reseña en Google', de: 'Google-Bewertung hinterlassen' },
    'sec.avis.prev': { fr: 'Avis précédent', en: 'Previous review', es: 'Reseña anterior', de: 'Vorherige Bewertung' },
    'sec.avis.next': { fr: 'Avis suivant', en: 'Next review', es: 'Reseña siguiente', de: 'Nächste Bewertung' },
    'sec.avis.carousel': { fr: 'Avis des voyageurs', en: 'Guest reviews', es: 'Opiniones de viajeros', de: 'Gästebewertungen' },

    'sec.book.kicker': { fr: 'Disponibilités & réservation', en: 'Availability & booking', es: 'Disponibilidad y reserva', de: 'Verfügbarkeit & Buchung' },
    'sec.book.h2': { fr: 'Choisissez vos <span class="it">dates</span>', en: 'Choose your <span class="it">dates</span>', es: 'Elige tus <span class="it">fechas</span>', de: 'Wähle deine <span class="it">Daten</span>' },
    'sec.book.lede': {
      fr: 'Réservation en direct, sans frais de plateforme — confirmation immédiate.',
      en: 'Book direct, no platform fees — instant confirmation.',
      es: 'Reserva directa, sin comisiones de plataforma — confirmación inmediata.',
      de: 'Direktbuchung, ohne Plattformgebühren — sofortige Bestätigung.'
    },
    'sec.book.fallback': {
      fr: "Chargement du calendrier de réservation…<br><small>Si rien ne s'affiche, vérifiez votre connexion ou réessayez.</small>",
      en: 'Loading the booking calendar…<br><small>If nothing appears, check your connection or try again.</small>',
      es: 'Cargando el calendario de reservas…<br><small>Si no aparece nada, comprueba tu conexión o inténtalo de nuevo.</small>',
      de: 'Buchungskalender wird geladen…<br><small>Wenn nichts erscheint, prüfe deine Verbindung oder versuche es erneut.</small>'
    },
    'sec.book.fine': {
      fr: 'Paiement sécurisé par Stripe · confirmation immédiate · taxe de séjour en supplément.',
      en: 'Secure payment via Stripe · instant confirmation · tourist tax extra.',
      es: 'Pago seguro con Stripe · confirmación inmediata · tasa turística aparte.',
      de: 'Sichere Zahlung über Stripe · sofortige Bestätigung · Kurtaxe extra.'
    },
    'sec.book.airbnb': {
      fr: 'Vous préférez passer par Airbnb&nbsp;? <a href="https://www.airbnb.fr/h/labonneaventure" target="_blank" rel="noopener">Voir l’annonce</a>',
      en: 'Prefer Airbnb&nbsp;? <a href="https://www.airbnb.fr/h/labonneaventure" target="_blank" rel="noopener">View the listing</a>',
      es: '¿Prefieres Airbnb&nbsp;? <a href="https://www.airbnb.fr/h/labonneaventure" target="_blank" rel="noopener">Ver el anuncio</a>',
      de: 'Lieber über Airbnb&nbsp;? <a href="https://www.airbnb.fr/h/labonneaventure" target="_blank" rel="noopener">Zur Anzeige</a>'
    },
    'sec.book.whatsapp': {
      fr: 'Une question ? Écrivez-moi sur WhatsApp',
      en: 'A question? Message me on WhatsApp',
      es: '¿Una pregunta? Escríbeme por WhatsApp',
      de: 'Eine Frage? Schreib mir auf WhatsApp'
    },
    'footer.credit': {
      fr: 'La Bonne Aventure · Aix-les-Bains ·',
      en: 'La Bonne Aventure · Aix-les-Bains ·',
      es: 'La Bonne Aventure · Aix-les-Bains ·',
      de: 'La Bonne Aventure · Aix-les-Bains ·'
    },
    /* —— Extras —— */
    'extras.kicker': { fr: 'Petits plus', en: 'Little extras', es: 'Pequeños extras', de: 'Kleine Extras' },
    'extras.h2': { fr: 'Vos <span class="it">extras</span>', en: 'Your <span class="it">extras</span>', es: 'Tus <span class="it">extras</span>', de: 'Deine <span class="it">Extras</span>' },
    'extras.lede': {
      fr: 'Prolongez le plaisir\u00a0: réservez et payez vos options en ligne, en quelques secondes.',
      en: 'Extend the pleasure: book and pay for your options online in seconds.',
      es: 'Prolonga el placer: reserva y paga tus opciones en línea en unos segundos.',
      de: 'Verlängere den Genuss: buche und bezahle deine Optionen online in Sekunden.'
    },
    'extras.loading': { fr: 'Chargement des extras…', en: 'Loading extras…', es: 'Cargando extras…', de: 'Extras werden geladen…' },
    'extras.how': {
      fr: '<b>Comment ça marche\u00a0?</b> Choisissez votre extra et réglez en ligne — paiement sécurisé par Stripe. Votre confirmation vous est envoyée par email dans la foulée. La disponibilité des arrivées anticipées et départs tardifs est vérifiée <b>automatiquement</b> selon la date.',
      en: '<b>How does it work?</b> Choose your extra and pay online — secure Stripe payment. Confirmation is emailed right away. Early check-in and late check-out availability is checked <b>automatically</b> for your date.',
      es: '<b>¿Cómo funciona?</b> Elige tu extra y paga en línea — pago seguro con Stripe. La confirmación se envía por email de inmediato. La disponibilidad de llegadas anticipadas y salidas tardías se verifica <b>automáticamente</b> según la fecha.',
      de: '<b>Wie funktioniert’s?</b> Wähle dein Extra und zahle online — sichere Stripe-Zahlung. Die Bestätigung kommt sofort per E-Mail. Die Verfügbarkeit von frühem Check-in und spätem Check-out wird <b>automatisch</b> für dein Datum geprüft.'
    },

    /* —— Account —— */
    'acct.kicker': { fr: 'Espace voyageur', en: 'Guest area', es: 'Espacio viajero', de: 'Gästebereich' },
    'acct.h2': { fr: 'Vos réservations & <span class="it">votre fidélité</span>', en: 'Your bookings & <span class="it">loyalty</span>', es: 'Tus reservas y <span class="it">fidelidad</span>', de: 'Deine Buchungen & <span class="it">Treue</span>' },
    'acct.lede': {
      fr: "Retrouvez vos séjours et vos points fidélité avec l'email utilisé à la réservation.",
      en: 'Find your stays and loyalty points with the email used at booking.',
      es: 'Consulta tus estancias y puntos de fidelidad con el email usado al reservar.',
      de: 'Finde deine Aufenthalte und Treuepunkte mit der E-Mail aus der Buchung.'
    },
    'acct.email': { fr: 'Votre email', en: 'Your email', es: 'Tu email', de: 'Deine E-Mail' },
    'acct.login': { fr: 'Recevoir mon lien de connexion', en: 'Send me a login link', es: 'Recibir mi enlace de acceso', de: 'Login-Link senden' },
    'acct.hint': {
      fr: 'Aucun mot de passe : vous recevrez un lien de connexion à usage unique par email, valable 15 minutes.',
      en: 'No password: you’ll get a one-time login link by email, valid for 15 minutes.',
      es: 'Sin contraseña: recibirás un enlace de acceso de un solo uso por email, válido 15 minutos.',
      de: 'Kein Passwort: du erhältst einen einmaligen Login-Link per E-Mail, 15 Minuten gültig.'
    },
    'acct.hello': { fr: 'Bonjour,', en: 'Hello,', es: 'Hola,', de: 'Hallo,' },
    'acct.logout': { fr: 'Se déconnecter', en: 'Log out', es: 'Cerrar sesión', de: 'Abmelden' },
    'acct.loyalty': { fr: 'Programme fidélité', en: 'Loyalty programme', es: 'Programa de fidelidad', de: 'Treueprogramm' },
    'acct.points': { fr: 'points', en: 'points', es: 'puntos', de: 'Punkte' },
    'acct.stays': { fr: 'Vos séjours', en: 'Your stays', es: 'Tus estancias', de: 'Deine Aufenthalte' },
    'acct.pending.title': { fr: 'Séjour en attente', en: 'Pending stay', es: 'Estancia pendiente', de: 'Ausstehender Aufenthalt' },
    'acct.pending.body': {
      fr: 'Les dates sont bloquées 3\u00a0h pour les autres. Après, elles se libèrent — finalisez le paiement pour confirmer.',
      en: 'Dates are held for 3\u00a0h for others. Then they free up — finish payment to confirm.',
      es: 'Las fechas se bloquean 3\u00a0h para los demás. Luego se liberan: finaliza el pago para confirmar.',
      de: 'Die Daten sind 3\u00a0Std. für andere blockiert. Danach werden sie frei — schließe die Zahlung ab, um zu bestätigen.'
    },
    'acct.empty': { fr: 'Aucune réservation trouvée pour cet email.', en: 'No booking found for this email.', es: 'No se encontró ninguna reserva para este email.', de: 'Keine Buchung für diese E-Mail gefunden.' },
    'acct.cta': { fr: 'Réserver un séjour', en: 'Book a stay', es: 'Reservar una estancia', de: 'Aufenthalt buchen' },

    /* —— Booking widget —— */
    'bw.loading': { fr: 'Chargement du calendrier…', en: 'Loading calendar…', es: 'Cargando calendario…', de: 'Kalender wird geladen…' },
    'bw.unavailable': { fr: 'Le calendrier est momentanément indisponible.', en: 'The calendar is temporarily unavailable.', es: 'El calendario no está disponible por el momento.', de: 'Der Kalender ist vorübergehend nicht verfügbar.' },
    'bw.unavailableHint': { fr: 'Réessayez dans un instant, ou écrivez-nous sur WhatsApp.', en: 'Try again in a moment, or message us on WhatsApp.', es: 'Inténtalo de nuevo en un momento o escríbenos por WhatsApp.', de: 'Versuche es gleich noch einmal oder schreib uns auf WhatsApp.' },
    'bw.retry': { fr: 'Réessayer', en: 'Try again', es: 'Reintentar', de: 'Erneut versuchen' },
    'bw.confirmed': { fr: 'Merci ! Votre réservation est confirmée — un email vient de vous être envoyé.', en: 'Thank you! Your booking is confirmed — an email has just been sent.', es: '¡Gracias! Tu reserva está confirmada: te acabamos de enviar un email.', de: 'Danke! Deine Buchung ist bestätigt — eine E-Mail wurde soeben gesendet.' },
    'bw.cancelled': { fr: 'Paiement annulé — vos dates n’ont pas été réservées. Vous pouvez réessayer.', en: 'Payment cancelled — your dates were not booked. You can try again.', es: 'Pago cancelado: tus fechas no se han reservado. Puedes intentarlo de nuevo.', de: 'Zahlung abgebrochen — deine Daten wurden nicht gebucht. Du kannst es erneut versuchen.' },
    'bw.prevMonth': { fr: 'Mois précédent', en: 'Previous month', es: 'Mes anterior', de: 'Vorheriger Monat' },
    'bw.nextMonth': { fr: 'Mois suivant', en: 'Next month', es: 'Mes siguiente', de: 'Nächster Monat' },
    'bw.free': { fr: 'Libre', en: 'Available', es: 'Libre', de: 'Frei' },
    'bw.sel': { fr: 'Votre séjour', en: 'Your stay', es: 'Tu estancia', de: 'Dein Aufenthalt' },
    'bw.busy': { fr: 'Occupé', en: 'Booked', es: 'Ocupado', de: 'Belegt' },
    'bw.arrival': { fr: 'Arrivée', en: 'Check-in', es: 'Llegada', de: 'Anreise' },
    'bw.departure': { fr: 'Départ', en: 'Check-out', es: 'Salida', de: 'Abreise' },
    'bw.total': { fr: 'Total', en: 'Total', es: 'Total', de: 'Gesamt' },
    'bw.promo': { fr: 'Code promo', en: 'Promo code', es: 'Código promo', de: 'Aktionscode' },
    'bw.apply': { fr: 'Appliquer', en: 'Apply', es: 'Aplicar', de: 'Anwenden' },
    'bw.name': { fr: 'Nom complet', en: 'Full name', es: 'Nombre completo', de: 'Vollständiger Name' },
    'bw.email': { fr: 'Email', en: 'Email', es: 'Email', de: 'E-Mail' },
    'bw.phone': { fr: 'Téléphone', en: 'Phone', es: 'Teléfono', de: 'Telefon' },
    'bw.guests': { fr: 'Voyageurs', en: 'Guests', es: 'Viajeros', de: 'Gäste' },
    'bw.pay': { fr: 'Réserver et payer', en: 'Book and pay', es: 'Reservar y pagar', de: 'Buchen und zahlen' },
    'bw.redirect': { fr: 'Redirection…', en: 'Redirecting…', es: 'Redirigiendo…', de: 'Weiterleitung…' },
    'bw.secure': { fr: 'Paiement sécurisé par Stripe · confirmation immédiate', en: 'Secure payment via Stripe · instant confirmation', es: 'Pago seguro con Stripe · confirmación inmediata', de: 'Sichere Zahlung über Stripe · sofortige Bestätigung' },
    'bw.caution': {
      fr: 'Caution de {amount} — simple empreinte bancaire, <b>non débitée</b>, sauf en cas de dégât.',
      en: 'Security deposit of {amount} — card hold only, <b>not charged</b>, except in case of damage.',
      es: 'Fianza de {amount}: solo huella bancaria, <b>no se cobra</b>, salvo en caso de daños.',
      de: 'Kaution von {amount} — nur Kartenvormerkung, <b>nicht belastet</b>, außer bei Schäden.'
    },
    'bw.err.name': { fr: 'Merci d’indiquer votre nom.', en: 'Please enter your name.', es: 'Indica tu nombre.', de: 'Bitte gib deinen Namen an.' },
    'bw.err.email': { fr: 'Merci d’indiquer un email valide.', en: 'Please enter a valid email.', es: 'Indica un email válido.', de: 'Bitte gib eine gültige E-Mail an.' },
    'bw.months': {
      fr: 'Janvier,Février,Mars,Avril,Mai,Juin,Juillet,Août,Septembre,Octobre,Novembre,Décembre',
      en: 'January,February,March,April,May,June,July,August,September,October,November,December',
      es: 'Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre',
      de: 'Januar,Februar,März,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember'
    },
    'bw.dow': {
      fr: 'Lu,Ma,Me,Je,Ve,Sa,Di',
      en: 'Mo,Tu,We,Th,Fr,Sa,Su',
      es: 'Lu,Ma,Mi,Ju,Vi,Sá,Do',
      de: 'Mo,Di,Mi,Do,Fr,Sa,So'
    },

    'lang.label': { fr: 'Langue', en: 'Language', es: 'Idioma', de: 'Sprache' }
  };

  var state = { lang: 'fr', ready: false };

  function detect() {
    try {
      var saved = localStorage.getItem('lba_lang');
      if (saved && LANGS.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    var nav = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
    if (nav.indexOf('es') === 0) return 'es';
    if (nav.indexOf('de') === 0) return 'de';
    if (nav.indexOf('en') === 0) return 'en';
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

  function apply() {
    document.documentElement.lang = state.lang;
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
    try { localStorage.setItem('lba_lang', lang); } catch (e) {}
    apply();
  }

  function switcherHTML(compact) {
    var bits = LANGS.map(function (l) {
      return '<button type="button" class="lba-lang-btn" data-lba-lang="' + l + '" aria-label="' + NAMES[l] + '">' + LABELS[l] + '</button>';
    }).join('');
    return '<div class="lba-lang' + (compact ? ' lba-lang-compact' : '') + '" role="group" aria-label="' + t('lang.label') + '">' + bits + '</div>';
  }

  function mountSwitcher(target) {
    if (!target) return;
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target) return;
    target.innerHTML = switcherHTML(target.hasAttribute('data-compact'));
    target.querySelectorAll('[data-lba-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lba-lang')); });
    });
    apply();
  }

  function mount() {
    state.lang = detect();
    document.querySelectorAll('[data-lba-switcher]').forEach(mountSwitcher);
    // Auto-wire buttons if switcher already in DOM
    document.querySelectorAll('[data-lba-lang]').forEach(function (btn) {
      if (btn._lbaBound) return;
      btn._lbaBound = true;
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lba-lang')); });
    });
    apply();
    state.ready = true;
  }

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
    switcherHTML: switcherHTML
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
