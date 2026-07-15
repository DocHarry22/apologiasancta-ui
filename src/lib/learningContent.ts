export type LearningSource = {
  label: string;
  reference: string;
  url: string;
  kind: "Catechism" | "Scripture" | "Council";
};

export type LearningSection = {
  heading: string;
  paragraphs: string[];
  keyPoint?: string;
};

export type LearningLesson = {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  summary: string;
  durationMinutes: number;
  difficulty: "Foundation" | "Intermediate";
  objectives: string[];
  sections: LearningSection[];
  objection: {
    claim: string;
    response: string;
  };
  sources: LearningSource[];
};

export type PracticeQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  choices: Array<{ id: "a" | "b" | "c" | "d"; label: string }>;
  correctId: "a" | "b" | "c" | "d";
  explanation: string;
  references: string[];
};

export const learningPath = {
  id: "foundations-of-catholic-apologetics",
  title: "Foundations of Catholic Apologetics",
  description:
    "Build a sourced, charitable case for how Catholics receive revelation, understand the Eucharist, explain Petrine authority, and speak about grace and works.",
  lessons: [
    {
      id: "scripture-tradition-magisterium",
      order: 1,
      title: "Scripture, Tradition, and the Magisterium",
      subtitle: "One deposit of faith, faithfully handed on",
      summary:
        "Learn why Catholic teaching does not place the Church above God’s word, but understands Scripture, apostolic Tradition, and the teaching office as ordered to one deposit of revelation.",
      durationMinutes: 12,
      difficulty: "Foundation",
      objectives: [
        "Distinguish apostolic Tradition from merely human customs.",
        "Explain why the Magisterium serves the word of God rather than replacing it.",
        "Use 2 Thessalonians 2:15 and 1 Timothy 3:15 in context.",
      ],
      sections: [
        {
          heading: "Start with revelation, not a slogan",
          paragraphs: [
            "The Catholic claim is not that three competing authorities exist. Christ entrusted the Gospel to the apostles, who handed it on by preaching, worship, life, and inspired writing.",
            "Sacred Tradition means this apostolic transmission. It is different from changeable disciplines or local customs, which can be useful without belonging to the deposit of faith.",
          ],
          keyPoint: "Scripture and apostolic Tradition flow from the same divine source and serve the same Gospel.",
        },
        {
          heading: "What the Magisterium actually does",
          paragraphs: [
            "The Pope and the bishops in communion with him have the task of authentically interpreting the word of God. This office is ministerial: it listens, guards, and explains what has been handed on.",
            "An apologetic answer should therefore avoid saying that Catholics believe something merely because an authority declared it. Show the biblical and apostolic substance that the Church is safeguarding.",
          ],
        },
        {
          heading: "A concise answer",
          paragraphs: [
            "When asked whether Catholics reject Scripture alone, begin positively: Catholics receive the inspired Scriptures as the word of God and also obey the apostolic command to hold fast to what was handed on in writing and by word of mouth.",
            "Then define terms. The Magisterium is not a new revelation and cannot stand above God’s word; it is the servant charged with preserving and interpreting the apostolic deposit.",
          ],
        },
      ],
      objection: {
        claim: "Catholics put Church tradition above the Bible.",
        response:
          "Catholic teaching explicitly says the teaching office is not above the word of God. The dispute is about whether the apostolic faith was transmitted only as inspired text or also through authoritative apostolic preaching and practice. Scripture itself commands Christians to hold to both written and oral apostolic traditions.",
      },
      sources: [
        {
          label: "Catechism of the Catholic Church",
          reference: "CCC 74–100",
          url: "https://www.vatican.va/content/catechism/en/part_one/section_one/chapter_two/artcile_2.html",
          kind: "Catechism",
        },
        {
          label: "Dei Verbum",
          reference: "DV 7–10",
          url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html",
          kind: "Council",
        },
        {
          label: "Second Thessalonians",
          reference: "2 Thessalonians 2:15",
          url: "https://bible.usccb.org/bible/2thessalonians/2",
          kind: "Scripture",
        },
        {
          label: "First Timothy",
          reference: "1 Timothy 3:15",
          url: "https://bible.usccb.org/bible/1timothy/3",
          kind: "Scripture",
        },
      ],
    },
    {
      id: "real-presence-eucharist",
      order: 2,
      title: "The Real Presence in the Eucharist",
      subtitle: "More than a symbol, without crude literalism",
      summary:
        "Trace the Catholic doctrine from Christ’s words, Paul’s warnings, and the Church’s sacramental vocabulary, then answer common misunderstandings clearly.",
      durationMinutes: 14,
      difficulty: "Foundation",
      objectives: [
        "Explain real presence and transubstantiation without confusing substance with physical appearance.",
        "Connect John 6 with the Last Supper and 1 Corinthians 10–11.",
        "Answer the claim that the Eucharist is only a memorial symbol.",
      ],
      sections: [
        {
          heading: "Christ gives himself sacramentally",
          paragraphs: [
            "Catholics confess that Christ is truly present under the appearances of bread and wine. This is not the claim that the sacrament looks or tastes like ordinary flesh and blood.",
            "Transubstantiation names the change of what the bread and wine are at the deepest level while their sensible appearances remain. The term protects the mystery; it does not pretend to reduce it to a laboratory process.",
          ],
          keyPoint: "The Eucharist is a sacramental mode of Christ’s real presence, not a merely mental reminder and not a crude physical transformation.",
        },
        {
          heading: "Read the biblical witness together",
          paragraphs: [
            "John 6 presents Christ as the living bread and intensifies the language of eating his flesh and drinking his blood. The Last Supper gives the sacramental command: this is his body and blood, to be received in remembrance of him.",
            "Paul calls the cup and bread a participation in Christ and warns that an unworthy reception profanes the Lord’s body and blood. Those texts make strongest sense together rather than as isolated proof texts.",
          ],
        },
        {
          heading: "Memorial does not mean absent",
          paragraphs: [
            "In biblical worship, memorial makes God’s saving act liturgically present to the covenant community. The Mass does not repeat Calvary; it sacramentally makes present the one sacrifice of Christ.",
            "A charitable answer should affirm that the Eucharist is symbolic—the signs truly signify—while adding that Catholic sacramental signs also communicate the reality Christ promises.",
          ],
        },
      ],
      objection: {
        claim: "Jesus was speaking figuratively, so the Eucharist is only symbolic.",
        response:
          "Catholic theology does not deny symbolism. It denies the word ‘only.’ John 6, the institution narratives, Paul’s language of participation, and his warning about profaning Christ’s body and blood form a cumulative case for a sacramental reality greater than a mental reminder.",
      },
      sources: [
        {
          label: "Catechism of the Catholic Church",
          reference: "CCC 1356–1381",
          url: "https://www.vatican.va/content/catechism/en/part_two/section_two/chapter_one/article_3/v_the_sacramental_sacrifice_thanksgiving_memorial_presence.index.html",
          kind: "Catechism",
        },
        {
          label: "Gospel according to John",
          reference: "John 6:22–71",
          url: "https://bible.usccb.org/bible/john/6",
          kind: "Scripture",
        },
        {
          label: "First Corinthians",
          reference: "1 Corinthians 10:16–17; 11:23–29",
          url: "https://bible.usccb.org/bible/1corinthians/10",
          kind: "Scripture",
        },
      ],
    },
    {
      id: "peter-and-the-papacy",
      order: 3,
      title: "Peter and the Papacy",
      subtitle: "A visible ministry of unity in the apostolic Church",
      summary:
        "Build the case for Petrine primacy from the whole New Testament pattern while distinguishing primacy, impeccability, and infallibility.",
      durationMinutes: 15,
      difficulty: "Intermediate",
      objectives: [
        "Explain the keys and binding language of Matthew 16 in its biblical context.",
        "Recognize Peter’s pastoral commission across Luke 22 and John 21.",
        "Avoid exaggerated claims that make the doctrine easier to attack.",
      ],
      sections: [
        {
          heading: "The Petrine pattern",
          paragraphs: [
            "Matthew 16 gives Peter a new name, identifies him with the rock, and entrusts him with the keys and a binding-and-loosing authority. The image of keys recalls a royal steward who serves under the king.",
            "Luke 22 records Christ praying specifically for Peter so that, after turning back, he may strengthen his brothers. John 21 gives Peter a threefold pastoral commission to tend Christ’s flock.",
          ],
          keyPoint: "The Catholic case is cumulative: keys, strengthening, shepherding, and Peter’s leading role belong together.",
        },
        {
          heading: "Primacy is not personal perfection",
          paragraphs: [
            "Peter sins, misunderstands, and must be corrected. None of that disproves a pastoral office; it shows that Christ works through weak human ministers.",
            "Papal infallibility is not a claim that every papal opinion is correct or that a pope cannot sin. It concerns definitive teaching on faith or morals under specified conditions.",
          ],
        },
        {
          heading: "From Peter to succession",
          paragraphs: [
            "The apostolic mission was not designed to end with the apostles’ deaths. The New Testament already shows offices being filled and ministry handed on. Catholic teaching understands the bishops as successors of the apostles and the Bishop of Rome as successor to Peter’s ministry of unity.",
            "Historical evidence should support rather than replace the biblical case. Early testimony is most useful when it shows how Christians nearest the apostolic age understood Rome, succession, and communion.",
          ],
        },
      ],
      objection: {
        claim: "Peter made serious mistakes, so he could not have held a unique office.",
        response:
          "Office and impeccability are different claims. Scripture openly records Peter’s failures while also recording Christ’s unique promises and commissions to him. Catholic doctrine does not teach that popes are sinless or that every statement they make is protected from error.",
      },
      sources: [
        {
          label: "Catechism of the Catholic Church",
          reference: "CCC 880–882; 891",
          url: "https://www.vatican.va/content/catechism/en.html",
          kind: "Catechism",
        },
        {
          label: "Lumen Gentium",
          reference: "LG 18–25",
          url: "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html",
          kind: "Council",
        },
        {
          label: "Gospel according to Matthew",
          reference: "Matthew 16:13–20",
          url: "https://bible.usccb.org/bible/matthew/16",
          kind: "Scripture",
        },
        {
          label: "Gospel according to Luke",
          reference: "Luke 22:31–32",
          url: "https://bible.usccb.org/bible/luke/22",
          kind: "Scripture",
        },
        {
          label: "Gospel according to John",
          reference: "John 21:15–17",
          url: "https://bible.usccb.org/bible/john/21",
          kind: "Scripture",
        },
      ],
    },
    {
      id: "grace-faith-and-works",
      order: 4,
      title: "Grace, Faith, and Works",
      subtitle: "Salvation is God’s gift that creates a living response",
      summary:
        "Replace the false choice between grace and obedience with the Catholic account of justification, living faith, charity, and Spirit-enabled cooperation.",
      durationMinutes: 14,
      difficulty: "Intermediate",
      objectives: [
        "State clearly that initial justification is an unearned gift of grace.",
        "Explain cooperation without implying that human effort saves apart from Christ.",
        "Read Paul and James as addressing different errors rather than contradicting each other.",
      ],
      sections: [
        {
          heading: "Grace comes first",
          paragraphs: [
            "Catholic teaching begins with God’s initiative. Christ merits salvation; the Holy Spirit moves the sinner to conversion; and no natural work can earn the initial grace of forgiveness and justification.",
            "Justification is more than an external acquittal. By grace, God forgives and renews the person, pouring faith, hope, and charity into the heart.",
          ],
          keyPoint: "Good works are not an alternative source of salvation; they are the fruit of grace working through a free human response.",
        },
        {
          heading: "Cooperation is still grace",
          paragraphs: [
            "Grace does not treat the human person as an inert object. God heals and elevates freedom so that the believer can genuinely respond, love, obey, and persevere.",
            "Even Christian merit is rooted in grace. The initiative and power remain God’s, while the believer’s Spirit-enabled acts are truly personal and significant.",
          ],
        },
        {
          heading: "Paul and James",
          paragraphs: [
            "Paul rejects boasting and works performed as though they placed God in our debt. James rejects a dead claim to faith that produces no obedience or mercy.",
            "The Catholic synthesis is faith working through love: salvation is received as gift, and the faith that receives Christ is meant to become living, obedient, and fruitful.",
          ],
        },
      ],
      objection: {
        claim: "Catholics believe they earn salvation by good works.",
        response:
          "Catholic teaching explicitly denies that anyone can earn initial justification. Salvation begins, continues, and reaches completion by grace. The real disagreement concerns whether justifying grace merely declares a person righteous or also renews the person so that Spirit-enabled faith becomes active in love.",
      },
      sources: [
        {
          label: "Catechism of the Catholic Church",
          reference: "CCC 1987–2029",
          url: "https://www.vatican.va/content/catechism/en/part_three/section_one/chapter_three/article_2/grace_and_justification.html",
          kind: "Catechism",
        },
        {
          label: "Catechism: Merit",
          reference: "CCC 2006–2011",
          url: "https://www.vatican.va/content/catechism/en/part_three/section_one/chapter_three/article_2/iii_merit.html",
          kind: "Catechism",
        },
        {
          label: "Letter to the Galatians",
          reference: "Galatians 5:6",
          url: "https://bible.usccb.org/bible/galatians/5",
          kind: "Scripture",
        },
        {
          label: "Letter of James",
          reference: "James 2:14–26",
          url: "https://bible.usccb.org/bible/james/2",
          kind: "Scripture",
        },
      ],
    },
  ] satisfies LearningLesson[],
};

export const practiceQuestions: PracticeQuestion[] = [
  {
    id: "foundation-01",
    lessonId: "scripture-tradition-magisterium",
    prompt: "Which description best matches the Catholic understanding of the Magisterium?",
    choices: [
      { id: "a", label: "A source of new revelation above Scripture" },
      { id: "b", label: "A teaching office that serves and interprets the apostolic deposit" },
      { id: "c", label: "A collection of every custom Catholics have practiced" },
      { id: "d", label: "The private opinions of individual bishops" },
    ],
    correctId: "b",
    explanation:
      "The Magisterium is the living teaching office of the Pope and bishops in communion with him. It serves the word of God by guarding and authentically interpreting what was handed on.",
    references: ["CCC 85–87, 100", "Dei Verbum 10"],
  },
  {
    id: "foundation-02",
    lessonId: "scripture-tradition-magisterium",
    prompt: "Which passage directly tells Christians to hold to traditions taught both orally and by letter?",
    choices: [
      { id: "a", label: "2 Thessalonians 2:15" },
      { id: "b", label: "Genesis 1:1" },
      { id: "c", label: "Psalm 23:1" },
      { id: "d", label: "Revelation 22:21" },
    ],
    correctId: "a",
    explanation:
      "Paul commands the Thessalonians to stand firm in the apostolic traditions they received by spoken word and by letter.",
    references: ["2 Thessalonians 2:15", "CCC 80–83"],
  },
  {
    id: "foundation-03",
    lessonId: "real-presence-eucharist",
    prompt: "What does transubstantiation affirm?",
    choices: [
      { id: "a", label: "The Eucharist becomes ordinary human tissue" },
      { id: "b", label: "Only the congregation’s attitude changes" },
      { id: "c", label: "The substance becomes Christ’s Body and Blood while sensible appearances remain" },
      { id: "d", label: "Christ is present only in the priest’s imagination" },
    ],
    correctId: "c",
    explanation:
      "The Church uses transubstantiation to name the conversion of the bread and wine into Christ’s Body and Blood while their appearances remain.",
    references: ["CCC 1374–1377", "Council of Trent, Session XIII"],
  },
  {
    id: "foundation-04",
    lessonId: "real-presence-eucharist",
    prompt: "Why is 1 Corinthians 11 important to the Catholic Eucharistic case?",
    choices: [
      { id: "a", label: "Paul forbids all liturgical worship" },
      { id: "b", label: "Paul warns that unworthy reception profanes the Lord’s Body and Blood" },
      { id: "c", label: "Paul says the bread has no connection to Christ" },
      { id: "d", label: "Paul replaces the Last Supper with a private devotion" },
    ],
    correctId: "b",
    explanation:
      "Paul’s warning treats reception as an objective encounter with the Lord’s Body and Blood, not merely a person’s private mental recollection.",
    references: ["1 Corinthians 11:23–29", "CCC 1385"],
  },
  {
    id: "foundation-05",
    lessonId: "peter-and-the-papacy",
    prompt: "Which combination best summarizes the New Testament’s Petrine pattern?",
    choices: [
      { id: "a", label: "Keys, strengthening the brethren, and shepherding Christ’s flock" },
      { id: "b", label: "Military power, wealth, and political office" },
      { id: "c", label: "Sinlessness, omniscience, and private revelation" },
      { id: "d", label: "Anonymous leadership with no pastoral commission" },
    ],
    correctId: "a",
    explanation:
      "Matthew 16, Luke 22, and John 21 together present the keys, a commission to strengthen, and a commission to shepherd.",
    references: ["Matthew 16:18–19", "Luke 22:31–32", "John 21:15–17", "CCC 881"],
  },
  {
    id: "foundation-06",
    lessonId: "peter-and-the-papacy",
    prompt: "What does papal infallibility not mean?",
    choices: [
      { id: "a", label: "The Church can teach definitively on faith and morals" },
      { id: "b", label: "Every papal opinion and decision is free from error" },
      { id: "c", label: "The Bishop of Rome serves the Church’s unity" },
      { id: "d", label: "The Petrine ministry belongs to the Church’s pastoral structure" },
    ],
    correctId: "b",
    explanation:
      "Infallibility has defined conditions and scope. It does not make a pope sinless, inspired, or correct in every personal judgment.",
    references: ["CCC 891", "Lumen Gentium 25"],
  },
  {
    id: "foundation-07",
    lessonId: "grace-faith-and-works",
    prompt: "Can a person earn the initial grace of justification by natural good works?",
    choices: [
      { id: "a", label: "Yes, if the works are difficult enough" },
      { id: "b", label: "Yes, if other people approve" },
      { id: "c", label: "No; the initiative and gift belong to God’s grace" },
      { id: "d", label: "Only after reaching a certain age" },
    ],
    correctId: "c",
    explanation:
      "Catholic teaching explicitly says no one can merit the initial grace of forgiveness and justification. Christian cooperation is itself enabled by prior grace.",
    references: ["CCC 1996–2001, 2010", "Ephesians 2:8–10"],
  },
  {
    id: "foundation-08",
    lessonId: "grace-faith-and-works",
    prompt: "Which phrase best expresses the Catholic synthesis of faith and works?",
    choices: [
      { id: "a", label: "Human effort replaces grace" },
      { id: "b", label: "Faith working through love" },
      { id: "c", label: "Works without faith" },
      { id: "d", label: "A verbal claim to faith with no fruit" },
    ],
    correctId: "b",
    explanation:
      "Grace creates a living response. Paul’s phrase ‘faith working through love’ helps show why gift, faith, obedience, and charity are not rival causes.",
    references: ["Galatians 5:6", "James 2:14–26", "CCC 1993"],
  },
];

export function getLessonById(id: string): LearningLesson | undefined {
  return learningPath.lessons.find((lesson) => lesson.id === id);
}

export function getNextLesson(id: string): LearningLesson | undefined {
  const currentIndex = learningPath.lessons.findIndex((lesson) => lesson.id === id);
  return currentIndex >= 0 ? learningPath.lessons[currentIndex + 1] : undefined;
}
