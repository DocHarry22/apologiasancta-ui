const scripture = (reference, paraphrase) => ({ reference, paraphrase });

const bundles = {
  revelation: [
    scripture("Hebrews 1:1-2", "God's many earlier communications reach their decisive fullness in the Son; revelation is first God's action and gift, not a human discovery."),
    scripture("2 Timothy 3:14-17", "The sacred writings lead toward salvation in Christ and equip God's servant; inspiration and the formative purpose of Scripture belong together."),
    scripture("1 Timothy 3:14-15", "The apostolic letter describes the household of God as the Church and assigns it a public responsibility for the truth."),
  ],
  salvation: [
    scripture("Genesis 12:1-3", "God calls Abraham and orders the promised blessing toward all families, establishing a covenantal horizon wider than one household."),
    scripture("Luke 24:25-27, 44-49", "The risen Jesus reads Israel's Scriptures as a coherent witness to his suffering, glory, and the mission of repentance to the nations."),
    scripture("Galatians 3:6-29", "Paul connects Abraham's promise, Christ, faith, baptism, and a people gathered across former divisions without treating Israel's history as disposable."),
  ],
  trinity: [
    scripture("Deuteronomy 6:4-5", "Israel confesses the one Lord and is summoned to undivided love; Christian Trinitarian faith never abandons biblical monotheism."),
    scripture("Matthew 28:18-20", "The risen Jesus commands one baptismal mission naming Father, Son, and Holy Spirit together."),
    scripture("2 Corinthians 13:13", "Paul's blessing coordinates the grace of Christ, the love of God, and the communion of the Holy Spirit in Christian life."),
  ],
  christ: [
    scripture("John 1:1-18", "John identifies the Word in relation to God and as divine, then proclaims that the Word truly became flesh and made the Father known."),
    scripture("Philippians 2:5-11", "Christ's self-humbling, obedience unto death, and exaltation form one movement and ground the pattern of Christian discipleship."),
    scripture("1 Corinthians 15:1-8, 20-28", "Paul transmits the received gospel of Christ's death, burial, appearances, and resurrection, then unfolds its consequences for humanity and creation."),
  ],
  church: [
    scripture("Matthew 16:13-20", "Peter's confession, the promise concerning Christ's Church, and the imagery of keys and binding belong to one ecclesial scene."),
    scripture("Acts 15:1-29", "The Jerusalem gathering resolves a disputed missionary question through testimony, scriptural reasoning, apostolic deliberation, and a decision attributed to the Holy Spirit."),
    scripture("Ephesians 4:1-16", "The Church receives one faith and diverse ministries so that the whole body may grow into mature unity in Christ."),
  ],
  grace: [
    scripture("Romans 3:21-31", "Paul locates justification in God's grace and Christ's redeeming work, excluding boasting while refusing to make God's law meaningless."),
    scripture("Ephesians 2:1-10", "Salvation is God's gracious gift rather than a human achievement, and the saved are recreated in Christ for the good works God intends."),
    scripture("James 2:14-26", "James rejects a claim to faith that remains barren; living faith is shown in obedient action rather than replaced by it."),
  ],
  sacrament: [
    scripture("John 6:22-71", "Jesus presents himself as the life-giving bread from heaven and presses his hearers beyond merely material expectations."),
    scripture("Luke 22:14-20", "At the Passover meal Jesus identifies the bread and cup with his self-gift and commands the memorial action of the new covenant."),
    scripture("1 Corinthians 10:16-17; 11:23-29", "Paul joins Eucharistic participation to communion in Christ, ecclesial unity, received tradition, and serious moral discernment."),
  ],
  eschatology: [
    scripture("Matthew 25:31-46", "Jesus presents final judgment as his own royal act and exposes the eternal weight of concrete love or neglect of the vulnerable."),
    scripture("1 Corinthians 15:35-58", "Paul defends bodily resurrection as transformation by God's power, not the mere continuation of present biological conditions."),
    scripture("Revelation 21:1-5, 22-27", "The biblical hope culminates in renewed creation, God's dwelling with humanity, judgment, healing, and the holy city."),
  ],
  mary: [
    scripture("Luke 1:26-56", "Mary receives God's initiative in faith, consents to the incarnation, and praises the covenant mercy fulfilled through her Son."),
    scripture("John 2:1-12", "At Cana Mary directs attention to Jesus, while his sign manifests glory and moves the disciples toward faith."),
    scripture("John 19:25-27; Revelation 12:1-17", "John places the mother of Jesus beside the cross and later portrays a symbolic mother within the conflict involving Messiah and his people; the texts require careful literary distinction."),
  ],
  saints: [
    scripture("Hebrews 12:1-2, 22-24", "Christian perseverance is pictured in the presence of a great cloud of witnesses and the heavenly assembly gathered around Jesus."),
    scripture("Revelation 5:6-10; 8:1-4", "Heavenly worship portrays the prayers of the holy ones offered before God through symbolic liturgical imagery."),
    scripture("2 Maccabees 12:38-46", "The narrative presents prayer and an offering for fallen Israelites in light of resurrection hope and accountability before God."),
  ],
  moral: [
    scripture("Matthew 5:1-48", "Jesus announces beatitude and interprets obedience at the level of reconciled hearts, truthful speech, chastity, enemy-love, and likeness to the Father."),
    scripture("Romans 12:1-21", "Christian morality is worship embodied through transformed judgment, humble gifts, sincere love, patience, peace, and overcoming evil with good."),
    scripture("Galatians 5:13-26", "Freedom is ordered to loving service; Paul contrasts destructive works with the Spirit's fruit in a life belonging to Christ."),
  ],
  life: [
    scripture("Genesis 1:26-31", "Human beings, male and female, are created in God's image and receive creaturely responsibility within a creation declared good."),
    scripture("Psalm 139:1-18", "The psalmist prays from the conviction that God's knowledge and care embrace the whole embodied life, including hidden beginnings."),
    scripture("Matthew 25:31-46", "Christ identifies service or neglect of vulnerable persons with a response made to him, giving ordinary acts grave moral significance."),
  ],
  marriage: [
    scripture("Genesis 2:18-25", "The creation narrative presents bodily kinship, mutual belonging, and the one-flesh union as gifts answering human solitude."),
    scripture("Matthew 19:3-12", "Jesus answers a divorce controversy by returning to the Creator's purpose and the covenantal unity of marriage, while also acknowledging celibacy for the kingdom."),
    scripture("Ephesians 5:21-33", "Christian marriage is placed under mutual life in Christ and interpreted through Christ's self-giving love for the Church."),
  ],
  prayer: [
    scripture("Matthew 6:5-15", "Jesus rejects prayer as performance, directs disciples to the Father, and teaches a pattern ordered to God's name, kingdom, daily need, forgiveness, and deliverance."),
    scripture("Luke 11:1-13", "Jesus joins the pattern of prayer to persevering petition and confidence in the Father's gift of the Holy Spirit."),
    scripture("Romans 8:14-27", "Christian prayer is filial life in the Spirit, who assists weakness and intercedes when words fail."),
  ],
  social: [
    scripture("Isaiah 58:1-12", "The prophet rejects religious observance severed from justice and links authentic fasting with liberation, provision, and repaired community."),
    scripture("Luke 4:16-21", "Jesus announces his Spirit-anointed mission using Isaiah's language of good news, freedom, sight, and divine favour."),
    scripture("Acts 4:32-35", "The Jerusalem community responds to grace through unity, testimony, voluntary sharing, and concrete provision for need."),
  ],
  reason: [
    scripture("Wisdom 13:1-9", "The text criticises failure to reason from the beauty and power of created realities toward their Maker while recognising the difficulty of the search."),
    scripture("Romans 1:18-25", "Paul treats creation as genuinely disclosive of divine power while diagnosing the moral distortion that can redirect worship toward creatures."),
    scripture("Acts 17:16-34", "Paul engages Athenian religion and philosophy through shared points, correction, creation, providence, repentance, and the resurrection."),
  ],
  suffering: [
    scripture("Job 1:1-22; 38:1-42:6", "Job's integrity and protest expose the failure of simplistic retribution, while God's answer enlarges the question without trivialising Job's suffering."),
    scripture("Luke 13:1-9", "Jesus refuses to rank recent victims as worse sinners and turns the question toward universal repentance and patient mercy."),
    scripture("Romans 8:18-39", "Paul places present suffering within creation's groaning, the Spirit's help, future glory, and the inseparable love of God in Christ."),
  ],
  science: [
    scripture("Genesis 1:1-2:4", "The ordered creation account confesses God as Creator and the goodness and vocation of creation; its theological claims must not be confused with a modern laboratory report."),
    scripture("Wisdom 11:20-26", "Divine wisdom is praised through the order and measure of creation and through God's sustaining mercy toward all that exists."),
    scripture("Psalm 19:1-7", "Creation is poetically portrayed as bearing witness to divine glory without turning that witness into a scientific mechanism."),
  ],
  interreligious: [
    scripture("Genesis 1:26-27", "Shared human dignity rests on creation in God's image and governs Christian speech about every neighbour."),
    scripture("Acts 17:22-34", "Paul listens, identifies points of contact, corrects error, and proclaims creation, repentance, judgment, and resurrection without contempt."),
    scripture("1 Peter 3:15-16", "Christian explanation is joined to reverence, a clear conscience, and conduct that does not betray the hope being defended."),
  ],
};
const rule = (pattern, key, cccLocators, magisterialSourceId, magisterialLocator, historicalSourceId, historicalLocator, secondarySourceId, secondaryLocator) => ({
  pattern,
  key,
  cccLocators,
  magisterialSourceId,
  magisterialLocator,
  historicalSourceId,
  historicalLocator,
  secondarySourceId,
  secondaryLocator,
});

const rules = [
  rule(/revelation-faith|scripture-canon/, "revelation", ["CCC 50-73", "CCC 74-141"], "src.vatican2.dei-verbum", "sections 2-13 and 21-26", "src.augustine.christian-doctrine", "Books I and III", "src.scholarship.new-jerome-biblical-commentary", "articles on inspiration, interpretation, and canon"),
  rule(/salvation-history/, "salvation", ["CCC 54-73", "CCC 702-716"], "src.vatican2.dei-verbum", "sections 3-4, 14-16", "src.irenaeus.against-heresies", "Book III; recapitulation and the rule of faith", "src.scholarship.new-jerome-biblical-commentary", "articles on biblical theology and salvation history"),
  rule(/god-trinity-creation|divine-attributes|^trinity$/, "trinity", ["CCC 198-267", "CCC 268-421"], "src.vatican2.dei-verbum", "sections 2-6", "src.irenaeus.against-heresies", "Books I and III", "src.aquinas.summa-theologiae", "Part I, questions on God, Trinity, creation, and providence"),
  rule(/christ-paschal-mystery|christology|redemption-resurrection/, "christ", ["CCC 422-570", "CCC 571-682"], "src.vatican2.lumen-gentium", "sections 2-8", "src.irenaeus.against-heresies", "Book III; Christ and recapitulation", "src.conciliar.tanner-decrees", "Nicaea I, Ephesus, Chalcedon, and Constantinople III as relevant"),
  rule(/church-grace-sacraments|church-authority|apostolic-succession|papacy-magisterium/, "church", ["CCC 748-945", "CCC 946-975"], "src.vatican2.lumen-gentium", "sections 1-29 and 37", "src.irenaeus.against-heresies", "Book III; apostolic tradition and succession", "src.history.chadwick-early-church", "chapters on apostolic ministry and early ecclesial order"),
  rule(/grace-justification-salvation/, "grace", ["CCC 1987-2029", "CCC 2030-2051"], "src.vatican2.dei-verbum", "section 5", "src.augustine.christian-doctrine", "Book I; grace, love, and the Christian end", "src.conciliar.tanner-decrees", "Orange II and Trent, Decree on Justification"),
  rule(/sacraments|eucharist|liturgy/, "sacrament", ["CCC 1066-1209", "CCC 1210-1419"], "src.vatican2.sacrosanctum-concilium", "sections 5-14 and 47-61", "src.justin.first-apology", "chapters 61 and 65-67", "src.conciliar.tanner-decrees", "Trent, decrees on the sacraments and Eucharist as relevant"),
  rule(/eschatology/, "eschatology", ["CCC 988-1065", "CCC 1680-1690"], "src.vatican2.lumen-gentium", "sections 48-51", "src.cyril.catechetical-lectures", "Catechetical Lecture 18", "src.conciliar.tanner-decrees", "Florence and Trent on final things as relevant"),
  rule(/^mary$/, "mary", ["CCC 484-511", "CCC 963-975"], "src.vatican2.lumen-gentium", "sections 52-69", "src.irenaeus.against-heresies", "Book III; Eve-Mary typology", "src.conciliar.tanner-decrees", "Ephesus and later Marian definitions as relevant"),
  rule(/saints-communion/, "saints", ["CCC 946-962", "CCC 1020-1065"], "src.vatican2.lumen-gentium", "sections 48-51", "src.cyril.catechetical-lectures", "Mystagogical catecheses on the Eucharistic commemoration", "src.conciliar.tanner-decrees", "Nicaea II and Trent as relevant"),
  rule(/moral-prayer-foundations|moral-theology|conscience-virtue-sin/, "moral", ["CCC 1691-1876", "CCC 1949-2051"], "src.vatican2.gaudium-et-spes", "sections 16-17 and 22-32", "src.augustine.christian-doctrine", "Book I; ordered love and use of created goods", "src.aquinas.summa-theologiae", "Parts I-II and II-II, questions relevant to acts and virtues"),
  rule(/life-bioethics/, "life", ["CCC 2258-2330", "CCC 2270-2296"], "src.ddf.dignitas-infinita", "sections 7-32 and 47-62", "src.didache", "chapters 1-2", "src.vatican2.gaudium-et-spes", "sections 12-27 and 51"),
  rule(/marriage-sexuality-family/, "marriage", ["CCC 1601-1666", "CCC 2331-2400"], "src.vatican2.gaudium-et-spes", "sections 47-52", "src.didache", "chapters 1-4", "src.ddf.dignitas-infinita", "sections on human dignity and embodied life"),
  rule(/prayer-spiritual-life/, "prayer", ["CCC 2558-2758", "CCC 2759-2865"], "src.jp2.catechesi-tradendae", "sections 54-55 and 72", "src.cyril.catechetical-lectures", "Procatechesis and Catechetical Lecture 5", "src.augustine.christian-doctrine", "Book I; enjoyment of God and ordered love"),
  rule(/catholic-social-teaching/, "social", ["CCC 1877-1948", "CCC 2401-2463"], "src.vatican2.gaudium-et-spes", "sections 23-32 and 63-93", "src.didache", "chapters 1-4", "src.ddf.dignitas-infinita", "sections 7-32 and 33-62"),
  rule(/philosophy-logic|natural-theology|atheism-secularism|debate-source-evaluation/, "reason", ["CCC 27-49", "CCC 156-184"], "src.jp2.fides-et-ratio", "sections 1-35 and 80-99", "src.aquinas.summa-theologiae", "Part I, questions 1-13", "src.secular.representative-sources", "named argument or declaration identified in the lesson"),
  rule(/problem-evil/, "suffering", ["CCC 309-324", "CCC 385-421"], "src.vatican2.gaudium-et-spes", "sections 10, 18, and 22", "src.augustine.christian-doctrine", "Books I and III", "src.aquinas.summa-theologiae", "Part I, questions on providence, evil, and divine governance"),
  rule(/faith-science/, "science", ["CCC 31-35", "CCC 279-324"], "src.jp2.fides-et-ratio", "sections 25-35 and 64-79", "src.augustine.christian-doctrine", "Book III; figurative language and interpretation", "src.science.nas-evolution", "chapters on the nature of science and evidence for evolution"),
  rule(/church-history|church-fathers|councils-heresies/, "church", ["CCC 74-100", "CCC 817-870"], "src.vatican2.lumen-gentium", "sections 8, 18-27, and 39-51", "src.eusebius.church-history", "book and chapter identified by the historical question", "src.history.chadwick-early-church", "chapter identified by the historical question"),
  rule(/protestant-controversies|eastern-orthodox-relations/, "church", ["CCC 74-100", "CCC 811-870"], "src.vatican2.unitatis-redintegratio", "sections 1-24", "src.irenaeus.against-heresies", "Book III; apostolic faith and succession", "src.conciliar.tanner-decrees", "the council or decree directly relevant to the controversy"),
  rule(/islam-christianity|judaism-christianity|world-religions|new-religious-movements/, "interreligious", ["CCC 839-856", "CCC 2104-2109"], "src.vatican2.nostra-aetate", "sections 1-5", "src.justin.first-apology", "chapters 1-8; reasoned Christian witness", "src.jp2.fides-et-ratio", "sections 70-72"),
  rule(/apologist-lab|expert-challenges/, "interreligious", ["CCC 74-100", "CCC 156-175"], "src.vatican2.dei-verbum", "sections 11-13 and 21-26", "src.augustine.christian-doctrine", "Books I and III", "src.jp2.fides-et-ratio", "sections 80-99"),
];

const comparativeRules = [
  [/orthodox/i, "src.orthodox.oca-faith"],
  [/lutheran/i, "src.lutheran.augsburg-confession"],
  [/anglican/i, "src.anglican.cofe-canons-a"],
  [/methodist|wesleyan/i, "src.methodist.articles-religion"],
  [/baptist/i, "src.baptist.bfm-2000"],
  [/reformed|protestant|pentecostal|evangelical|adventist/i, "src.reformed.westminster-confession"],
  [/islam|sunni|shia|ahmadi/i, "src.islam.quran"],
  [/judaism|jewish/i, "src.judaism.primary-corpus"],
  [/hindu|buddhist|sikh|chinese|indigenous|bah/i, "src.religions.primary-texts"],
  [/latter-day|jehovah|christian science|new age|esoteric|high-control/i, "src.lds.articles-faith"],
  [/atheis|agnostic|humanis|naturalism|secular|liberal|conservative|socialist|libertarian|nationalist|philosoph|theodic|creationism|intelligent design|evolutionary/i, "src.secular.representative-sources"],
  [/selected according|multiple traditions|all comparative/i, "src.secular.representative-sources"],
];

export const resolveComparativeSourceIds = (traditions = []) => {
  const ids = new Set();
  for (const tradition of traditions) {
    for (const [pattern, sourceId] of comparativeRules) if (pattern.test(tradition)) ids.add(sourceId);
    if (/jehovah/i.test(tradition)) ids.add("src.jw.official-beliefs");
  }
  return [...ids];
};

export const profileForSubject = (subject) => {
  if (subject.programmeId === "prog.bible-books") {
    return {
      key: "bible",
      scriptureEvidence: [
        scripture(`${subject.name} (opening movement)`, `Read the opening of ${subject.name} to identify how its setting, voices, and first tensions introduce ${subject.canonicalMetadata.themes}. This is a study paraphrase, not translation text.`),
        scripture(`${subject.name} (central movement)`, `Read the central movement of ${subject.name} for the way its literary development tests, deepens, or reorders the themes of ${subject.canonicalMetadata.themes}.`),
        scripture(`${subject.name} (concluding movement)`, `Read the conclusion of ${subject.name} to see which questions are resolved, which promises remain open, and how the book points beyond itself within the canon.`),
      ],
      cccLocators: ["CCC 101-114", "CCC 115-141"],
      magisterialSourceId: "src.vatican2.dei-verbum",
      magisterialLocator: "sections 11-13 and 21-26",
      historicalSourceId: "src.augustine.christian-doctrine",
      historicalLocator: "Book III; rules for interpreting signs and difficult passages",
      secondarySourceId: "src.scholarship.new-jerome-biblical-commentary",
      secondaryLocator: `article on ${subject.name}`,
    };
  }
  const id = subject.stableId.replace(/^subj\./, "");
  const selected = rules.find((item) => item.pattern.test(id)) ?? rules[0];
  return { ...selected, scriptureEvidence: bundles[selected.key] };
};

const glossary = [
  [/dogma/i, "Dogma", "A truth contained in divine revelation, or necessarily connected with it, that the Church proposes definitively for belief."],
  [/doctrine/i, "Doctrine", "A teaching proposed by the Church; its authority and required assent depend on what is taught and how it is proposed."],
  [/discipline|practice/i, "Discipline", "An authoritative rule or practice governing ecclesial life; unlike dogma, a discipline may admit legitimate diversity or change."],
  [/revelation/i, "Revelation", "God's self-communication in deeds and words, brought to fullness in Jesus Christ."],
  [/faith/i, "Faith", "The grace-enabled human response by which a person entrusts self and intellect to God who reveals."],
  [/tradition/i, "Sacred Tradition", "The living transmission of the apostolic faith in the Church under the Holy Spirit, distinct from merely human customs."],
  [/magisterium|authority/i, "Magisterium", "The Church's living teaching office, exercised by the pope and bishops in communion, serving the word of God rather than standing above it."],
  [/scripture|bible/i, "Sacred Scripture", "The inspired canonical writings received by the Church as the word of God in human words."],
  [/canon/i, "Canon", "The normative list of books received by the Church as Sacred Scripture; canon, textual form, translation, and lectionary are related but distinct."],
  [/inspiration/i, "Inspiration", "The Holy Spirit's action by which God is author of Scripture while human authors truly use their own powers and faculties."],
  [/inerrancy|truth/i, "Biblical truth", "What God wished to be written for the sake of salvation, interpreted according to authorial intention, genre, and the unity of Scripture."],
  [/covenant|testament/i, "Covenant", "A divinely initiated bond of communion that creates obligations, promises, and a people."],
  [/typolog/i, "Typology", "A canonical relationship in which earlier persons, events, or institutions prefigure later fulfilment without losing their literal historical meaning."],
  [/trinity/i, "Trinity", "The one God eternally subsisting as Father, Son, and Holy Spirit: three divine Persons, one divine nature."],
  [/nature/i, "Nature", "What something is, considered as the source of its characteristic operations; nature is not another word for person."],
  [/person/i, "Person", "The distinct who that subsists and acts; in Trinitarian and Christological theology the term is used analogically and precisely."],
  [/essence|substance/i, "Essence", "That by which a thing is what it is; in God, the one undivided divine essence is wholly possessed by each divine Person."],
  [/relation/i, "Relation", "An ordered reference to another; Trinitarian relations distinguish the Persons without dividing the divine nature."],
  [/creation/i, "Creation", "God's free act of giving existence to all that is not God and sustaining creatures in being."],
  [/providence/i, "Providence", "God's wise and loving ordering of creation toward its end through divine governance and genuine created causes."],
  [/incarnation|word made flesh/i, "Incarnation", "The eternal Son's assumption of a complete human nature without ceasing to be divine."],
  [/hypostatic/i, "Hypostatic union", "The union of complete divine and human natures in the one divine Person of the Son."],
  [/paschal/i, "Paschal Mystery", "Christ's saving Passion, death, Resurrection, and glorification considered as one redemptive mystery."],
  [/redemption|atonement/i, "Redemption", "Christ's saving liberation of humanity from sin and death through his obedient self-gift and victorious Resurrection."],
  [/resurrection/i, "Resurrection", "God's raising of Jesus bodily into transformed, immortal life and the promised raising of the dead in him."],
  [/church|eccles/i, "Church", "The people gathered by the Father through Christ in the Holy Spirit, at once spiritual communion and visible apostolic society."],
  [/succession/i, "Apostolic succession", "The historical and sacramental continuity of episcopal ministry ordered to preserving apostolic faith and communion."],
  [/papacy|pope|peter/i, "Petrine ministry", "The ministry of the bishop of Rome as successor of Peter, serving the Church's visible unity and confession of faith."],
  [/infallib/i, "Infallibility", "A charism preserving the Church from error under defined conditions when teaching definitively on faith or morals; it is not impeccability or omniscience."],
  [/grace/i, "Grace", "God's free and undeserved gift of divine life and help, healing and elevating the human person."],
  [/justification/i, "Justification", "God's gracious forgiveness and interior renewal by which a sinner is made righteous in Christ."],
  [/merit/i, "Merit", "The graced fittingness of reward for actions performed in Christ; it never makes God's first gift a human entitlement."],
  [/sacrament/i, "Sacrament", "An efficacious ecclesial sign of grace, instituted by Christ and entrusted to the Church."],
  [/eucharist|mass/i, "Eucharist", "The sacrament of Christ's Body and Blood, the memorial of his Passover, sacrificial banquet, and source of ecclesial communion."],
  [/transubstantiation/i, "Transubstantiation", "The change of the whole substance of bread and wine into Christ's Body and Blood while sensible appearances remain."],
  [/liturgy/i, "Liturgy", "The public worship of Christ and his Church in which the Paschal Mystery is proclaimed and sacramentally celebrated."],
  [/mary|marian/i, "Theotokos", "The title 'God-bearer' or 'Mother of God,' safeguarding that the one born of Mary is the divine Person of the Son."],
  [/saint|communion/i, "Communion of saints", "Communion in holy things and among holy persons in Christ across the pilgrim, purifying, and glorified Church."],
  [/virtue/i, "Virtue", "A stable disposition perfecting human powers for good action; theological virtues are infused gifts ordering the person directly to God."],
  [/conscience/i, "Conscience", "A judgment of practical reason about the moral quality of a concrete act, which must be formed and followed sincerely."],
  [/sin/i, "Sin", "A culpable offence against reason, truth, and right conscience that wounds love of God and neighbour."],
  [/prayer/i, "Prayer", "The living covenantal relationship of God's children with the Father, through the Son, in the Holy Spirit."],
  [/dignity|human life/i, "Human dignity", "The inherent worth of every human person, grounded in creation in God's image and fulfilled in the call to communion with God."],
  [/marriage|family/i, "Marriage", "The covenant by which a man and a woman establish a partnership of the whole of life, ordered to their good and the generation and education of children."],
  [/common good|social/i, "Common good", "The social conditions enabling persons and communities to reach fulfilment more fully and readily."],
  [/subsidiarity/i, "Subsidiarity", "The principle that larger authorities should support, not absorb, the proper agency of persons and smaller communities."],
  [/solidarity/i, "Solidarity", "A stable commitment to the good of each and all because human persons are mutually responsible."],
  [/logic|argument|reasoning/i, "Argument", "A set of premises offered in support of a conclusion; validity and truth of premises must be assessed separately."],
  [/science|evolution|cosmolog/i, "Empirical science", "Systematic inquiry into observable natural realities through testable methods; its competence is real but not identical with philosophy or theology."],
  [/evil|suffering/i, "Theodicy", "A reasoned attempt to show that God's goodness and power are compatible with the reality of evil; no single theodicy is itself a dogma."],
  [/dialogue|comparative|religion/i, "Comparative scope", "The exact community, school, source, period, and degree of authority to which a description applies."],
];

export const terminologyFor = (outline, subject, profile) => {
  const haystack = `${outline.title} ${subject.name} ${subject.description}`;
  const matches = glossary.filter(([pattern]) => pattern.test(haystack)).slice(0, 4);
  const selected = matches.length >= 3 ? matches : [
    ...matches,
    [/source/i, "Primary source", "A text, artefact, or record arising from the authority, community, person, or period being studied."],
    [/classification/i, "Doctrinal classification", "A label distinguishing Catholic dogma or doctrine from discipline, theological opinion, and historical, philosophical, or scientific claims."],
    [/synthesis/i, "Catholic synthesis", "An account that coordinates Scripture, Tradition, Magisterium, reason, and history without treating those sources as interchangeable."],
  ].slice(0, 3);
  return selected.slice(0, 4).map(([, term, definition]) => ({
    term,
    definition,
    sourceIds: ["src.ccc.main", profile.magisterialSourceId],
  }));
};
