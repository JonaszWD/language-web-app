// Seven-stage grammar lessons for the A2-C1 syllabus (the A1 lessons live
// inline in GrammarScreen). Each spec drives the same flow:
//   1 Notice      — tap the letters of the highlighted part (stem + end; only
//                   `end` must be highlighted), then a reflect question.
//   2 Rule        — "label stem___": type the missing `end`.
//   3 Structured  — multiple choice on a sentence.
//   4 Controlled  — table (type `end`; `stem + end` is shown as the fix), then
//                   fill-in-the-blank sentences.
//   5 Mixed       — shuffled blanks.
//   6 Produce     — free writing, graded by the AI checker.
//   7 Spaced      — re-tests on a day 1/3/7/14 schedule.
// Answers are compared accent- and punctuation-insensitively.

export type SsRow = { pron: string; stem: string; end: string; tail: string };
export type SsTableItem = { label: string; stem: string; end: string };
export type PtWhoItem = { es: string; options: string[]; answer: number };
export type PtBlank = { before: string; verb: string; after: string; answer: string; note?: string };
export type ProducePrompt = { focus: string; produce: { prompt: string; en: string; instruction: string } };

export type SevenStageSpec = {
  id: string;
  topic: string;
  noticeHint: string;
  noticeRows: SsRow[];
  reflectQ: string;
  reflectReveal: string;
  ruleHint: string;
  ruleItems: SsTableItem[];
  structuredHint: string;
  structuredItems: PtWhoItem[];
  structuredLastLabel: string;
  controlledTableHint: string;
  controlledTableItems: SsTableItem[];
  controlledTablePlaceholder: string;
  controlledNextLabel: string;
  controlledBlanksHeading: string;
  controlledBlanks: PtBlank[];
  mixedBlanks: PtBlank[];
  producePrompts: ProducePrompt[];
  conversationHint: string;
};

// ── compact builders ────────────────────────────────────────────────
const r = (pron: string, stem: string, end: string, tail: string): SsRow => ({ pron, stem, end, tail });
const t = (label: string, stem: string, end: string): SsTableItem => ({ label, stem, end });
const q = (es: string, options: string[], answer: number): PtWhoItem => ({ es, options, answer });
const b = (before: string, verb: string, after: string, answer: string): PtBlank => ({ before, verb, after, answer });
const p = (prompt: string, en: string, instruction: string) => ({ prompt, en, instruction });

type LessonInput = Omit<
  SevenStageSpec,
  "topic" | "structuredLastLabel" | "controlledTablePlaceholder" | "controlledNextLabel" | "producePrompts"
> & {
  producePrompts: ProducePrompt["produce"][];
  structuredLastLabel?: string;
  controlledTablePlaceholder?: string;
  controlledNextLabel?: string;
};

function lesson(topic: string, spec: LessonInput): [string, SevenStageSpec] {
  return [topic, {
    structuredLastLabel: "Start controlled practice",
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now use it in sentences",
    ...spec,
    topic,
    producePrompts: spec.producePrompts.map((produce) => ({ focus: topic, produce })),
  }];
}

export const ADVANCED_SEVEN_STAGE_LESSONS: Record<string, SevenStageSpec> = Object.fromEntries([
  /* ═══════════════════════════════ A2 ═══════════════════════════════ */
  lesson("Preterite tense (regular + common irregulars)", {
    id: "preterite",
    noticeHint: "These all happened yesterday — finished actions. Look at how each verb ends.",
    noticeRows: [
      r("Ayer yo", "habl", "é", "con mi madre."),
      r("Ayer ella", "com", "ió", "paella."),
      r("Ayer nosotros", "viv", "imos", "una aventura."),
      r("Ayer ellos", "trabaj", "aron", "mucho."),
      r("Ayer yo", "fu", "i", "al cine."),
    ],
    reflectQ: "The yo and él endings carry an accent. What are they for -ar verbs, and for -er/-ir?",
    reflectReveal: "-ar: -é, -aste, -ó, -amos, -asteis, -aron. -er/-ir share: -í, -iste, -ió, -imos, -isteis, -ieron. Common irregulars: ir/ser → fui, fue, fueron; hacer → hice, hizo; tener → tuve; estar → estuve.",
    ruleHint: "Type the preterite ending:",
    ruleItems: [
      t("yo", "habl", "é"), t("tú", "habl", "aste"), t("él", "com", "ió"),
      t("nosotros", "escrib", "imos"), t("ellos", "trabaj", "aron"), t("ellas", "beb", "ieron"),
    ],
    structuredHint: "Which one is a finished action in the past?",
    structuredItems: [
      q("___ a Madrid el año pasado.", ["Voy", "Fui", "Iré"], 1),
      q("Ayer ella ___ una carta.", ["escribió", "escribe", "escribía"], 0),
      q("¿Qué ___ tú el sábado?", ["haces", "hiciste", "hizo"], 1),
      q("Nosotros ___ en casa anoche.", ["estamos", "estuvimos", "estuvieron"], 1),
    ],
    controlledTableHint: "Write the preterite form:",
    controlledTableItems: [
      t("hablar (yo)", "", "hablé"), t("comer (él)", "", "comió"), t("vivir (nosotros)", "", "vivimos"),
      t("ir (yo)", "", "fui"), t("hacer (ella)", "", "hizo"), t("tener (yo)", "", "tuve"),
    ],
    controlledBlanksHeading: "Regular verbs",
    controlledBlanks: [
      b("Ayer yo ", "comprar", " pan.", "compré"),
      b("Mis amigos ", "llegar", " tarde.", "llegaron"),
      b("¿Tú ", "abrir", " la ventana?", "abriste"),
    ],
    mixedBlanks: [
      b("El lunes ", "ir — nosotros", " al museo.", "fuimos"),
      b("Ella ", "hacer", " la cena.", "hizo"),
      b("Yo ", "estar", " enfermo dos días.", "estuve"),
      b("Ellos ", "vender", " su coche.", "vendieron"),
      b("¿Qué ", "decir — tú", "?", "dijiste"),
      b("Anoche yo ", "llamar", " a mi abuela.", "llamé"),
    ],
    producePrompts: [
      p("¿Qué hiciste el fin de semana pasado?", "What did you do last weekend?", "Write 4-5 sentences in the preterite, including at least one irregular verb."),
      p("Cuenta tu último viaje.", "Describe your last trip.", "Use at least five preterite verbs: where you went, what you did, what you ate."),
      p("Describe un día desastroso.", "Describe a disastrous day.", "Tell what went wrong, step by step, in the preterite."),
    ],
    conversationHint: "In the Speaking tab, tell your partner about yesterday from start to finish — every action in the preterite.",
  }),

  lesson("Imperfect tense (introduced)", {
    id: "imperfect",
    noticeHint: "These describe how things used to be — habits and background. Look at the verb endings.",
    noticeRows: [
      r("De niño, yo", "jug", "aba", "en el parque."),
      r("Mi abuela", "viv", "ía", "en un pueblo."),
      r("Nosotros", "com", "íamos", "juntos los domingos."),
      r("Ellos siempre", "habl", "aban", "en voz alta."),
      r("La casa", "er", "a", "muy grande."),
    ],
    reflectQ: "What ending do -ar verbs use? And -er/-ir?",
    reflectReveal: "-ar: -aba, -abas, -aba, -ábamos, -abais, -aban. -er/-ir: -ía, -ías, -ía, -íamos, -íais, -ían. Only three irregulars: ser (era), ir (iba), ver (veía). Use it for habits, descriptions and 'used to'.",
    ruleHint: "Type the imperfect ending:",
    ruleItems: [
      t("yo", "jug", "aba"), t("tú", "estudi", "abas"), t("ella", "ten", "ía"),
      t("nosotros", "viv", "íamos"), t("ellos", "cant", "aban"), t("vosotros", "com", "íais"),
    ],
    structuredHint: "Pick the form that describes a past habit or background:",
    structuredItems: [
      q("Cuando era pequeño, ___ mucho chocolate.", ["comí", "comía", "como"], 1),
      q("Antes nosotros ___ en Sevilla.", ["vivíamos", "vivimos", "viviremos"], 0),
      q("Mi padre siempre ___ al trabajo en bici.", ["fue", "iba", "va"], 1),
      q("La playa ___ muy bonita.", ["era", "fue", "es"], 0),
    ],
    controlledTableHint: "Write the imperfect form:",
    controlledTableItems: [
      t("hablar (yo)", "", "hablaba"), t("tener (tú)", "", "tenías"), t("vivir (ella)", "", "vivía"),
      t("ser (nosotros)", "", "éramos"), t("ir (ellos)", "", "iban"), t("ver (yo)", "", "veía"),
    ],
    controlledBlanksHeading: "Habits",
    controlledBlanks: [
      b("Todos los veranos ", "ir — nosotros", " a la playa.", "íbamos"),
      b("Mi madre ", "cocinar", " muy bien.", "cocinaba"),
      b("Yo ", "leer", " cómics cada noche.", "leía"),
    ],
    mixedBlanks: [
      b("Mi primer coche ", "ser", " rojo.", "era"),
      b("Los niños ", "jugar", " en la calle.", "jugaban"),
      b("¿Dónde ", "vivir — tú", " antes?", "vivías"),
      b("Nosotros no ", "tener", " televisión.", "teníamos"),
      b("Yo siempre ", "ver", " dibujos los sábados.", "veía"),
      b("Ella ", "trabajar", " en un banco.", "trabajaba"),
    ],
    producePrompts: [
      p("¿Cómo era tu vida cuando tenías diez años?", "What was your life like at ten?", "Write 4-5 sentences in the imperfect about your habits and surroundings."),
      p("Describe la casa de tus abuelos.", "Describe your grandparents' house.", "Use era, había, tenía and at least two other imperfect verbs."),
      p("¿Qué hacías los veranos de niño?", "What did you do in the summers as a child?", "Describe at least four repeated activities."),
    ],
    conversationHint: "In the Speaking tab, describe your childhood town — what it was like and what people used to do.",
  }),

  lesson("Direct object pronouns", {
    id: "dop",
    noticeHint: "The pronoun replaces the thing being bought, seen or called. Find it.",
    noticeRows: [
      r("¿El libro? Sí,", "", "lo", "compro."),
      r("¿La película? Ya", "", "la", "vi."),
      r("¿Los zapatos?", "", "Los", "llevo hoy."),
      r("¿Las llaves? No", "", "las", "encuentro."),
      r("Mi madre", "", "me", "llama cada día."),
    ],
    reflectQ: "Where does the pronoun go? And how does it choose lo/la/los/las?",
    reflectReveal: "It goes before the conjugated verb (lo compro). It matches the noun: lo (masc.), la (fem.), los, las (plural). Me, te, nos, os for people. With an infinitive it can attach: voy a comprarlo.",
    ruleHint: "Type the direct object pronoun:",
    ruleItems: [
      t("el café →", "", "lo"), t("la sopa →", "", "la"), t("los libros →", "", "los"),
      t("las fotos →", "", "las"), t("a mí →", "", "me"), t("a nosotros →", "", "nos"),
    ],
    structuredHint: "Pick the pronoun that replaces the object:",
    structuredItems: [
      q("¿Tienes el pasaporte? Sí, ___ tengo.", ["la", "lo", "le"], 1),
      q("¿Compras las manzanas? Sí, ___ compro.", ["los", "las", "la"], 1),
      q("¿Ves a María? No, no ___ veo.", ["la", "lo", "le"], 0),
      q("¿Me llamas mañana? Sí, ___ llamo.", ["me", "te", "lo"], 1),
    ],
    controlledTableHint: "Replace the object with a pronoun (just the pronoun):",
    controlledTableItems: [
      t("Leo el periódico.", "", "lo"), t("Bebo la leche.", "", "la"), t("Lavo los platos.", "", "los"),
      t("Abro las ventanas.", "", "las"), t("Veo a Juan.", "", "lo"), t("Invito a Ana y Eva.", "", "las"),
    ],
    controlledBlanksHeading: "In sentences",
    controlledBlanks: [
      b("¿La tarta? ", "I make it", " yo.", "La hago"),
      b("¿Los billetes? ", "I have them", ".", "Los tengo"),
      b("¿El coche? No ", "I need it", ".", "lo necesito"),
    ],
    mixedBlanks: [
      b("¿Las gafas? ", "I'm looking for them", ".", "Las busco"),
      b("¿El tren? ", "We take it", " a las ocho.", "Lo tomamos"),
      b("¿Me ayudas? Sí, ", "I help you", ".", "te ayudo"),
      b("¿La cuenta? ", "I'll pay it", " yo.", "La pago"),
      b("¿Los niños? ", "I see them", " en el parque.", "Los veo"),
      b("Voy a ", "buy it — el regalo", " mañana.", "comprarlo"),
    ],
    producePrompts: [
      p("¿Qué haces con tus cosas por la mañana?", "What do you do with your things in the morning?", "Write 4 sentences replacing objects with lo/la/los/las (e.g. ¿El café? Lo bebo...)."),
      p("Prepara la maleta con un amigo.", "Pack a suitcase with a friend.", "Write a short dialogue: ¿Tienes el pasaporte? — Sí, lo tengo. Use at least four pronouns."),
      p("¿Quién te ayuda en tu vida?", "Who helps you in your life?", "Use me/te/nos with at least three verbs (me llama, me ayuda...)."),
    ],
    conversationHint: "In the Speaking tab, plan a party: when your partner asks about each item, answer with lo/la/los/las instead of repeating the noun.",
  }),

  lesson("Possessive adjectives/pronouns", {
    id: "possessives",
    noticeHint: "Look at the word that says whose it is. What makes it change?",
    noticeRows: [
      r("Es", "m", "i", "libro."),
      r("Son", "m", "is", "libros."),
      r("Es", "nuestr", "a", "casa."),
      r("Son", "nuestr", "os", "amigos."),
      r("Este libro es", "mí", "o", "."),
    ],
    reflectQ: "Does the possessive agree with the owner or with the thing owned?",
    reflectReveal: "With the thing owned: mi libro → mis libros; nuestra casa → nuestros amigos. Before the noun: mi, tu, su, nuestro/a, vuestro/a, su. After it or alone (pronouns): mío, tuyo, suyo, nuestro — es mío, la tuya.",
    ruleHint: "Make the possessive agree with the noun:",
    ruleItems: [
      t("(my) libros →", "m", "is"), t("(your) casa →", "t", "u"), t("(our) coche →", "nuestr", "o"),
      t("(our) hijas →", "nuestr", "as"), t("(their) padres →", "su", "s"), t("(mine) la maleta es", "mí", "a"),
    ],
    structuredHint: "Pick the correct possessive:",
    structuredItems: [
      q("Ellos visitan a ___ abuelos.", ["su", "sus", "suyos"], 1),
      q("¿Es ___ móvil? — Sí, es mío.", ["tu", "tú", "tuyo"], 0),
      q("Estas llaves son ___.", ["mis", "mías", "mi"], 1),
      q("___ profesora es muy simpática.", ["Nuestro", "Nuestra", "Nuestras"], 1),
    ],
    controlledTableHint: "Write the possessive:",
    controlledTableItems: [
      t("my keys", "", "mis"), t("your (tú) car", "", "tu"), t("our city", "", "nuestra"),
      t("her friends", "", "sus"), t("It's mine (el libro)", "", "mío"), t("It's yours (la casa, tú)", "", "tuya"),
    ],
    controlledBlanksHeading: "Before the noun",
    controlledBlanks: [
      b("", "my", " hermanos viven en Lima.", "Mis"),
      b("¿Dónde está ", "your (tú)", " maleta?", "tu"),
      b("", "our", " vecinos son ruidosos.", "Nuestros"),
    ],
    mixedBlanks: [
      b("Esta chaqueta no es ", "mine", ".", "mía"),
      b("¿Son ", "yours (tú)", " estos zapatos?", "tuyos"),
      b("Ana y ", "her", " padres comen juntos.", "sus"),
      b("", "our", " clase empieza a las nueve.", "Nuestra"),
      b("Mi coche es azul; ", "his", " es rojo.", "el suyo"),
      b("Llamo a ", "my", " abuela.", "mi"),
    ],
    producePrompts: [
      p("Describe a tu familia.", "Describe your family.", "Use mi/mis, su/sus and nuestro/a at least once each."),
      p("Hay cosas perdidas en clase. ¿De quién son?", "There are lost things in class. Whose are they?", "Write a dialogue using mío, tuyo, suyo (¿Es tuyo? — No, es suyo)."),
      p("Compara tu casa con la de un amigo.", "Compare your house with a friend's.", "Use la mía, la suya, nuestra/s."),
    ],
    conversationHint: "In the Speaking tab, talk about your family and your partner's — practise mi/tu/su and mío/tuyo/suyo.",
  }),

  lesson("Demonstratives", {
    id: "demonstratives",
    noticeHint: "These point at things near or far. Watch how the ending changes.",
    noticeRows: [
      r("", "est", "e", "libro es mío."),
      r("", "est", "a", "mesa es nueva."),
      r("", "es", "os", "zapatos son caros."),
      r("", "aquell", "as", "montañas son altas."),
      r("", "aquel", "", "chico es mi primo."),
    ],
    reflectQ: "What do este, ese and aquel mean — and what changes the ending?",
    reflectReveal: "este = this (near me), ese = that (near you), aquel = that over there. They agree with the noun: este/esta/estos/estas, ese/esa/esos/esas, aquel/aquella/aquellos/aquellas. Esto/eso/aquello = this/that thing (unknown or abstract).",
    ruleHint: "Make the demonstrative agree:",
    ruleItems: [
      t("(this) camisa →", "est", "a"), t("(these) libros →", "est", "os"), t("(that) coche →", "es", "e"),
      t("(those) flores →", "es", "as"), t("(that over there) casa →", "aquell", "a"), t("(those over there) árboles →", "aquell", "os"),
    ],
    structuredHint: "Pick the right demonstrative:",
    structuredItems: [
      q("___ pantalones son muy cómodos (aquí).", ["Este", "Estos", "Estas"], 1),
      q("¿Qué es ___? (una cosa desconocida)", ["eso", "ese", "esa"], 0),
      q("___ montaña de allí es preciosa.", ["Aquel", "Aquella", "Aquellos"], 1),
      q("¿Te gusta ___ chaqueta que llevas?", ["esa", "ese", "aquel"], 0),
    ],
    controlledTableHint: "Write the demonstrative:",
    controlledTableItems: [
      t("this (el bolso)", "", "este"), t("these (las gafas)", "", "estas"), t("that (la puerta)", "", "esa"),
      t("those (los niños)", "", "esos"), t("that over there (el edificio)", "", "aquel"), t("this thing", "", "esto"),
    ],
    controlledBlanksHeading: "Near and far",
    controlledBlanks: [
      b("Quiero ", "this", " camiseta.", "esta"),
      b("", "those", " uvas parecen buenas.", "Esas"),
      b("", "that over there", " restaurante es famoso.", "Aquel"),
    ],
    mixedBlanks: [
      b("¿Cuánto cuestan ", "these", " zapatos?", "estos"),
      b("No entiendo ", "that (thing)", ".", "eso"),
      b("", "those over there", " casas son antiguas.", "Aquellas"),
      b("", "this", " café está frío.", "Este"),
      b("¿Es tuya ", "that", " maleta?", "esa"),
      b("", "this (thing)", " es increíble.", "Esto"),
    ],
    producePrompts: [
      p("Estás en una tienda de ropa.", "You're in a clothes shop.", "Write 4 sentences pointing at items near and far: este, ese, aquel."),
      p("Describe una foto de tu ciudad.", "Describe a photo of your city.", "Use at least three different demonstratives."),
      p("En el mercado, elige fruta.", "At the market, choose fruit.", "Write a short dialogue with the seller using estos/esas/aquellos."),
    ],
    conversationHint: "In the Speaking tab, go shopping: point out what you want with este, ese and aquel.",
  }),

  lesson("Comparatives and superlatives", {
    id: "comparatives",
    noticeHint: "These sentences compare things. Find the comparing words.",
    noticeRows: [
      r("Madrid es", "", "más", "grande que Toledo."),
      r("El tren es", "", "menos", "caro que el avión."),
      r("Ana es", "", "tan", "alta como Luis."),
      r("Este es", "", "el más", "barato de todos."),
      r("Mi coche es", "", "mejor", "que el tuyo."),
    ],
    reflectQ: "How do you say more than, less than and as ... as? And the most?",
    reflectReveal: "más + adj + que, menos + adj + que, tan + adj + como. Superlative: el/la/los/las + más + adj + de. Irregulars: bueno → mejor, malo → peor, grande (age) → mayor, pequeño (age) → menor.",
    ruleHint: "Type the missing word:",
    ruleItems: [
      t("Es más alto ___", "", "que"), t("Es tan rápido ___", "", "como"), t("bueno → (better)", "", "mejor"),
      t("malo → (worse)", "", "peor"), t("Es el más alto ___ la clase", "", "de"), t("(older) mi hermano ___", "", "mayor"),
    ],
    structuredHint: "Pick the correct comparison:",
    structuredItems: [
      q("Este libro es ___ interesante que la película.", ["más", "tan", "mejor"], 0),
      q("Mi hermana es tan alta ___ yo.", ["que", "como", "de"], 1),
      q("Es el restaurante más caro ___ la ciudad.", ["que", "en", "de"], 2),
      q("Esta pizza es ___ que la otra (good).", ["más buena", "mejor", "buenísima"], 1),
    ],
    controlledTableHint: "Write the missing comparative word(s):",
    controlledTableItems: [
      t("more expensive than → más caro ___", "", "que"), t("as cheap as → tan barato ___", "", "como"), t("better", "", "mejor"),
      t("worse", "", "peor"), t("younger (sibling)", "", "menor"), t("the tallest → el ___ alto", "", "más"),
    ],
    controlledBlanksHeading: "Comparing",
    controlledBlanks: [
      b("El metro es ", "faster than", " el autobús.", "más rápido que"),
      b("Hoy hace ", "as hot as", " ayer.", "tanto calor como"),
      b("Tu idea es ", "better than", " la mía.", "mejor que"),
    ],
    mixedBlanks: [
      b("Es ", "the most beautiful", " playa de España.", "la más bonita"),
      b("Mi abuelo es ", "older than", " mi abuela.", "mayor que"),
      b("Este hotel es ", "less comfortable than", " el otro.", "menos cómodo que"),
      b("Ella canta ", "as well as", " su madre.", "tan bien como"),
      b("Es ", "the worst", " día de mi vida.", "el peor"),
      b("Los gatos son ", "smaller than", " los perros.", "más pequeños que"),
    ],
    producePrompts: [
      p("Compara dos ciudades que conoces.", "Compare two cities you know.", "Use más...que, menos...que and tan...como."),
      p("¿Quién es el más... de tu familia?", "Who is the most... in your family?", "Write 4 superlative sentences (el más alto de...)."),
      p("Compara tu móvil con uno antiguo.", "Compare your phone with an old one.", "Use mejor and peor at least once."),
    ],
    conversationHint: "In the Speaking tab, debate which city is better for a holiday — compare everything you can.",
  }),

  lesson("Ir + a + infinitive (near future)", {
    id: "irainf",
    noticeHint: "These are plans. Find the three-part structure.",
    noticeRows: [
      r("Mañana", "", "voy a", "estudiar."),
      r("¿Qué", "", "vas a", "hacer?"),
      r("Ella", "", "va a", "viajar a Perú."),
      r("Nosotros", "", "vamos a", "cenar fuera."),
      r("Ellos", "", "van a", "llegar tarde."),
    ],
    reflectQ: "Which part changes with the person, and which part never changes?",
    reflectReveal: "ir conjugates (voy, vas, va, vamos, vais, van) + a + infinitive (unchanged). It's the everyday way to talk about plans: Voy a llamar a mi madre.",
    ruleHint: "Type the form of ir:",
    ruleItems: [
      t("yo ___ a comer", "", "voy"), t("tú ___ a salir", "", "vas"), t("él ___ a dormir", "", "va"),
      t("nosotros ___ a bailar", "", "vamos"), t("vosotros ___ a ver", "", "vais"), t("ellos ___ a jugar", "", "van"),
    ],
    structuredHint: "Pick the correct plan:",
    structuredItems: [
      q("Esta noche yo ___ ver una película.", ["voy a", "voy", "va a"], 0),
      q("¿Vosotros ___ a venir?", ["vais", "vamos", "van"], 0),
      q("Mañana va a ___.", ["llueve", "llover", "llovió"], 1),
      q("Nosotros ___ a comprar pan.", ["vamos", "van", "voy"], 0),
    ],
    controlledTableHint: "Write the full near-future form:",
    controlledTableItems: [
      t("I'm going to eat", "", "voy a comer"), t("you're going to read", "", "vas a leer"), t("she's going to work", "", "va a trabajar"),
      t("we're going to travel", "", "vamos a viajar"), t("they're going to sleep", "", "van a dormir"), t("it's going to rain", "", "va a llover"),
    ],
    controlledBlanksHeading: "Plans",
    controlledBlanks: [
      b("El sábado ", "I'm going to visit", " a mis abuelos.", "voy a visitar"),
      b("¿Qué ", "are you going to cook", "?", "vas a cocinar"),
      b("Ellos ", "are going to buy", " una casa.", "van a comprar"),
    ],
    mixedBlanks: [
      b("Mañana ", "we're going to get up", " temprano.", "nos vamos a levantar"),
      b("Este verano ", "I'm going to learn", " a nadar.", "voy a aprender"),
      b("Mi hermana ", "is going to have", " un bebé.", "va a tener"),
      b("¿", "are you (vosotros) going to come", " a la fiesta?", "Vais a venir"),
      b("Creo que ", "it's going to snow", ".", "va a nevar"),
      b("No ", "I'm not going to say", " nada.", "voy a decir"),
    ],
    producePrompts: [
      p("¿Qué vas a hacer este fin de semana?", "What are you going to do this weekend?", "Write 5 plans with ir + a + infinitive."),
      p("Planea unas vacaciones con amigos.", "Plan a holiday with friends.", "Use vamos a / van a / voy a at least once each."),
      p("Propósitos para el año que viene.", "Resolutions for next year.", "Write 4 resolutions starting with Voy a..."),
    ],
    conversationHint: "In the Speaking tab, make weekend plans with your partner using voy a / vamos a.",
  }),

  lesson("More reflexive verbs", {
    id: "reflexive2",
    noticeHint: "These verbs come with a little pronoun that points back at the subject. Find it.",
    noticeRows: [
      r("Yo", "", "me", "despierto a las siete."),
      r("Tú", "", "te", "duchas por la noche."),
      r("Él", "", "se", "afeita cada mañana."),
      r("Nosotros", "", "nos", "acostamos tarde."),
      r("Ellos", "", "se", "visten rápido."),
    ],
    reflectQ: "Which pronoun goes with each person — and where does it sit?",
    reflectReveal: "me, te, se, nos, os, se — before the conjugated verb (me ducho) or attached to an infinitive (voy a ducharme). Many reflexives have stem changes: despertarse → me despierto, acostarse → me acuesto, vestirse → me visto.",
    ruleHint: "Type the reflexive pronoun:",
    ruleItems: [
      t("yo ___ levanto", "", "me"), t("tú ___ peinas", "", "te"), t("ella ___ maquilla", "", "se"),
      t("nosotros ___ vestimos", "", "nos"), t("vosotros ___ sentáis", "", "os"), t("ellos ___ divierten", "", "se"),
    ],
    structuredHint: "Pick the correct form:",
    structuredItems: [
      q("Por la mañana yo ___ la cara.", ["me lavo", "lavo me", "se lava"], 0),
      q("Los niños ___ a las nueve.", ["se acuestan", "nos acostamos", "se acostan"], 0),
      q("¿A qué hora ___ tú?", ["te despiertas", "te despiertes", "se despierta"], 0),
      q("Voy a ___ ahora.", ["me ducharme", "ducharme", "ducho"], 1),
    ],
    controlledTableHint: "Write the full reflexive form:",
    controlledTableItems: [
      t("levantarse (yo)", "", "me levanto"), t("ducharse (tú)", "", "te duchas"), t("acostarse (ella)", "", "se acuesta"),
      t("vestirse (nosotros)", "", "nos vestimos"), t("despertarse (ellos)", "", "se despiertan"), t("sentarse (yo)", "", "me siento"),
    ],
    controlledBlanksHeading: "Daily routine",
    controlledBlanks: [
      b("Primero ", "I get up", " y luego desayuno.", "me levanto"),
      b("Mi padre ", "shaves", " cada día.", "se afeita"),
      b("Nosotros ", "go to bed", " a las once.", "nos acostamos"),
    ],
    mixedBlanks: [
      b("¿", "do you get bored", " en clase?", "Te aburres"),
      b("Ellas ", "have fun", " en la playa.", "se divierten"),
      b("Yo ", "get dressed", " muy rápido.", "me visto"),
      b("Vamos a ", "sit down", " aquí.", "sentarnos"),
      b("El bebé ", "wakes up", " a las seis.", "se despierta"),
      b("¿Cómo ", "are you called (tú)", "?", "te llamas"),
    ],
    producePrompts: [
      p("Describe tu rutina de la mañana.", "Describe your morning routine.", "Use at least five reflexive verbs in order."),
      p("¿Cómo es un domingo perfecto para ti?", "What's a perfect Sunday for you?", "Include divertirse, relajarse and acostarse."),
      p("Compara tu rutina con la de tu familia.", "Compare your routine with your family's.", "Use me, se and nos forms."),
    ],
    conversationHint: "In the Speaking tab, compare daily routines — what time you wake up, shower and go to bed.",
  }),

  lesson("Adverbs of frequency/manner", {
    id: "adverbs",
    noticeHint: "These words say how or how often. Look at the ending most of them share.",
    noticeRows: [
      r("Habla", "rápida", "mente", "."),
      r("", "Normal", "mente", "como en casa."),
      r("Lo hace", "fácil", "mente", "."),
      r("", "", "Siempre", "llego tarde."),
      r("", "", "Nunca", "bebo café."),
    ],
    reflectQ: "How do you build an adverb like quickly from an adjective?",
    reflectReveal: "Feminine adjective + -mente: rápido → rápidamente, tranquilo → tranquilamente. Adjectives ending in -e or a consonant just add -mente: fácil → fácilmente. Frequency: siempre, a menudo, a veces, casi nunca, nunca. 'Nunca' after the verb needs no: No como nunca carne.",
    ruleHint: "Type the -mente adverb ending:",
    ruleItems: [
      t("rápido →", "rápida", "mente"), t("lento →", "lenta", "mente"), t("feliz →", "feliz", "mente"),
      t("tranquilo →", "tranquila", "mente"), t("general →", "general", "mente"), t("claro →", "clara", "mente"),
    ],
    structuredHint: "Pick the right adverb:",
    structuredItems: [
      q("Habla muy ___. No le entiendo.", ["rápido", "rápidamente", "rápida"], 0),
      q("Voy al gimnasio ___: lunes, miércoles y viernes.", ["a menudo", "nunca", "casi nunca"], 0),
      q("No ___ como carne.", ["siempre", "nunca", "a veces"], 1),
      q("Explica todo muy ___.", ["claramente", "claromente", "claro mente"], 0),
    ],
    controlledTableHint: "Turn the adjective into an adverb:",
    controlledTableItems: [
      t("perfecto", "", "perfectamente"), t("cuidadoso", "", "cuidadosamente"), t("fácil", "", "fácilmente"),
      t("triste", "", "tristemente"), t("real", "", "realmente"), t("exacto", "", "exactamente"),
    ],
    controlledBlanksHeading: "How?",
    controlledBlanks: [
      b("Conduce ", "carefully", ".", "cuidadosamente"),
      b("Ella canta ", "perfectly", ".", "perfectamente"),
      b("", "usually", " ceno a las nueve.", "Normalmente"),
    ],
    mixedBlanks: [
      b("", "sometimes", " voy al cine solo.", "A veces"),
      b("", "never", " llega a tiempo.", "Nunca"),
      b("Resolvió el problema ", "easily", ".", "fácilmente"),
      b("", "almost never", " veo la tele.", "Casi nunca"),
      b("Hablamos ", "calmly", ".", "tranquilamente"),
      b("Yo ", "always", " desayuno fruta.", "siempre"),
    ],
    producePrompts: [
      p("¿Con qué frecuencia haces deporte, cocinas y lees?", "How often do you exercise, cook and read?", "Use siempre, a menudo, a veces and nunca."),
      p("Describe cómo trabaja un buen profesor.", "Describe how a good teacher works.", "Use at least three -mente adverbs."),
      p("Tus hábitos de fin de semana.", "Your weekend habits.", "Mix frequency adverbs and -mente adverbs."),
    ],
    conversationHint: "In the Speaking tab, interview your partner about how often they do things — answer with frequency adverbs.",
  }),

  lesson("Por vs. para: basic uses", {
    id: "porpara",
    noticeHint: "Both mean 'for' in English. Find which one each sentence uses.",
    noticeRows: [
      r("Este regalo es", "", "para", "ti."),
      r("Estudio", "", "para", "aprender."),
      r("Gracias", "", "por", "la ayuda."),
      r("Paseo", "", "por", "el parque."),
      r("Lo compré", "", "por", "diez euros."),
    ],
    reflectQ: "Para points toward something. What is por used for?",
    reflectReveal: "para = destination, recipient, purpose, deadline (para ti, para aprender, para el lunes). por = cause, exchange, movement through, duration, means (gracias por, por diez euros, por el parque, por la mañana, por teléfono).",
    ruleHint: "Type por or para:",
    ruleItems: [
      t("Salgo ___ Madrid (destination)", "", "para"), t("Gracias ___ todo", "", "por"), t("Es ___ mi madre", "", "para"),
      t("Hablo ___ teléfono", "", "por"), t("Trabajo ___ ganar dinero", "", "para"), t("Estudio ___ la mañana", "", "por"),
    ],
    structuredHint: "Pick por or para:",
    structuredItems: [
      q("Necesito el informe ___ el viernes.", ["por", "para"], 1),
      q("Caminamos ___ la playa.", ["por", "para"], 0),
      q("Te cambio mi libro ___ tu revista.", ["por", "para"], 0),
      q("Esta taza es ___ café.", ["por", "para"], 1),
    ],
    controlledTableHint: "Write por or para:",
    controlledTableItems: [
      t("a present for Ana", "", "para"), t("thanks for coming", "", "por"), t("in the afternoon", "", "por"),
      t("in order to sleep", "", "para"), t("by email", "", "por"), t("for tomorrow (deadline)", "", "para"),
    ],
    controlledBlanksHeading: "Choose",
    controlledBlanks: [
      b("Ahorro ", "for", " comprar un coche.", "para"),
      b("Pasamos ", "through", " el centro.", "por"),
      b("Este mensaje es ", "for", " ti.", "para"),
    ],
    mixedBlanks: [
      b("Pagué veinte euros ", "for", " la camiseta.", "por"),
      b("Salimos ", "for", " Barcelona mañana.", "para"),
      b("Gracias ", "for", " el regalo.", "por"),
      b("Llámame ", "by", " teléfono.", "por"),
      b("Necesito la llave ", "by", " las cinco.", "para"),
      b("Corro ", "in order to", " estar en forma.", "para"),
    ],
    producePrompts: [
      p("Escribe una nota de agradecimiento.", "Write a thank-you note.", "Use gracias por and para at least twice."),
      p("Describe un viaje: ruta y objetivo.", "Describe a trip: route and purpose.", "Use por for the route and para for the destination/purpose."),
      p("Haz una lista de regalos.", "Make a gift list.", "Who each present is for (para) and what it cost (por)."),
    ],
    conversationHint: "In the Speaking tab, plan a trip: say where you're going (para), which way (por) and why (para).",
  }),

  /* ═══════════════════════════════ B1 ═══════════════════════════════ */
  lesson("Preterite vs. imperfect (contrast — the real battle begins)", {
    id: "pretimp",
    noticeHint: "One verb sets the scene, the other is the event that interrupts it. Find the event.",
    noticeRows: [
      r("Llovía cuando", "lleg", "ué", "a casa."),
      r("Dormía y el teléfono", "son", "ó", "."),
      r("Era tarde cuando", "termin", "amos", "."),
      r("Paseaba y", "v", "i", "a Juan."),
      r("Hacía sol, pero", "decid", "imos", "quedarnos."),
    ],
    reflectQ: "Which tense describes the background, and which one moves the story forward?",
    reflectReveal: "Imperfect = background, description, ongoing or habitual (llovía, dormía, era). Preterite = completed events that advance the story (llegué, sonó). Classic pattern: imperfect + cuando + preterite.",
    ruleHint: "Type the preterite ending of the interrupting action:",
    ruleItems: [
      t("Leía cuando (yo)", "entr", "é"), t("Cocinaba cuando él", "lleg", "ó"), t("Estudiábamos cuando (nosotros)", "o", "ímos"),
      t("Hablaban cuando ella", "sal", "ió"), t("Veía la tele cuando (tú)", "llam", "aste"), t("Corrían cuando ellos", "ca", "yeron"),
    ],
    structuredHint: "Background (imperfect) or event (preterite)?",
    structuredItems: [
      q("Cuando ___ niño, vivía en Lima.", ["fui", "era"], 1),
      q("Ayer ___ tres horas.", ["estudié", "estudiaba"], 0),
      q("Mientras cocinaba, ___ la luz.", ["se iba", "se fue"], 1),
      q("Todos los días ___ al parque.", ["fuimos", "íbamos"], 1),
    ],
    controlledTableHint: "Write preterite or imperfect as indicated:",
    controlledTableItems: [
      t("llover (imperfect)", "", "llovía"), t("llegar (preterite, yo)", "", "llegué"), t("ser (imperfect)", "", "era"),
      t("ver (preterite, yo)", "", "vi"), t("estar (imperfect, nosotros)", "", "estábamos"), t("decir (preterite, ella)", "", "dijo"),
    ],
    controlledBlanksHeading: "Scene + event",
    controlledBlanks: [
      b("", "was sleeping (yo)", " cuando sonó la alarma.", "Dormía"),
      b("Hacía frío cuando ", "we went out", ".", "salimos"),
      b("Mientras ella ", "was reading", ", llegó su hermano.", "leía"),
    ],
    mixedBlanks: [
      b("De pequeño ", "I used to play", " al fútbol.", "jugaba"),
      b("El año pasado ", "I went", " a Japón.", "fui"),
      b("", "it was", " las diez cuando llamó.", "Eran"),
      b("Conocí a mi novia cuando ", "I lived", " en Roma.", "vivía"),
      b("De repente ", "it started", " a llover.", "empezó"),
      b("La casa ", "had", " un jardín enorme.", "tenía"),
    ],
    producePrompts: [
      p("Cuenta una anécdota divertida.", "Tell a funny anecdote.", "Set the scene in the imperfect, then tell the events in the preterite."),
      p("¿Cómo conociste a tu mejor amigo?", "How did you meet your best friend?", "Use at least three imperfect and three preterite verbs."),
      p("Un día que algo salió mal.", "A day something went wrong.", "Use the pattern: estaba... cuando..."),
    ],
    conversationHint: "In the Speaking tab, tell a story: describe the scene first, then what happened — and switch tenses on purpose.",
  }),

  lesson("Indirect object pronouns", {
    id: "iop",
    noticeHint: "These pronouns say to whom or for whom. Find them.",
    noticeRows: [
      r("", "", "Le", "doy un regalo a mi madre."),
      r("¿", "", "Me", "pasas la sal?"),
      r("", "", "Les", "escribo a mis amigos."),
      r("", "", "Te", "compro un helado."),
      r("Ella", "", "nos", "explica la lección."),
    ],
    reflectQ: "Which pronoun is used for 'to him/her/you (usted)' — and why do we still say 'a mi madre'?",
    reflectReveal: "me, te, le, nos, os, les. Le/les covers him, her and usted/ustedes — so Spanish often adds a + person to make it clear: Le doy el libro a Ana. The pronoun is still used even when the person is named.",
    ruleHint: "Type the indirect object pronoun:",
    ruleItems: [
      t("to me →", "", "me"), t("to you (tú) →", "", "te"), t("to him / her →", "", "le"),
      t("to us →", "", "nos"), t("to them →", "", "les"), t("to you all (vosotros) →", "", "os"),
    ],
    structuredHint: "Pick the pronoun:",
    structuredItems: [
      q("___ digo la verdad a mis padres.", ["Les", "Le", "Los"], 0),
      q("¿___ prestas tu bolígrafo? (a mí)", ["Te", "Me", "Le"], 1),
      q("El camarero ___ trae la cuenta a Juan.", ["lo", "le", "les"], 1),
      q("Mi abuela ___ cuenta historias (a nosotros).", ["nos", "os", "les"], 0),
    ],
    controlledTableHint: "Write the pronoun:",
    controlledTableItems: [
      t("Doy flores a Marta.", "", "le"), t("Escribo a mis primos.", "", "les"), t("Explicas el plan a mí.", "", "me"),
      t("Mando un mensaje a ti.", "", "te"), t("Compran pan a nosotros.", "", "nos"), t("Pregunto al profesor.", "", "le"),
    ],
    controlledBlanksHeading: "In sentences",
    controlledBlanks: [
      b("", "I send him", " un correo.", "Le envío"),
      b("¿", "can you tell me", " la hora?", "Me dices"),
      b("", "we give them", " las llaves.", "Les damos"),
    ],
    mixedBlanks: [
      b("", "she asks us", " un favor.", "Nos pide"),
      b("", "I'll buy you", " un café.", "Te compro"),
      b("", "they explain to her", " el problema.", "Le explican"),
      b("¿Qué ", "did you give him", " para su cumpleaños?", "le regalaste"),
      b("", "I lend them", " mi coche.", "Les presto"),
      b("Mi jefe ", "pays me", " bien.", "me paga"),
    ],
    producePrompts: [
      p("¿Qué regalos das en Navidad?", "What presents do you give at Christmas?", "Write 4 sentences: le/les + verb + gift + a + person."),
      p("Pide favores a tus compañeros.", "Ask your classmates for favours.", "Use ¿Me...? at least three times."),
      p("Lo que hacen tus padres por ti.", "What your parents do for you.", "Use me and nos with at least four verbs."),
    ],
    conversationHint: "In the Speaking tab, plan birthday presents — say what you'll give to whom using le and les.",
  }),

  lesson("Double object pronouns (combining direct + indirect)", {
    id: "doubleobj",
    noticeHint: "Two pronouns together: to whom, then what. Look at what happens to le.",
    noticeRows: [
      r("¿El libro?", "", "Me lo", "das mañana."),
      r("¿La carta?", "", "Te la", "envío hoy."),
      r("¿El regalo? Ya", "", "se lo", "di a Ana."),
      r("¿Las fotos?", "", "Se las", "mando a mis padres."),
      r("¿El coche?", "", "Nos lo", "prestan."),
    ],
    reflectQ: "What's the order of the two pronouns? And why 'se lo' instead of 'le lo'?",
    reflectReveal: "Indirect before direct: me lo, te la, nos los. When le/les meets lo/la/los/las, le/les becomes se: le lo → se lo. With infinitives they attach in the same order: quiero dártelo (note the accent).",
    ruleHint: "Type the two-pronoun combination:",
    ruleItems: [
      t("me + lo →", "", "me lo"), t("te + la →", "", "te la"), t("le + lo →", "", "se lo"),
      t("les + las →", "", "se las"), t("nos + los →", "", "nos los"), t("le + la →", "", "se la"),
    ],
    structuredHint: "Pick the correct combination:",
    structuredItems: [
      q("¿Le das el libro a Juan? Sí, ___ doy.", ["le lo", "se lo", "lo le"], 1),
      q("¿Me traes la cuenta? Sí, ___ traigo.", ["te la", "me la", "la te"], 0),
      q("¿Les mandas las fotos? Sí, ___ mando.", ["les las", "se las", "se los"], 1),
      q("Voy a ___ (dar a ti, el móvil).", ["dártelo", "darlote", "te lo dar"], 0),
    ],
    controlledTableHint: "Replace both objects with pronouns:",
    controlledTableItems: [
      t("Doy el libro a ti.", "", "te lo"), t("Envío la carta a ella.", "", "se la"), t("Dan los billetes a nosotros.", "", "nos los"),
      t("Compro las flores a mi madre.", "", "se las"), t("Prestas el coche a mí.", "", "me lo"), t("Explico el plan a ellos.", "", "se lo"),
    ],
    controlledBlanksHeading: "Answer with pronouns",
    controlledBlanks: [
      b("¿Me dejas tu boli? Sí, ", "I lend it to you", ".", "te lo dejo"),
      b("¿Le diste la llave a Pedro? Sí, ", "I gave it to him", ".", "se la di"),
      b("¿Nos traen el menú? Sí, ", "they bring it to us", ".", "nos lo traen"),
    ],
    mixedBlanks: [
      b("¿Les explicaste el problema? Sí, ", "I explained it to them", ".", "se lo expliqué"),
      b("¿Me compras estas gafas? Sí, ", "I'll buy them for you", ".", "te las compro"),
      b("¿Le mandas el paquete a tu hermana? Sí, ", "I send it to her", ".", "se lo mando"),
      b("Quiero ", "give it to you (el regalo)", " ahora.", "dártelo"),
      b("¿Os enseñan la casa? Sí, ", "they show it to us", ".", "nos la enseñan"),
      b("¿Me dices la verdad? Sí, ", "I tell it to you", ".", "te la digo"),
    ],
    producePrompts: [
      p("¿A quién le prestas tus cosas?", "Who do you lend your things to?", "Write 4 Q&A pairs answered with double pronouns (se lo presto...)."),
      p("Organiza los regalos de cumpleaños.", "Sort out the birthday presents.", "Say who gets what using se lo/se la/se los."),
      p("Un camarero y un cliente.", "A waiter and a customer.", "Write a dialogue with at least three double-pronoun answers (se lo traigo...)."),
    ],
    conversationHint: "In the Speaking tab, play a waiter: when your partner asks for something, answer with 'Ahora se lo traigo'.",
  }),

  lesson("Future tense (regular + irregular)", {
    id: "future",
    noticeHint: "These verbs talk about the future without ir a. Where is the ending attached?",
    noticeRows: [
      r("Mañana", "hablar", "é", "con él."),
      r("El año que viene", "vivir", "emos", "en Chile."),
      r("¿", "comer", "ás", "con nosotros?"),
      r("Ellos", "ten", "drán", "más tiempo."),
      r("Lo", "har", "é", "luego."),
    ],
    reflectQ: "What's the stem of the future — and do -ar, -er and -ir verbs have different endings?",
    reflectReveal: "The whole infinitive is the stem: hablar + é. All three groups share the endings -é, -ás, -á, -emos, -éis, -án. Irregular stems: tener → tendr-, hacer → har-, decir → dir-, poder → podr-, salir → saldr-, venir → vendr-, poner → pondr-, saber → sabr-, querer → querr-.",
    ruleHint: "Type the future ending:",
    ruleItems: [
      t("yo", "hablar", "é"), t("tú", "comer", "ás"), t("ella", "vivir", "á"),
      t("nosotros", "ir", "emos"), t("vosotros", "ser", "éis"), t("ellos", "estar", "án"),
    ],
    structuredHint: "Pick the correct future form:",
    structuredItems: [
      q("Mañana ___ sol.", ["hará", "hacerá", "hace"], 0),
      q("¿Cuándo ___ tú?", ["vendrás", "venirás", "vienes"], 0),
      q("No ___ venir el lunes.", ["poderé", "podré", "puedré"], 1),
      q("Te lo ___ más tarde.", ["deciré", "diré", "dicé"], 1),
    ],
    controlledTableHint: "Write the future form:",
    controlledTableItems: [
      t("trabajar (yo)", "", "trabajaré"), t("tener (tú)", "", "tendrás"), t("hacer (ella)", "", "hará"),
      t("decir (nosotros)", "", "diremos"), t("salir (ellos)", "", "saldrán"), t("poder (yo)", "", "podré"),
    ],
    controlledBlanksHeading: "Predictions",
    controlledBlanks: [
      b("En 2050 los coches ", "will fly", ".", "volarán"),
      b("Mañana ", "it will rain", ".", "lloverá"),
      b("Algún día ", "I will be", " médico.", "seré"),
    ],
    mixedBlanks: [
      b("¿", "will you come", " a mi boda?", "Vendrás"),
      b("Nosotros ", "will do", " los deberes después.", "haremos"),
      b("Ella ", "will know", " la respuesta.", "sabrá"),
      b("¿Dónde ", "will they put", " el sofá?", "pondrán"),
      b("Te ", "I will call", " esta noche.", "llamaré"),
      b("No ", "they will want", " salir.", "querrán"),
    ],
    producePrompts: [
      p("¿Cómo será tu vida dentro de diez años?", "What will your life be like in ten years?", "Write 5 sentences in the future, including three irregular verbs."),
      p("Predice el futuro de tu ciudad.", "Predict your city's future.", "Use habrá, tendrá, será and at least two other verbs."),
      p("Promesas para un amigo.", "Promises to a friend.", "Write 4 promises in the future (Te ayudaré...)."),
    ],
    conversationHint: "In the Speaking tab, play fortune teller: predict your partner's future in the future tense.",
  }),

  lesson("Conditional tense (introduced)", {
    id: "conditional",
    noticeHint: "These say what someone would do. Compare the ending with the imperfect of -er verbs.",
    noticeRows: [
      r("Yo", "viajar", "ía", "por todo el mundo."),
      r("¿Te", "gustar", "ía", "venir?"),
      r("Nosotros", "comprar", "íamos", "una casa."),
      r("Ellos", "ten", "drían", "más tiempo."),
      r("¿Qué", "har", "ías", "tú?"),
    ],
    reflectQ: "What's the stem, and what are the endings?",
    reflectReveal: "Stem = infinitive (same irregular stems as the future: tendr-, har-, dir-, podr-...). Endings = -ía, -ías, -ía, -íamos, -íais, -ían. Use it for 'would', polite requests (¿Podrías...?) and advice (Yo que tú, iría).",
    ruleHint: "Type the conditional ending:",
    ruleItems: [
      t("yo", "hablar", "ía"), t("tú", "comer", "ías"), t("él", "vivir", "ía"),
      t("nosotros", "ir", "íamos"), t("vosotros", "ser", "íais"), t("ellos", "estar", "ían"),
    ],
    structuredHint: "Pick the conditional:",
    structuredItems: [
      q("¿___ abrir la ventana, por favor?", ["Podrías", "Poderías", "Puedes"], 0),
      q("Yo que tú, no lo ___.", ["haría", "hacería", "hice"], 0),
      q("Me ___ vivir en la playa.", ["gustaría", "gustará", "gusta"], 0),
      q("Con más dinero, ___ un barco.", ["tendríamos", "teníamos", "tenemos"], 0),
    ],
    controlledTableHint: "Write the conditional form:",
    controlledTableItems: [
      t("comprar (yo)", "", "compraría"), t("poder (tú)", "", "podrías"), t("decir (ella)", "", "diría"),
      t("salir (nosotros)", "", "saldríamos"), t("hacer (ellos)", "", "harían"), t("gustar (a mí)", "", "me gustaría"),
    ],
    controlledBlanksHeading: "Would...",
    controlledBlanks: [
      b("", "I would like", " un café, por favor.", "Me gustaría"),
      b("¿", "could you", " ayudarme?", "Podrías"),
      b("En tu lugar, ", "I would study", " más.", "estudiaría"),
    ],
    mixedBlanks: [
      b("Nosotros ", "would live", " en el campo.", "viviríamos"),
      b("¿Qué ", "would you do", " con un millón?", "harías"),
      b("Ellos nunca ", "would say", " eso.", "dirían"),
      b("", "it would be", " fantástico.", "Sería"),
      b("¿", "would you (usted) have", " un momento?", "Tendría"),
      b("Yo ", "would go out", " pero estoy cansado.", "saldría"),
    ],
    producePrompts: [
      p("¿Qué harías con un año libre?", "What would you do with a free year?", "Write 5 sentences in the conditional."),
      p("Da consejos a un amigo estresado.", "Give advice to a stressed friend.", "Use Yo que tú... / Deberías... at least three times."),
      p("Pide cosas educadamente en un hotel.", "Ask for things politely in a hotel.", "Use ¿Podría...? and Me gustaría..."),
    ],
    conversationHint: "In the Speaking tab, ask your partner what they would do in different situations — and give advice with 'yo que tú'.",
  }),

  lesson("Present subjunctive: introduced (basic triggers — wishes, doubt)", {
    id: "subj1",
    noticeHint: "After 'quiero que', 'espero que' and 'dudo que' the verb changes. Look at its ending.",
    noticeRows: [
      r("Quiero que", "habl", "es", "con ella."),
      r("Espero que", "com", "as", "bien."),
      r("Dudo que", "viv", "a", "aquí."),
      r("Ojalá", "teng", "amos", "suerte."),
      r("No creo que", "veng", "an", "hoy."),
    ],
    reflectQ: "What happens to the vowel of the ending? Hablas → hables, comes → comas...",
    reflectReveal: "The vowels swap: -ar verbs take -e (hable, hables), -er/-ir verbs take -a (coma, viva). Start from the yo form: tengo → tenga, vengo → venga, hago → haga. Use it after wishes (quiero que, espero que, ojalá) and doubt (dudo que, no creo que) when the subject changes.",
    ruleHint: "Type the subjunctive ending:",
    ruleItems: [
      t("que yo", "habl", "e"), t("que tú", "com", "as"), t("que él", "escrib", "a"),
      t("que nosotros", "trabaj", "emos"), t("que ellos", "viv", "an"), t("que tú", "estudi", "es"),
    ],
    structuredHint: "Indicative or subjunctive?",
    structuredItems: [
      q("Espero que ___ un buen día.", ["tienes", "tengas"], 1),
      q("Creo que ___ razón.", ["tienes", "tengas"], 0),
      q("Dudo que ellos ___ a tiempo.", ["llegan", "lleguen"], 1),
      q("Ojalá ___ sol mañana.", ["hace", "haga"], 1),
    ],
    controlledTableHint: "Write the present subjunctive:",
    controlledTableItems: [
      t("hablar (yo)", "", "hable"), t("comer (tú)", "", "comas"), t("tener (él)", "", "tenga"),
      t("hacer (nosotros)", "", "hagamos"), t("venir (ellos)", "", "vengan"), t("ser (yo)", "", "sea"),
    ],
    controlledBlanksHeading: "Wishes",
    controlledBlanks: [
      b("Quiero que tú ", "come", " a la fiesta.", "vengas"),
      b("Espero que ", "you're", " bien.", "estés"),
      b("Ojalá ", "we win", " el partido.", "ganemos"),
    ],
    mixedBlanks: [
      b("No creo que ", "it's", " verdad.", "sea"),
      b("Mis padres quieren que yo ", "study", " más.", "estudie"),
      b("Dudo que ellos ", "know", " la respuesta.", "sepan"),
      b("Espero que ", "you have", " un buen viaje.", "tengas"),
      b("Ojalá no ", "it rains", " mañana.", "llueva"),
      b("Quiero que ", "you do", " los deberes.", "hagas"),
    ],
    producePrompts: [
      p("Escribe deseos para un amigo que se va.", "Write wishes for a friend who's leaving.", "Use espero que and ojalá at least twice each."),
      p("¿Qué quieren tus padres que hagas?", "What do your parents want you to do?", "Write 4 sentences with quieren que + subjunctive."),
      p("Expresa dudas sobre el futuro.", "Express doubts about the future.", "Use dudo que and no creo que."),
    ],
    conversationHint: "In the Speaking tab, wish your partner well for an upcoming event — espero que..., ojalá...",
  }),

  lesson("Commands (imperative — affirmative and negative)", {
    id: "commands",
    noticeHint: "These are instructions. Compare the yes-command with the no-command.",
    noticeRows: [
      r("", "Habl", "a", "más despacio."),
      r("No", "habl", "es", "tan rápido."),
      r("", "Com", "e", "fruta."),
      r("No", "com", "as", "tanto azúcar."),
      r("", "Sient", "e", "se, por favor (usted)."),
    ],
    reflectQ: "The affirmative tú command looks like the él form. What does the negative look like?",
    reflectReveal: "Affirmative tú = él form (habla, come, escribe). Negative tú = no + subjunctive (no hables, no comas). Usted commands use the subjunctive both ways (hable / no hable). Irregular tú: ven, di, haz, pon, sal, sé, ten, ve. Pronouns attach to affirmatives (dímelo) but go before negatives (no me lo digas).",
    ruleHint: "Type the command ending:",
    ruleItems: [
      t("(tú)", "¡Habl", "a!"), t("(tú) ¡No", "habl", "es!"), t("(tú)", "¡Escrib", "e!"),
      t("(tú) ¡No", "escrib", "as!"), t("(usted)", "¡Pas", "e!"), t("(ustedes)", "¡Abr", "an!"),
    ],
    structuredHint: "Pick the correct command:",
    structuredItems: [
      q("(tú, venir) ¡___ aquí!", ["Ven", "Vienes", "Venga"], 0),
      q("(tú, no tocar) ¡No ___ eso!", ["toca", "toques", "tocas"], 1),
      q("(usted, sentarse) ___, por favor.", ["Siéntese", "Siéntate", "Se siente"], 0),
      q("(tú, decir) ___ la verdad.", ["Dice", "Di", "Digas"], 1),
    ],
    controlledTableHint: "Write the command:",
    controlledTableItems: [
      t("tú, hablar", "", "habla"), t("tú, no hablar", "", "no hables"), t("tú, hacer", "", "haz"),
      t("tú, no salir", "", "no salgas"), t("usted, esperar", "", "espere"), t("tú, ponerse (el abrigo)", "", "ponte"),
    ],
    controlledBlanksHeading: "Instructions",
    controlledBlanks: [
      b("", "close (tú)", " la puerta, por favor.", "Cierra"),
      b("No ", "forget (tú)", " las llaves.", "olvides"),
      b("", "turn (usted)", " a la derecha.", "Gire"),
    ],
    mixedBlanks: [
      b("", "tell me (tú)", " qué pasó.", "Dime"),
      b("No ", "worry (tú)", ".", "te preocupes"),
      b("", "go (tú)", " a la cama ya.", "Ve"),
      b("", "listen (ustedes)", " con atención.", "Escuchen"),
      b("No ", "do (tú)", " eso.", "hagas"),
      b("", "put (tú)", " la mesa, por favor.", "Pon"),
    ],
    producePrompts: [
      p("Escribe una receta sencilla.", "Write a simple recipe.", "Use at least five tú commands (corta, pon, mezcla...)."),
      p("Reglas de tu casa para un invitado.", "House rules for a guest.", "Mix affirmative and negative commands."),
      p("Indicaciones para llegar a tu casa.", "Directions to your home.", "Use usted commands (siga, gire, cruce)."),
    ],
    conversationHint: "In the Speaking tab, give your partner directions or a recipe — only commands allowed.",
  }),

  lesson("Relative pronouns (que, quien)", {
    id: "relatives",
    noticeHint: "One word joins two ideas together. Find it.",
    noticeRows: [
      r("El libro", "", "que", "leo es genial."),
      r("La chica", "", "que", "vive aquí es médica."),
      r("Mi amigo, con", "", "quien", "viajo, es chileno."),
      r("Las personas con", "", "quienes", "trabajo son simpáticas."),
      r("", "", "Lo que", "dices es verdad."),
    ],
    reflectQ: "When do you use que, and when quien/quienes?",
    reflectReveal: "que is the default for people and things (el libro que..., la chica que...). quien/quienes is for people after a preposition (con quien, a quienes) or in non-essential clauses. lo que = what / the thing that (Lo que quiero es dormir).",
    ruleHint: "Type que, quien, quienes or lo que:",
    ruleItems: [
      t("La casa ___ compré", "", "que"), t("El chico con ___ hablo", "", "quien"), t("Los amigos a ___ invité", "", "quienes"),
      t("___ necesito es tiempo", "", "lo que"), t("El tren ___ sale ahora", "", "que"), t("La profesora de ___ te hablé", "", "quien"),
    ],
    structuredHint: "Pick the relative pronoun:",
    structuredItems: [
      q("El hombre ___ vende fruta es mi tío.", ["que", "quien", "lo que"], 0),
      q("La persona con ___ hablé es la directora.", ["que", "quien", "quienes"], 1),
      q("No entiendo ___ dices.", ["que", "lo que", "quien"], 1),
      q("Mis vecinos, a ___ conoces, se mudan.", ["quien", "quienes", "que"], 1),
    ],
    controlledTableHint: "Join with the right relative:",
    controlledTableItems: [
      t("the film (that) I saw → la película ___ vi", "", "que"), t("the friend with whom → el amigo con ___", "", "quien"), t("what I want → ___ quiero", "", "lo que"),
      t("the students to whom → los alumnos a ___", "", "quienes"), t("the city where... → la ciudad ___ visité", "", "que"), t("everything that → todo ___", "", "lo que"),
    ],
    controlledBlanksHeading: "Joining ideas",
    controlledBlanks: [
      b("Este es el móvil ", "that", " me regalaron.", "que"),
      b("La chica con ", "whom", " salgo es italiana.", "quien"),
      b("", "what", " más me gusta es viajar.", "Lo que"),
    ],
    mixedBlanks: [
      b("El restaurante ", "that", " te recomendé ha cerrado.", "que"),
      b("Los niños con ", "whom", " juega mi hijo son vecinos.", "quienes"),
      b("Haz ", "what", " quieras.", "lo que"),
      b("La señora a ", "whom", " ayudé me dio las gracias.", "quien"),
      b("El autobús ", "that", " va al centro es el 5.", "que"),
      b("No sé ", "what", " pasó.", "lo que"),
    ],
    producePrompts: [
      p("Describe a personas importantes en tu vida.", "Describe important people in your life.", "Use que and con quien / a quien at least twice."),
      p("¿Qué es lo que más te gusta de tu ciudad?", "What do you like most about your city?", "Start at least two sentences with Lo que..."),
      p("Define cinco objetos sin decir su nombre.", "Define five objects without naming them.", "Es una cosa que... / Es algo que..."),
    ],
    conversationHint: "In the Speaking tab, play a guessing game: describe objects and people with 'es algo que...' and 'es alguien con quien...'.",
  }),

  lesson("Por vs. para: expanded", {
    id: "porpara2",
    noticeHint: "More uses of por and para. Which one is used for opinion, cause, exchange and 'on behalf of'?",
    noticeRows: [
      r("", "", "Para", "mí, es el mejor libro."),
      r("Lo hice", "", "por", "ti."),
      r("Es muy alto", "", "para", "su edad."),
      r("Lo cancelaron", "", "por", "la lluvia."),
      r("Voy", "", "por", "pan (a buscar)."),
    ],
    reflectQ: "'Por ti' and 'para ti' both exist. What's the difference?",
    reflectReveal: "para ti = for you as recipient/goal; por ti = because of you / on your behalf. para also gives opinion (para mí) and comparison against a standard (alto para su edad). por gives cause (por la lluvia), going to fetch (voy por pan), frequency (dos veces por semana) and passive agent (escrito por Cervantes).",
    ruleHint: "Type por or para:",
    ruleItems: [
      t("___ mí, el café es esencial (opinion)", "", "para"), t("Lo hago ___ ti (on your behalf)", "", "por"), t("Escrito ___ Cervantes", "", "por"),
      t("Dos veces ___ semana", "", "por"), t("Es caro ___ ser usado", "", "para"), t("No salimos ___ el frío", "", "por"),
    ],
    structuredHint: "Pick por or para:",
    structuredItems: [
      q("___ ser extranjero, habla muy bien.", ["Por", "Para"], 1),
      q("El libro fue escrito ___ García Márquez.", ["por", "para"], 0),
      q("Voy a la tienda ___ leche.", ["por", "para"], 0),
      q("Estudio ___ ser médico.", ["por", "para"], 1),
    ],
    controlledTableHint: "Write por or para:",
    controlledTableItems: [
      t("in my opinion → ___ mí", "", "para"), t("because of the traffic", "", "por"), t("three times a day → tres veces ___ día", "", "por"),
      t("painted by Picasso", "", "por"), t("tall for a child", "", "para"), t("I'll go get you → voy ___ ti", "", "por"),
    ],
    controlledBlanksHeading: "Cause vs. goal",
    controlledBlanks: [
      b("Llegué tarde ", "because of", " el tráfico.", "por"),
      b("", "for (opinion)", " ella, la familia es lo primero.", "Para"),
      b("Lo hago ", "for (your sake)", " ti.", "por"),
    ],
    mixedBlanks: [
      b("Hace calor ", "for", " ser diciembre.", "para"),
      b("Voy a pasar ", "to pick up", " ti a las ocho.", "por"),
      b("Este cuadro fue pintado ", "by", " Frida Kahlo.", "por"),
      b("Como fruta tres veces ", "per", " día.", "por"),
      b("Tengo que terminarlo ", "by", " el lunes.", "para"),
      b("", "for", " un principiante, juegas muy bien.", "Para"),
    ],
    producePrompts: [
      p("Escribe sobre algo que hiciste por otra persona.", "Write about something you did for someone else.", "Use por (cause/behalf) and para (purpose) at least twice each."),
      p("Da tu opinión sobre las redes sociales.", "Give your opinion on social media.", "Start with Para mí... and include por + cause."),
      p("Describe tu rutina de ejercicio.", "Describe your exercise routine.", "Use veces por semana and para + purpose."),
    ],
    conversationHint: "In the Speaking tab, explain why you're learning Spanish (por) and what for (para).",
  }),

  /* ═══════════════════════════════ B2 ═══════════════════════════════ */
  lesson("Subjunctive: expanded (emotion, doubt, hypotheticals, adjective/adverb clauses)", {
    id: "subj2",
    noticeHint: "The subjunctive appears after emotions, after 'cuando' for the future, and for things that may not exist. Find the verb.",
    noticeRows: [
      r("Me alegra que", "est", "és", "aquí."),
      r("Cuando", "lleg", "ues", ", llámame."),
      r("Busco un piso que", "teng", "a", "terraza."),
      r("Te lo digo para que lo", "sep", "as", "."),
      r("Es importante que", "dur", "mamos", "bien."),
    ],
    reflectQ: "Why 'cuando llegues' but 'cuando llego, como'? And why 'busco un piso que tenga'?",
    reflectReveal: "Subjunctive for emotions (me alegra que, siento que), impersonal judgements (es importante que), future time clauses (cuando, hasta que, en cuanto + future idea), purpose (para que, a menos que) and unknown/non-existent antecedents (busco un piso que tenga...). Habitual or known facts take the indicative.",
    ruleHint: "Type the subjunctive ending:",
    ruleItems: [
      t("Siento que (tú)", "est", "és"), t("Cuando (yo)", "termin", "e"), t("para que (ellos)", "entiend", "an"),
      t("Busco a alguien que", "habl", "e"), t("Es necesario que (nosotros)", "sal", "gamos"), t("hasta que (tú)", "vuelv", "as"),
    ],
    structuredHint: "Indicative or subjunctive?",
    structuredItems: [
      q("Cuando ___ dinero, viajaré.", ["tengo", "tenga"], 1),
      q("Cuando ___ dinero, siempre viajo.", ["tengo", "tenga"], 0),
      q("Tengo un amigo que ___ ruso.", ["habla", "hable"], 0),
      q("No hay nadie que ___ la respuesta.", ["sabe", "sepa"], 1),
    ],
    controlledTableHint: "Write the subjunctive form:",
    controlledTableItems: [
      t("poder (tú)", "", "puedas"), t("ir (nosotros)", "", "vayamos"), t("saber (ellos)", "", "sepan"),
      t("dar (yo)", "", "dé"), t("estar (ella)", "", "esté"), t("haber", "", "haya"),
    ],
    controlledBlanksHeading: "Emotion & judgement",
    controlledBlanks: [
      b("Me molesta que ", "you arrive", " tarde.", "llegues"),
      b("Es una pena que no ", "you can", " venir.", "puedas"),
      b("Me alegro de que ", "you are", " mejor.", "estés"),
    ],
    mixedBlanks: [
      b("En cuanto ", "I know", " algo, te aviso.", "sepa"),
      b("Quiero un trabajo que ", "is", " interesante.", "sea"),
      b("Te presto el coche para que ", "you go", " al médico.", "vayas"),
      b("No saldremos hasta que ", "it stops", " de llover.", "pare"),
      b("Es raro que no ", "there is", " nadie.", "haya"),
      b("A menos que ", "you call me", ", no iré.", "me llames"),
    ],
    producePrompts: [
      p("Describe tu trabajo ideal.", "Describe your ideal job.", "Use Busco un trabajo que... with at least three subjunctive verbs."),
      p("¿Qué harás cuando termines tus estudios?", "What will you do when you finish your studies?", "Use cuando, en cuanto and hasta que + subjunctive."),
      p("Reacciona a noticias de amigos.", "React to friends' news.", "Use me alegra que, siento que, es increíble que."),
    ],
    conversationHint: "In the Speaking tab, describe your dream flat to an estate agent: 'busco un piso que tenga...'.",
  }),

  lesson("Imperfect subjunctive", {
    id: "impsubj",
    noticeHint: "These wishes and requests are in the past. Look at the shared -ra ending.",
    noticeRows: [
      r("Quería que", "habl", "aras", "con él."),
      r("Me pidió que", "vinie", "ra", "pronto."),
      r("Ojalá", "tuvi", "éramos", "más tiempo."),
      r("Era necesario que", "estudi", "aran", "."),
      r("Si", "fue", "ra", "rico, viajaría."),
    ],
    reflectQ: "Where does the stem come from? Hint: look at the ellos form of the preterite.",
    reflectReveal: "Take the ellos preterite, drop -ron, add -ra, -ras, -ra, -ramos, -rais, -ran: hablaron → hablara, tuvieron → tuviera, fueron → fuera. It's used when the trigger is in the past or conditional (quería que, me pidió que, sería mejor que) and in si-clauses.",
    ruleHint: "Type the imperfect subjunctive ending:",
    ruleItems: [
      t("que yo", "habla", "ra"), t("que tú", "comie", "ras"), t("que él viviera → que nosotros", "vivié", "ramos"),
      t("que ellos", "tuvie", "ran"), t("que yo", "fue", "ra"), t("que vosotros", "dije", "rais"),
    ],
    structuredHint: "Pick the correct form:",
    structuredItems: [
      q("Mi madre quería que yo ___ médico.", ["sea", "fuera", "era"], 1),
      q("Te pedí que me ___.", ["llamaras", "llames", "llamabas"], 0),
      q("Sería genial que ___ juntos.", ["vamos", "fuéramos", "vayamos"], 1),
      q("Ojalá ___ aquí ahora (imposible).", ["estuvieras", "estés", "estabas"], 0),
    ],
    controlledTableHint: "Write the imperfect subjunctive:",
    controlledTableItems: [
      t("hablar (yo)", "", "hablara"), t("tener (tú)", "", "tuvieras"), t("hacer (ella)", "", "hiciera"),
      t("poder (nosotros)", "", "pudiéramos"), t("decir (ellos)", "", "dijeran"), t("ir (yo)", "", "fuera"),
    ],
    controlledBlanksHeading: "Past triggers",
    controlledBlanks: [
      b("El profesor nos pidió que ", "we read", " el libro.", "leyéramos"),
      b("No creía que ", "it was", " verdad.", "fuera"),
      b("Me sorprendió que ", "they came", ".", "vinieran"),
    ],
    mixedBlanks: [
      b("Quería que ", "you knew", " la verdad.", "supieras"),
      b("Ojalá ", "I could", " volar.", "pudiera"),
      b("Me dijo que ", "I did", " los deberes.", "hiciera"),
      b("Buscaban a alguien que ", "spoke", " chino.", "hablara"),
      b("Sería mejor que ", "you rested", ".", "descansaras"),
      b("Fue una pena que no ", "there were", " entradas.", "hubiera"),
    ],
    producePrompts: [
      p("¿Qué querían tus padres que hicieras de niño?", "What did your parents want you to do as a child?", "Write 4 sentences with quería(n) que + imperfect subjunctive."),
      p("Describe un deseo imposible.", "Describe an impossible wish.", "Use ojalá + imperfect subjunctive at least three times."),
      p("Cuenta lo que te pidió tu jefe.", "Report what your boss asked of you.", "Use me pidió que / me dijo que + imperfect subjunctive."),
    ],
    conversationHint: "In the Speaking tab, talk about your childhood: what adults wanted you to do and what you wished for.",
  }),

  lesson("Compound tenses (present perfect, past perfect/pluperfect)", {
    id: "perfects",
    noticeHint: "These tenses use two words. Find the helper verb and the ending of the second word.",
    noticeRows: [
      r("Hoy he", "habl", "ado", "con mi jefe."),
      r("¿Has", "com", "ido", "ya?"),
      r("Nunca hemos", "vis", "to", "el mar."),
      r("Cuando llegué, ya habían", "sal", "ido", "."),
      r("Ella había", "escri", "to", "la carta."),
    ],
    reflectQ: "What's the helper verb, and how is the participle formed?",
    reflectReveal: "haber + participle. Present perfect: he, has, ha, hemos, habéis, han + -ado/-ido (he hablado). Pluperfect: había, habías... (había comido) = had done before another past action. Irregular participles: visto, hecho, dicho, escrito, puesto, vuelto, abierto, roto, muerto.",
    ruleHint: "Type the participle ending:",
    ruleItems: [
      t("he", "trabaj", "ado"), t("has", "beb", "ido"), t("ha", "viv", "ido"),
      t("hemos", "hech", "o"), t("han", "vis", "to"), t("había", "escri", "to"),
    ],
    structuredHint: "Pick the right compound form:",
    structuredItems: [
      q("Este año ___ mucho.", ["he viajado", "viajaba", "había viajado"], 0),
      q("Cuando llegó la policía, el ladrón ya ___.", ["ha huido", "había huido", "huye"], 1),
      q("¿Alguna vez ___ paella?", ["has comido", "habías comido", "comías"], 0),
      q("No ___ nada todavía.", ["he dicho", "he decido", "he dichado"], 0),
    ],
    controlledTableHint: "Write the compound form:",
    controlledTableItems: [
      t("hablar (yo, pres. perfect)", "", "he hablado"), t("hacer (tú, pres. perfect)", "", "has hecho"), t("ver (ella, pres. perfect)", "", "ha visto"),
      t("volver (nosotros, pluperfect)", "", "habíamos vuelto"), t("decir (ellos, pluperfect)", "", "habían dicho"), t("abrir (yo, pluperfect)", "", "había abierto"),
    ],
    controlledBlanksHeading: "Present perfect",
    controlledBlanks: [
      b("Esta mañana ", "I have drunk", " tres cafés.", "he bebido"),
      b("¿", "have you seen", " mis llaves?", "Has visto"),
      b("Nunca ", "we have been", " en Cuba.", "hemos estado"),
    ],
    mixedBlanks: [
      b("Cuando llegamos, la película ya ", "had started", ".", "había empezado"),
      b("Ellos ", "have written", " un libro.", "han escrito"),
      b("Yo ya ", "had eaten", " cuando llamaste.", "había comido"),
      b("¿Quién ", "has broken", " el vaso?", "ha roto"),
      b("Ella nunca ", "had travelled", " sola.", "había viajado"),
      b("Todavía no ", "they have returned", ".", "han vuelto"),
    ],
    producePrompts: [
      p("¿Qué has hecho esta semana?", "What have you done this week?", "Write 5 sentences in the present perfect, with three irregular participles."),
      p("Cosas que nunca has hecho.", "Things you've never done.", "Use nunca he... and alguna vez has...?"),
      p("Cuenta qué había pasado antes de un evento.", "Say what had happened before an event.", "Use the pluperfect at least three times."),
    ],
    conversationHint: "In the Speaking tab, play 'Have you ever...?' — ¿Alguna vez has...?",
  }),

  lesson("Conditional + subjunctive combos (si clauses — hypothetical situations)", {
    id: "siclauses",
    noticeHint: "If-sentences. Look at the verb in the si-part and in the result.",
    noticeRows: [
      r("Si", "teng", "o", "tiempo, iré."),
      r("Si", "tuvie", "ra", "tiempo, iría."),
      r("Si", "hubier", "a", "estudiado, habría aprobado."),
      r("Si", "fue", "ra", "tú, no lo haría."),
      r("Si", "lluev", "e", ", nos quedamos."),
    ],
    reflectQ: "Real, unlikely and impossible conditions use different tenses. Which ones?",
    reflectReveal: "Real: si + present → present/future (si llueve, me quedo). Hypothetical: si + imperfect subjunctive → conditional (si tuviera dinero, viajaría). Past impossible: si + pluperfect subjunctive → conditional perfect (si hubiera sabido, habría venido). Never the present subjunctive or conditional after si.",
    ruleHint: "Type the ending of the si-clause verb (hypothetical):",
    ruleItems: [
      t("Si (yo)", "pudie", "ra"), t("Si (tú)", "supie", "ras"), t("Si (nosotros)", "ganá", "ramos"),
      t("Si (ellos)", "vinie", "ran"), t("Si (ella)", "estuvie", "ra"), t("Si (yo)", "fue", "ra"),
    ],
    structuredHint: "Pick the correct verb:",
    structuredItems: [
      q("Si ___ dinero, compraría una casa.", ["tengo", "tuviera", "tendría"], 1),
      q("Si mañana hace sol, ___ a la playa.", ["iremos", "iríamos", "fuéramos"], 0),
      q("Si hubieras venido, te ___.", ["divertirías", "habrías divertido", "hubieras divertido"], 1),
      q("Si yo ___ tú, aceptaría.", ["sería", "fuera", "soy"], 1),
    ],
    controlledTableHint: "Write the verb for a hypothetical condition:",
    controlledTableItems: [
      t("si (yo) tener", "", "tuviera"), t("si (tú) poder", "", "pudieras"), t("si (nosotros) vivir", "", "viviéramos"),
      t("→ (yo) comprar (result)", "", "compraría"), t("si (yo) haber sabido", "", "hubiera sabido"), t("→ (yo) haber venido (result)", "", "habría venido"),
    ],
    controlledBlanksHeading: "Hypotheticals",
    controlledBlanks: [
      b("Si ", "I won", " la lotería, dejaría el trabajo.", "ganara"),
      b("Si tuviera tiempo, ", "I would learn", " a tocar la guitarra.", "aprendería"),
      b("Si ", "it rains", ", no saldremos.", "llueve"),
    ],
    mixedBlanks: [
      b("Si ", "I had known", ", te habría llamado.", "hubiera sabido"),
      b("Si fueras más paciente, ", "you would understand", ".", "entenderías"),
      b("Si ", "we lived", " cerca, nos veríamos más.", "viviéramos"),
      b("Si hubiéramos salido antes, ", "we would have arrived", " a tiempo.", "habríamos llegado"),
      b("Si ", "you study", ", aprobarás.", "estudias"),
      b("Si ", "I were", " presidente, cambiaría muchas cosas.", "fuera"),
    ],
    producePrompts: [
      p("¿Qué harías si pudieras vivir en cualquier país?", "What would you do if you could live in any country?", "Write 5 sentences with si + imperfect subjunctive + conditional."),
      p("Un error del pasado.", "A past mistake.", "Use si hubiera... habría... at least twice."),
      p("Planes según el tiempo.", "Plans depending on the weather.", "Use real conditions: si + present → future."),
    ],
    conversationHint: "In the Speaking tab, play 'What would you do if...?' with your partner — mix real and impossible conditions.",
  }),

  lesson("Passive voice (ser + participle, passive se)", {
    id: "passive",
    noticeHint: "Who did it matters less here. Look at how the verb changes.",
    noticeRows: [
      r("El puente fue", "construi", "do", "en 1900."),
      r("Las cartas fueron", "escrit", "as", "por ella."),
      r("", "", "Se", "venden pisos."),
      r("Aquí", "", "se", "habla español."),
      r("La ley fue", "aprobad", "a", "ayer."),
    ],
    reflectQ: "In the ser-passive, what does the participle agree with? And when is 'se' used instead?",
    reflectReveal: "ser + participle agrees with the subject (las cartas fueron escritas), and por introduces the agent. Passive se is far more common in everyday Spanish when the agent doesn't matter: se vende piso, se venden pisos — the verb agrees with the noun.",
    ruleHint: "Make the participle agree:",
    ruleItems: [
      t("La casa fue", "vendid", "a"), t("Los libros fueron", "publicad", "os"), t("El cuadro fue", "pintad", "o"),
      t("Las puertas fueron", "abiert", "as"), t("(coches) Se", "vend", "en"), t("(piso) Se", "alquil", "a"),
    ],
    structuredHint: "Pick the correct passive:",
    structuredItems: [
      q("La novela fue ___ por Isabel Allende.", ["escrito", "escrita", "escribió"], 1),
      q("___ habitaciones.", ["Se alquila", "Se alquilan", "Alquilan se"], 1),
      q("El ladrón ___ detenido ayer.", ["fue", "era", "estuvo"], 0),
      q("En este restaurante ___ muy bien.", ["se come", "se comen", "es comido"], 0),
    ],
    controlledTableHint: "Write the passive form:",
    controlledTableItems: [
      t("construir — la casa (fue ___)", "", "construida"), t("descubrir — América (fue ___)", "", "descubierta"), t("hacer — los planes (fueron ___)", "", "hechos"),
      t("vender (se) — pisos", "", "se venden"), t("necesitar (se) — camarero", "", "se necesita"), t("prohibir (se) — fumar", "", "se prohíbe"),
    ],
    controlledBlanksHeading: "ser + participle",
    controlledBlanks: [
      b("El Quijote ", "was written", " por Cervantes.", "fue escrito"),
      b("Los resultados ", "were announced", " ayer.", "fueron anunciados"),
      b("La ciudad ", "was destroyed", " en la guerra.", "fue destruida"),
    ],
    mixedBlanks: [
      b("", "is spoken", " inglés.", "Se habla"),
      b("", "are repaired", " bicicletas.", "Se reparan"),
      b("La noticia ", "was published", " en todos los periódicos.", "fue publicada"),
      b("", "is needed", " ayuda.", "Se necesita"),
      b("Las entradas ", "were sold", " en una hora.", "fueron vendidas"),
      b("En España ", "dinner is eaten", " tarde.", "se cena"),
    ],
    producePrompts: [
      p("Escribe la historia de un monumento.", "Write the history of a monument.", "Use ser + participle with por at least three times."),
      p("Escribe anuncios clasificados.", "Write classified ads.", "Use passive se: se vende, se busca, se alquilan..."),
      p("¿Cómo se hace tu plato favorito?", "How is your favourite dish made?", "Describe the steps with passive se."),
    ],
    conversationHint: "In the Speaking tab, explain how things are done in your country — se come..., se celebra...",
  }),

  lesson("Gerunds in complex constructions", {
    id: "gerunds",
    noticeHint: "The -ndo form goes beyond 'estar + -ndo' here. Find it.",
    noticeRows: [
      r("Llevo dos años", "estudi", "ando", "español."),
      r("Sigue", "llov", "iendo", "."),
      r("Aprendí", "practic", "ando", "cada día."),
      r("Va", "mejor", "ando", "poco a poco."),
      r("Salió", "corr", "iendo", "."),
    ],
    reflectQ: "Which verbs pair with the gerund here — and what do they add?",
    reflectReveal: "llevar + time + gerund = have been doing for (llevo dos años estudiando). seguir/continuar + gerund = keep doing. ir + gerund = gradually. venir + gerund = have been (repeatedly). The gerund alone can express manner or means: aprendí practicando. Irregular: leyendo, durmiendo, pidiendo, diciendo.",
    ruleHint: "Type the gerund ending:",
    ruleItems: [
      t("trabajar →", "trabaj", "ando"), t("aprender →", "aprend", "iendo"), t("escribir →", "escrib", "iendo"),
      t("leer →", "le", "yendo"), t("dormir →", "durm", "iendo"), t("pedir →", "pid", "iendo"),
    ],
    structuredHint: "Pick the right construction:",
    structuredItems: [
      q("___ tres horas esperando.", ["Llevo", "Sigo", "Voy"], 0),
      q("A pesar de todo, ___ trabajando.", ["sigue", "lleva", "viene"], 0),
      q("Se aprende un idioma ___.", ["hablar", "hablando", "hablado"], 1),
      q("La situación ___ mejorando poco a poco.", ["va", "lleva", "sale"], 0),
    ],
    controlledTableHint: "Write the gerund:",
    controlledTableItems: [
      t("leer", "", "leyendo"), t("dormir", "", "durmiendo"), t("decir", "", "diciendo"),
      t("ir", "", "yendo"), t("seguir", "", "siguiendo"), t("oír", "", "oyendo"),
    ],
    controlledBlanksHeading: "llevar / seguir",
    controlledBlanks: [
      b("", "I've been living", " aquí cinco años.", "Llevo viviendo"),
      b("¿", "do you still work", " en el banco?", "Sigues trabajando"),
      b("Ellos ", "have been arguing", " toda la tarde.", "llevan discutiendo"),
    ],
    mixedBlanks: [
      b("Aprobé ", "by studying", " mucho.", "estudiando"),
      b("Los precios ", "are gradually going up", ".", "van subiendo"),
      b("El niño entró ", "crying", ".", "llorando"),
      b("", "it keeps snowing", ".", "Sigue nevando"),
      b("Se relaja ", "reading", " novelas.", "leyendo"),
      b("Te lo ", "have been telling", " desde hace meses.", "vengo diciendo"),
    ],
    producePrompts: [
      p("¿Cuánto tiempo llevas haciendo tus aficiones?", "How long have you been doing your hobbies?", "Use llevar + time + gerund at least three times."),
      p("¿Cómo aprendiste a hacer algo?", "How did you learn to do something?", "Explain the method with gerunds of manner (practicando, mirando...)."),
      p("Cambios graduales en tu ciudad.", "Gradual changes in your city.", "Use ir + gerund and seguir + gerund."),
    ],
    conversationHint: "In the Speaking tab, tell your partner how long you've been doing things — llevo... -ando.",
  }),

  lesson("Sequence of tenses", {
    id: "sequence",
    noticeHint: "The main verb's tense decides the tense of the subjunctive. Compare these pairs.",
    noticeRows: [
      r("Quiero que", "veng", "as", "."),
      r("Quería que", "vinie", "ras", "."),
      r("Le diré que", "llam", "e", "."),
      r("Le dije que", "llama", "ra", "."),
      r("Me alegra que", "haya", "s", "venido."),
    ],
    reflectQ: "If the main verb is in the present or future, which subjunctive follows? And if it's in the past or conditional?",
    reflectReveal: "Present/future/command in the main clause → present (or present perfect) subjunctive: Quiero que vengas. Past/conditional in the main clause → imperfect (or pluperfect) subjunctive: Quería que vinieras, Me gustaría que vinieras.",
    ruleHint: "Type the subjunctive ending that fits the sequence:",
    ruleItems: [
      t("Espero que (tú) vengas → Esperaba que", "vinie", "ras"), t("Te pido que (tú)", "llam", "es"), t("Te pedí que (tú)", "llama", "ras"),
      t("Me gustaría que (ellos)", "estudia", "ran"), t("Es importante que (nosotros)", "habl", "emos"), t("Era importante que (nosotros)", "hablá", "ramos"),
    ],
    structuredHint: "Pick the form that matches the main verb:",
    structuredItems: [
      q("Me pidió que lo ___.", ["ayude", "ayudara"], 1),
      q("Te aconsejo que ___ más.", ["duermas", "durmieras"], 0),
      q("Sería mejor que no ___.", ["vengas", "vinieras"], 1),
      q("No creo que lo ___ ya.", ["haya terminado", "hubiera terminado"], 0),
    ],
    controlledTableHint: "Write the subjunctive for the past sequence (quería que...):",
    controlledTableItems: [
      t("tú — venir", "", "vinieras"), t("ella — saber", "", "supiera"), t("nosotros — ir", "", "fuéramos"),
      t("ellos — hacer", "", "hicieran"), t("yo — poder", "", "pudiera"), t("tú — decir", "", "dijeras"),
    ],
    controlledBlanksHeading: "Present sequence",
    controlledBlanks: [
      b("Les recomiendo que ", "they visit", " Toledo.", "visiten"),
      b("Quiero que me ", "you tell", " la verdad.", "digas"),
      b("Ojalá ", "it has arrived", " ya.", "haya llegado"),
    ],
    mixedBlanks: [
      b("Le pedí que ", "he closed", " la puerta.", "cerrara"),
      b("Te aconsejaría que ", "you rested", ".", "descansaras"),
      b("Es necesario que ", "you all come", ".", "vengáis"),
      b("Me sorprendió que no ", "you had called", ".", "hubieras llamado"),
      b("Dudo que ", "he knows", " la respuesta.", "sepa"),
      b("Buscábamos un piso que ", "had", " jardín.", "tuviera"),
    ],
    producePrompts: [
      p("Consejos que te dieron y consejos que das.", "Advice you were given and advice you give.", "Write pairs: me aconsejaron que + imperfect subj. / te aconsejo que + present subj."),
      p("Lo que esperabas y lo que esperas.", "What you hoped for and what you hope for.", "Contrast esperaba que... with espero que..."),
      p("Escribe un correo de queja.", "Write a complaint email.", "Use pedí que, quería que and espero que correctly."),
    ],
    conversationHint: "In the Speaking tab, compare what your teachers wanted from you with what you want now.",
  }),

  lesson("Subordinate clauses (more complex)", {
    id: "subordinate",
    noticeHint: "These connectors build longer sentences. Find the connector — and check the mood after it.",
    noticeRows: [
      r("", "", "Aunque", "llueve, saldremos."),
      r("Te llamo", "", "en cuanto", "llegue."),
      r("", "", "Como", "no había nadie, me fui."),
      r("Lo haré", "", "con tal de que", "me ayudes."),
      r("Salí", "", "sin que", "me vieran."),
    ],
    reflectQ: "Which connectors always take the subjunctive, and which change meaning with the mood?",
    reflectReveal: "Always subjunctive: para que, sin que, antes de que, con tal de que, a menos que. Time connectors (cuando, en cuanto, hasta que) take subjunctive for future ideas. aunque + indicative = although (fact); aunque + subjunctive = even if. como (since/because) and porque take the indicative.",
    ruleHint: "Type the connector:",
    ruleItems: [
      t("(so that) Lo explico ___", "", "para que"), t("(without) Salió ___", "", "sin que"), t("(before) Vete ___", "", "antes de que"),
      t("(as soon as) Avísame ___", "", "en cuanto"), t("(although) ___ estoy cansado...", "", "aunque"), t("(since) ___ era tarde...", "", "como"),
    ],
    structuredHint: "Pick the correct verb:",
    structuredItems: [
      q("Aunque ___ mucho dinero, no es feliz (fact).", ["tiene", "tenga"], 0),
      q("Aunque ___ mucho dinero, no lo compraría (even if).", ["tiene", "tuviera"], 1),
      q("Lo dije para que todos lo ___.", ["supieran", "sabían"], 0),
      q("Como no ___ hambre, no cené.", ["tenía", "tuviera"], 0),
    ],
    controlledTableHint: "Write the connector in Spanish:",
    controlledTableItems: [
      t("unless", "", "a menos que"), t("provided that", "", "con tal de que"), t("until", "", "hasta que"),
      t("so that", "", "para que"), t("before", "", "antes de que"), t("even though / even if", "", "aunque"),
    ],
    controlledBlanksHeading: "Connectors",
    controlledBlanks: [
      b("Iré a la fiesta ", "unless", " llueva.", "a menos que"),
      b("Te lo presto ", "provided that", " me lo devuelvas.", "con tal de que"),
      b("Vámonos ", "before", " empiece a llover.", "antes de que"),
    ],
    mixedBlanks: [
      b("Entró ", "without", " nadie lo notara.", "sin que"),
      b("", "since", " no contestabas, me preocupé.", "Como"),
      b("Esperaré ", "until", " vuelvas.", "hasta que"),
      b("Habla despacio ", "so that", " te entiendan.", "para que"),
      b("", "even if", " me lo pidas, no iré.", "Aunque"),
      b("Llámame ", "as soon as", " sepas algo.", "en cuanto"),
    ],
    producePrompts: [
      p("Escribe las condiciones para prestar tu coche.", "Write the conditions for lending your car.", "Use con tal de que, a menos que and para que."),
      p("Argumenta a favor y en contra de algo.", "Argue for and against something.", "Use aunque with both indicative and subjunctive."),
      p("Planes con condiciones de tiempo.", "Plans with time conditions.", "Use en cuanto, hasta que and antes de que."),
    ],
    conversationHint: "In the Speaking tab, negotiate a favour: set conditions with con tal de que and a menos que.",
  }),

  /* ═══════════════════════════════ C1 ═══════════════════════════════ */
  lesson("Subjunctive: full range (concessive clauses, complex hypotheticals)", {
    id: "subj3",
    noticeHint: "Advanced subjunctive structures. Find the verb that carries the subjunctive.",
    noticeRows: [
      r("Por mucho que", "insist", "as", ", no cambiaré de idea."),
      r("Digan lo que", "dig", "an", ", seguiré adelante."),
      r("Sea como", "", "sea", ", hay que terminarlo."),
      r("De haberlo sabido, no", "habr", "ía", "venido."),
      r("Como no", "estudi", "es", ", suspenderás."),
    ],
    reflectQ: "What does 'por mucho que' add — and why is 'como + subjunctive' a threat, not a cause?",
    reflectReveal: "Concessives: por mucho que / por más que + subjunctive = no matter how much. Reduplicated forms: digan lo que digan, sea como sea, pase lo que pase. como + subjunctive = if (warning): como no estudies, suspenderás. de + perfect infinitive replaces a si-clause: de haberlo sabido = si lo hubiera sabido.",
    ruleHint: "Type the subjunctive ending:",
    ruleItems: [
      t("Por más que (tú)", "grit", "es"), t("Pase lo que", "pas", "e"), t("Haga lo que (él)", "hag", "a"),
      t("Como no (tú)", "lleg", "ues"), t("Por mucho que (ellos)", "trabaj", "en"), t("Quiera o no", "quier", "a"),
    ],
    structuredHint: "Pick the correct form:",
    structuredItems: [
      q("Por mucho que ___, no lo convencerás.", ["hablas", "hables", "hablarás"], 1),
      q("___ lo que pase, te apoyaré.", ["Pase", "Pasa", "Pasará"], 0),
      q("Como ___ tarde otra vez, te despido.", ["llegas", "llegues", "llegarás"], 1),
      q("De ___ antes, habríamos ido.", ["saberlo", "haberlo sabido", "sabido"], 1),
    ],
    controlledTableHint: "Complete the fixed expression:",
    controlledTableItems: [
      t("whatever happens → pase lo que ___", "", "pase"), t("be that as it may → sea como ___", "", "sea"), t("whatever they say → digan lo que ___", "", "digan"),
      t("like it or not → quieras o no ___", "", "quieras"), t("no matter how much → por mucho ___", "", "que"), t("had I known → de ___ sabido", "", "haberlo"),
    ],
    controlledBlanksHeading: "Concessives",
    controlledBlanks: [
      b("Por más que ", "you try", ", no podrás abrirlo.", "lo intentes"),
      b("", "whatever happens", ", llámame.", "Pase lo que pase"),
      b("", "whatever you do", ", hazlo bien.", "Hagas lo que hagas"),
    ],
    mixedBlanks: [
      b("Como no te ", "you hurry", ", perderás el tren.", "des prisa"),
      b("", "had I known", ", te habría avisado.", "De haberlo sabido"),
      b("Por mucho que ", "it costs", ", lo compraré.", "cueste"),
      b("", "be that as it may", ", la decisión está tomada.", "Sea como sea"),
      b("", "whatever they say", ", no me importa.", "Digan lo que digan"),
      b("Por más que ", "he explained", ", nadie lo entendía.", "explicara"),
    ],
    producePrompts: [
      p("Escribe un discurso motivacional.", "Write a motivational speech.", "Use pase lo que pase, por mucho que and sea como sea."),
      p("Advierte a alguien de las consecuencias.", "Warn someone about consequences.", "Use como + subjunctive at least three times."),
      p("Reflexiona sobre una decisión pasada.", "Reflect on a past decision.", "Use de + haber + participle and a pluperfect subjunctive."),
    ],
    conversationHint: "In the Speaking tab, defend a decision no matter what your partner says — digan lo que digan.",
  }),

  lesson("All compound/perfect tenses across moods", {
    id: "perfects2",
    noticeHint: "haber in every mood and tense. Find the form of haber.",
    noticeRows: [
      r("Para el lunes", "habr", "é", "terminado."),
      r("Yo lo", "habr", "ía", "hecho."),
      r("Espero que lo", "hay", "as", "entendido."),
      r("Si lo", "hubier", "as", "dicho..."),
      r("Cuando", "hay", "a", "cenado, saldré."),
    ],
    reflectQ: "Name each tense: habré, habría, haya, hubiera. What does each add?",
    reflectReveal: "Future perfect (habré hecho) = will have done / probably did. Conditional perfect (habría hecho) = would have done. Present perfect subjunctive (haya hecho) after present triggers. Pluperfect subjunctive (hubiera hecho) after past triggers and in impossible si-clauses. All take the same participle.",
    ruleHint: "Type the ending of haber:",
    ruleItems: [
      t("(future perfect, yo)", "habr", "é"), t("(conditional perfect, tú)", "habr", "ías"), t("(pres. perf. subj., él)", "hay", "a"),
      t("(pluperf. subj., nosotros)", "hubié", "ramos"), t("(future perfect, ellos)", "habr", "án"), t("(conditional perfect, nosotros)", "habr", "íamos"),
    ],
    structuredHint: "Pick the right compound form:",
    structuredItems: [
      q("No contesta. ___ salido (probably).", ["Habrá", "Haya", "Hubiera"], 0),
      q("Me alegro de que ___ venido.", ["has", "hayas", "hubieras"], 1),
      q("Si hubieras estudiado, ___ aprobado.", ["habrás", "habrías", "hayas"], 1),
      q("Dudaba que lo ___ hecho solo.", ["haya", "hubiera", "habrá"], 1),
    ],
    controlledTableHint: "Write the compound form:",
    controlledTableItems: [
      t("terminar (yo, future perfect)", "", "habré terminado"), t("ver (tú, conditional perfect)", "", "habrías visto"), t("llegar (él, pres. perf. subj.)", "", "haya llegado"),
      t("decir (nosotros, pluperf. subj.)", "", "hubiéramos dicho"), t("volver (ellos, future perfect)", "", "habrán vuelto"), t("escribir (yo, conditional perfect)", "", "habría escrito"),
    ],
    controlledBlanksHeading: "Future & conditional perfect",
    controlledBlanks: [
      b("En 2030 ", "I will have finished", " la carrera.", "habré terminado"),
      b("Yo no ", "would have said", " eso.", "habría dicho"),
      b("¿Dónde ", "can he have put", " las llaves?", "habrá puesto"),
    ],
    mixedBlanks: [
      b("No creo que ", "they have arrived", " todavía.", "hayan llegado"),
      b("Ojalá ", "I had listened", " a mis padres.", "hubiera escuchado"),
      b("Cuando ", "you have read", " el libro, dímelo.", "hayas leído"),
      b("Para entonces ya ", "we will have left", ".", "habremos salido"),
      b("Si hubieras venido, te ", "you would have liked it", ".", "habría gustado"),
      b("Me molestó que no me ", "you had told", ".", "hubieras avisado"),
    ],
    producePrompts: [
      p("¿Qué habrás conseguido dentro de cinco años?", "What will you have achieved in five years?", "Use the future perfect at least four times."),
      p("Especula sobre un misterio.", "Speculate about a mystery.", "Use habrá + participle to guess what happened."),
      p("Arrepentimientos y alivios.", "Regrets and reliefs.", "Use hubiera/habría and me alegro de que haya..."),
    ],
    conversationHint: "In the Speaking tab, speculate about why a friend didn't show up — habrá perdido el tren...",
  }),

  lesson("Nuanced ser/estar distinctions (idiomatic, non-obvious cases)", {
    id: "serestar2",
    noticeHint: "Same adjective, different verb, different meaning. Find the verb.",
    noticeRows: [
      r("Juan", "", "es", "listo (clever)."),
      r("Juan", "", "está", "listo (ready)."),
      r("La fruta", "", "está", "verde (unripe)."),
      r("El concierto", "", "es", "en el teatro (takes place)."),
      r("Esta sopa", "", "está", "buenísima (tastes)."),
    ],
    reflectQ: "Why is it 'el concierto es en el teatro' but 'el teatro está en el centro'?",
    reflectReveal: "Some adjectives change meaning: ser listo/estar listo, ser aburrido (boring)/estar aburrido (bored), ser malo/estar malo (ill), ser rico (rich)/estar rico (tasty), ser verde/estar verde (unripe). Events 'take place' with ser (la fiesta es en mi casa); objects' location uses estar. estar + adjective can mark a subjective impression: ¡Qué guapa estás!",
    ruleHint: "Type es or está:",
    ruleItems: [
      t("(bored) Pedro ___ aburrido", "", "está"), t("(boring) La clase ___ aburrida", "", "es"), t("(ill) Mi abuelo ___ malo", "", "está"),
      t("(takes place) La boda ___ en Sevilla", "", "es"), t("(tasty) El pastel ___ rico", "", "está"), t("(wealthy) Su familia ___ rica", "", "es"),
    ],
    structuredHint: "Pick ser or estar for the intended meaning:",
    structuredItems: [
      q("¿___ listos? Nos vamos. (ready)", ["Sois", "Estáis"], 1),
      q("La reunión ___ en la sala 3.", ["es", "está"], 0),
      q("Este chico ___ muy despierto (sharp).", ["es", "está"], 0),
      q("Los plátanos todavía ___ verdes.", ["son", "están"], 1),
    ],
    controlledTableHint: "Write es or está for the meaning given:",
    controlledTableItems: [
      t("he is clever", "", "es listo"), t("he is ready", "", "está listo"), t("it's unripe", "", "está verde"),
      t("he's a bad person", "", "es malo"), t("he's sick", "", "está malo"), t("she's alert/awake", "", "está despierta"),
    ],
    controlledBlanksHeading: "Meaning shifts",
    controlledBlanks: [
      b("Mi hermano ", "is bored", " en casa.", "está aburrido"),
      b("Esa película ", "is boring", ".", "es aburrida"),
      b("La cena ", "takes place", " a las nueve.", "es"),
    ],
    mixedBlanks: [
      b("¡Qué guapo ", "you look", " hoy!", "estás"),
      b("Ese profesor ", "is very open-minded", ".", "es muy abierto"),
      b("La tienda ", "is open", ".", "está abierta"),
      b("El café ", "is cold (right now)", ".", "está frío"),
      b("Su padre ", "is dead", ".", "está muerto"),
      b("El examen ", "is", " el lunes.", "es"),
    ],
    producePrompts: [
      p("Describe a alguien en un día raro.", "Describe someone on an unusual day.", "Contrast what they are (ser) with how they seem today (estar)."),
      p("Escribe una invitación a un evento.", "Write an invitation to an event.", "Use ser for where/when it takes place and estar for locations."),
      p("Juega con dobles sentidos.", "Play with double meanings.", "Write 4 sentence pairs showing ser vs. estar meaning shifts."),
    ],
    conversationHint: "In the Speaking tab, review a restaurant: what the place is like (ser) vs. how the food was today (estar).",
  }),

  lesson("Nuanced por/para distinctions", {
    id: "porpara3",
    noticeHint: "Fine-grained por/para contrasts. Each pair changes meaning.",
    noticeRows: [
      r("Trabajo", "", "para", "una empresa (employer)."),
      r("Trabajo", "", "por", "mi hermano (in his place)."),
      r("Estoy", "", "para", "salir (about to)."),
      r("Estoy", "", "por", "salir (inclined to)."),
      r("Eso está", "", "por", "hacer (still to be done)."),
    ],
    reflectQ: "What's the difference between 'estar para' and 'estar por'?",
    reflectReveal: "estar para = about to / in the mood for; estar por = inclined to / still to be done (la casa está por limpiar). trabajar para = for an employer; trabajar por = on behalf of / instead of. Also: para colmo (to top it off), por si acaso (just in case), para siempre (forever), por lo visto (apparently).",
    ruleHint: "Type por or para:",
    ruleItems: [
      t("(about to) Estoy ___ irme", "", "para"), t("(still to do) La tarea está ___ hacer", "", "por"), t("(just in case) ___ si acaso", "", "por"),
      t("(forever) ___ siempre", "", "para"), t("(apparently) ___ lo visto", "", "por"), t("(to top it off) ___ colmo", "", "para"),
    ],
    structuredHint: "Pick the intended meaning:",
    structuredItems: [
      q("No estoy ___ bromas. (in the mood)", ["por", "para"], 1),
      q("Hablo ___ todos cuando digo que estamos contentos.", ["por", "para"], 0),
      q("Lleva un paraguas ___ si acaso.", ["por", "para"], 0),
      q("___ lo visto, ya no viene.", ["Por", "Para"], 0),
    ],
    controlledTableHint: "Write por or para:",
    controlledTableItems: [
      t("I work for Google (employer)", "", "para"), t("I'll cover for you → trabajo ___ ti", "", "por"), t("the bus is about to leave → está ___ salir", "", "para"),
      t("the bill is still unpaid → está ___ pagar", "", "por"), t("for good → ___ siempre", "", "para"), t("by the way → ___ cierto", "", "por"),
    ],
    controlledBlanksHeading: "Idioms",
    controlledBlanks: [
      b("Traigo dos bocadillos ", "just in case", ".", "por si acaso"),
      b("", "apparently", ", la tienda ha cerrado.", "Por lo visto"),
      b("Llegó tarde y, ", "to top it off", ", sin regalo.", "para colmo"),
    ],
    mixedBlanks: [
      b("El tren está ", "about to", " llegar.", "para"),
      b("Quedan muchos problemas ", "yet to", " resolver.", "por"),
      b("Mi tío trabaja ", "for", " el gobierno.", "para"),
      b("Firmé ", "on behalf of", " mi jefe.", "por"),
      b("Te querré ", "forever", ".", "para siempre"),
      b("", "by the way", ", ¿has visto a Luis?", "Por cierto"),
    ],
    producePrompts: [
      p("Escribe una nota a un compañero que te sustituye.", "Write a note to a colleague covering for you.", "Use trabajar por/para and estar por + infinitive."),
      p("Cuenta un día en el que todo salió mal.", "Tell about a day when everything went wrong.", "Use para colmo, por lo visto and por si acaso."),
      p("Describe tareas pendientes en casa.", "Describe pending jobs at home.", "Use estar por + infinitive at least three times."),
    ],
    conversationHint: "In the Speaking tab, plan a trip with your partner using por si acaso, por lo visto and para colmo.",
  }),

  lesson("Reported/indirect speech with tense shifts", {
    id: "reported",
    noticeHint: "Someone's words are being reported. Compare the original tense with the reported tense.",
    noticeRows: [
      r("\"Estoy cansado.\" → Dijo que", "est", "aba", "cansado."),
      r("\"Iré.\" → Dijo que", "ir", "ía", "."),
      r("\"Lo he visto.\" → Dijo que lo", "había", "", "visto."),
      r("\"Ven.\" → Me dijo que", "vinie", "ra", "."),
      r("\"¿Tienes hambre?\" → Me preguntó si", "ten", "ía", "hambre."),
    ],
    reflectQ: "When the reporting verb is in the past, what happens to present, future and perfect tenses? And to commands?",
    reflectReveal: "Present → imperfect (estoy → estaba), future → conditional (iré → iría), present perfect/preterite → pluperfect (he visto → había visto), command → imperfect subjunctive (ven → que viniera). Questions use si or the question word. Also shift pronouns and time words: hoy → ese día, mañana → al día siguiente.",
    ruleHint: "Type the shifted ending:",
    ruleItems: [
      t("\"Vivo aquí\" → dijo que", "viv", "ía"), t("\"Llamaré\" → dijo que", "llamar", "ía"), t("\"Come\" → me dijo que", "comie", "ra"),
      t("\"Estamos bien\" → dijeron que", "est", "aban"), t("\"Saldremos\" → dijeron que", "saldr", "ían"), t("\"Espera\" → me pidió que", "espera", "ra"),
    ],
    structuredHint: "Pick the correctly reported form:",
    structuredItems: [
      q("\"Tengo frío.\" → Dijo que ___ frío.", ["tiene", "tenía", "tuviera"], 1),
      q("\"Lo haré.\" → Prometió que lo ___.", ["hará", "haría", "hiciera"], 1),
      q("\"Siéntate.\" → Me dijo que me ___.", ["sentara", "siento", "sentaba"], 0),
      q("\"¿Dónde vives?\" → Me preguntó dónde ___.", ["vivo", "vivía", "viviera"], 1),
    ],
    controlledTableHint: "Write the reported verb (reporting verb in the past):",
    controlledTableItems: [
      t("\"Trabajo mucho\"", "", "trabajaba"), t("\"Iremos a Roma\"", "", "iríamos"), t("\"He terminado\"", "", "había terminado"),
      t("\"Cierra la puerta\"", "", "cerrara"), t("\"Compré pan\"", "", "había comprado"), t("\"Puedo ayudarte\"", "", "podía"),
    ],
    controlledBlanksHeading: "Statements",
    controlledBlanks: [
      b("\"Estoy enfermo.\" → Dijo que ", "he was", " enfermo.", "estaba"),
      b("\"Vendré mañana.\" → Dijo que ", "he would come", " al día siguiente.", "vendría"),
      b("\"Perdí el móvil.\" → Contó que ", "had lost", " el móvil.", "había perdido"),
    ],
    mixedBlanks: [
      b("\"No llegues tarde.\" → Me pidió que no ", "I arrive", " tarde.", "llegara"),
      b("\"¿Has comido?\" → Me preguntó si ", "I had eaten", ".", "había comido"),
      b("\"Me encanta Madrid.\" → Dijo que le ", "loved", " Madrid.", "encantaba"),
      b("\"Lo haremos.\" → Aseguraron que lo ", "they would do", ".", "harían"),
      b("\"Llámame.\" → Me dijo que lo ", "I call", ".", "llamara"),
      b("\"Hoy hace frío.\" → Dijo que ese día ", "it was", " frío.", "hacía"),
    ],
    producePrompts: [
      p("Cuenta una conversación reciente.", "Report a recent conversation.", "Report at least five statements and questions with tense shifts."),
      p("Resume lo que dijo un político.", "Summarise what a politician said.", "Use afirmó, prometió, aseguró + shifted tenses."),
      p("Repite las instrucciones que te dio alguien.", "Repeat instructions someone gave you.", "Report commands with que + imperfect subjunctive."),
    ],
    conversationHint: "In the Speaking tab, tell your partner what someone told you yesterday — every sentence reported.",
  }),

  lesson("Stylistic word order variation", {
    id: "wordorder",
    noticeHint: "Spanish moves words around for emphasis. Find what has moved to the front or the end.",
    noticeRows: [
      r("", "", "Llegó", "el tren por fin."),
      r("", "", "A María", "la vi ayer."),
      r("", "", "Eso", "no lo sabía yo."),
      r("Lo dijo", "", "él", ", no yo."),
      r("", "", "Muy bonita", "es tu casa."),
    ],
    reflectQ: "What happens when a direct object moves to the front?",
    reflectReveal: "Spanish word order is flexible: new or emphasised information tends to go last (Lo dijo él). A fronted object (topic) needs a resumptive pronoun: A María la vi ayer; Ese libro ya lo he leído. Verbs of appearance often come first: Llegó el tren, Ha empezado la película. Fronting an adjective adds emphasis or style.",
    ruleHint: "Type the resumptive pronoun for the fronted object:",
    ruleItems: [
      t("A Juan ___ conozco", "", "lo"), t("La carta ___ escribí yo", "", "la"), t("Los deberes ya ___ he hecho", "", "los"),
      t("A mis padres ___ llamo cada día", "", "los"), t("Las llaves ___ tiene Ana", "", "las"), t("Eso ya ___ sé", "", "lo"),
    ],
    structuredHint: "Pick the natural, correct version:",
    structuredItems: [
      q("(Emphasise who did it)", ["Él lo dijo.", "Lo dijo él.", "Dijo lo él."], 1),
      q("(Topicalise the book)", ["El libro leí ayer.", "El libro lo leí ayer.", "Lo el libro leí ayer."], 1),
      q("(Neutral: the film started)", ["Empezó la película.", "La película la empezó.", "Empezó la la película."], 0),
      q("(Topicalise Ana)", ["A Ana le di el regalo.", "Ana di el regalo.", "A Ana di le el regalo."], 0),
    ],
    controlledTableHint: "Write the resumptive pronoun (just the pronoun):",
    controlledTableItems: [
      t("A tu hermana ___ vi en el cine.", "", "la"), t("El coche ___ vendimos.", "", "lo"), t("A los niños ___ di caramelos.", "", "les"),
      t("Esa canción no ___ conozco.", "", "la"), t("Las fotos ___ guardo yo.", "", "las"), t("A mí no ___ gusta.", "", "me"),
    ],
    controlledBlanksHeading: "Topic first",
    controlledBlanks: [
      b("Esa película ya ", "I've seen it", ".", "la he visto"),
      b("A tus padres ", "I'll call them", " mañana.", "los llamaré"),
      b("El vino ", "brings it", " Pedro.", "lo trae"),
    ],
    mixedBlanks: [
      b("", "the post arrived", " temprano.", "Llegó el correo"),
      b("La cena ", "I'll make it", " yo.", "la hago"),
      b("A Laura ", "I gave her", " el libro.", "le di"),
      b("Eso no ", "I said it", " yo.", "lo dije"),
      b("Las entradas ", "has them", " mi hermano.", "las tiene"),
      b("", "the meeting has started", ".", "Ha empezado la reunión"),
    ],
    producePrompts: [
      p("Corrige un malentendido.", "Correct a misunderstanding.", "Use end-focus for emphasis: No lo hice yo, lo hizo ella."),
      p("Organiza las tareas de una fiesta.", "Organise the jobs for a party.", "Front each object and use a resumptive pronoun: La comida la traigo yo."),
      p("Narra un momento dramático.", "Narrate a dramatic moment.", "Use verb-first order: Sonó el teléfono, entró un hombre..."),
    ],
    conversationHint: "In the Speaking tab, divide up chores with your partner: 'Los platos los lavo yo, la cena la haces tú.'",
  }),

  lesson("Nominalization, complex connectors", {
    id: "nominal",
    noticeHint: "Ideas turned into nouns, and formal connectors linking them. Find the connector or nominal form.",
    noticeRows: [
      r("", "", "El hecho de que", "llegara tarde me molestó."),
      r("", "", "Lo importante", "es participar."),
      r("La", "construc", "ción", "del puente duró años."),
      r("", "", "No obstante", ", seguimos adelante."),
      r("", "", "Dado que", "no hay tiempo, lo haremos mañana."),
    ],
    reflectQ: "How does Spanish turn an adjective or a verb into a noun? And what do no obstante and dado que mean?",
    reflectReveal: "lo + adjective = the ... thing/part (lo bueno, lo importante). el + infinitive = the act of (el fumar). Verb → noun suffixes: -ción (construir → construcción), -miento (crecer → crecimiento), -dad. el hecho de que + subjunctive. Formal connectors: no obstante / sin embargo (however), dado que / puesto que (given that), por consiguiente (consequently), en cambio (on the other hand), a pesar de (despite).",
    ruleHint: "Type the noun-forming ending:",
    ruleItems: [
      t("construir →", "construc", "ción"), t("crecer →", "creci", "miento"), t("decidir →", "deci", "sión"),
      t("desarrollar →", "desarrol", "lo"), t("libre →", "liber", "tad"), t("cambiar →", "cambi", "o"),
    ],
    structuredHint: "Pick the right connector or nominal form:",
    structuredItems: [
      q("___ es que todos estén bien.", ["Lo importante", "El importante", "La importante"], 0),
      q("Llovía; ___, el partido continuó.", ["dado que", "no obstante", "puesto que"], 1),
      q("___ no había entradas, nos fuimos.", ["Puesto que", "Sin embargo", "En cambio"], 0),
      q("El ___ de que no llamara me preocupó.", ["hecho", "hacer", "hizo"], 0),
    ],
    controlledTableHint: "Write the Spanish connector or nominal form:",
    controlledTableItems: [
      t("however (formal)", "", "no obstante"), t("given that", "", "dado que"), t("consequently", "", "por consiguiente"),
      t("on the other hand", "", "en cambio"), t("the good thing", "", "lo bueno"), t("the fact that", "", "el hecho de que"),
    ],
    controlledBlanksHeading: "Connectors",
    controlledBlanks: [
      b("El plan es caro. ", "however", ", es necesario.", "No obstante"),
      b("", "given that", " es festivo, la tienda está cerrada.", "Dado que"),
      b("Ha subido el precio; ", "consequently", ", venden menos.", "por consiguiente"),
    ],
    mixedBlanks: [
      b("", "the worst thing", " fue el tráfico.", "Lo peor"),
      b("La ", "growth", " de la ciudad ha sido rápido.", "crecimiento"),
      b("Mi hermano es tímido; yo, ", "on the other hand", ", no.", "en cambio"),
      b("", "despite", " la lluvia, salimos.", "A pesar de"),
      b("La ", "decision", " fue difícil.", "decisión"),
      b("", "the fact that", " no contestes me preocupa.", "El hecho de que"),
    ],
    producePrompts: [
      p("Escribe un párrafo de opinión formal.", "Write a formal opinion paragraph.", "Use no obstante, dado que, por consiguiente and en cambio."),
      p("Resume un problema social con sustantivos.", "Summarise a social problem using nouns.", "Use at least four nominalisations (-ción, -miento, lo + adj.)."),
      p("Lo mejor y lo peor de tu ciudad.", "The best and worst of your city.", "Use lo + adjective at least four times."),
    ],
    conversationHint: "In the Speaking tab, hold a formal debate — structure every argument with a connector.",
  }),
]);
