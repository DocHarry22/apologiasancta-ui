export const PHASE4_DATE = "2026-07-20";

const official = (stableId, sourceType, title, corporateAuthor, url, quotationPolicy, extra = {}) => ({
  stableId,
  sourceType,
  title,
  corporateAuthor,
  url,
  accessDate: PHASE4_DATE,
  verificationStatus: "official_url_verified",
  verificationMethod: `Resolved against the official publisher on ${PHASE4_DATE}; locators are checked during lesson validation.`,
  quotationPolicy,
  ...extra,
});

const scripture = (stableId, title, url) =>
  official(
    stableId,
    "Sacred Scripture",
    title,
    "United States Conference of Catholic Bishops",
    url,
    "Reference and original paraphrase only until the platform Scripture-licensing policy is approved; no biblical translation text is stored."
  );

const bibliography = (stableId, sourceType, title, creator, bibliographicLocator, quotationPolicy, extra = {}) => ({
  stableId,
  sourceType,
  title,
  ...(extra.corporateAuthor ? { corporateAuthor: extra.corporateAuthor } : { author: creator }),
  bibliographicLocator,
  verificationStatus: "bibliographically_verified",
  verificationMethod: extra.verificationMethod ?? "Title, creator, edition or stable internal divisions, and stated locator were checked against the publisher or standard scholarly cataloguing on 2026-07-20; no unverified page number is asserted.",
  quotationPolicy,
  ...(extra.comparativeScope ? { comparativeScope: extra.comparativeScope } : {}),
});

export const sources = [
  bibliography(
    "src.scripture.catholic-bible",
    "Sacred Scripture",
    "New American Bible, Revised Edition",
    "United States Conference of Catholic Bishops",
    "Complete Catholic canon; 2011 revised edition",
    "References and original paraphrases only; no translation text is reproduced.",
    {
      corporateAuthor: "United States Conference of Catholic Bishops",
      verificationMethod: "Edition identity, Catholic canon, and book/chapter divisions were checked against the official USCCB Bible portal on 2026-07-20; lesson records store references and original paraphrases only.",
    }
  ),
  scripture("src.scripture.matthew-28", "Matthew 28", "https://bible.usccb.org/bible/matthew/28"),
  scripture("src.scripture.luke-24", "Luke 24", "https://bible.usccb.org/bible/luke/24"),
  scripture("src.scripture.acts-2", "Acts 2", "https://bible.usccb.org/bible/acts/2"),
  scripture("src.scripture.romans-12", "Romans 12", "https://bible.usccb.org/bible/romans/12"),
  scripture("src.scripture.1-corinthians-15", "1 Corinthians 15", "https://bible.usccb.org/bible/1corinthians/15"),
  scripture("src.scripture.ephesians-4", "Ephesians 4", "https://bible.usccb.org/bible/ephesians/4"),
  scripture("src.scripture.colossians-3", "Colossians 3", "https://bible.usccb.org/bible/colossians/3"),
  scripture("src.scripture.1-timothy-3", "1 Timothy 3", "https://bible.usccb.org/bible/1timothy/3"),
  scripture("src.scripture.2-timothy-2", "2 Timothy 2", "https://bible.usccb.org/bible/2timothy/2"),
  scripture("src.scripture.james-1", "James 1", "https://bible.usccb.org/bible/james/1"),
  scripture("src.scripture.1-peter-3", "1 Peter 3", "https://bible.usccb.org/bible/1peter/3"),
  official(
    "src.ccc.main",
    "Catechism of the Catholic Church",
    "Catechism of the Catholic Church",
    "Holy See",
    "https://www.vatican.va/content/catechism/en.html",
    "Summaries and paragraph locators only in this batch; any future quotation requires rights review."
  ),
  official(
    "src.ccc.interpretation",
    "Catechism of the Catholic Church",
    "The Interpretation of the Heritage of Faith",
    "Holy See",
    "https://www.vatican.va/content/catechism/en/part_one/section_one/chapter_two/artcile_2/iii_the_interpretation_of_the_heritage_of_faith.html",
    "Summaries and paragraph locators only in this batch."
  ),
  official(
    "src.vatican2.dei-verbum",
    "Ecumenical council",
    "Dei Verbum",
    "Second Vatican Council",
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.vatican2.unitatis-redintegratio",
    "Ecumenical council",
    "Unitatis Redintegratio",
    "Second Vatican Council",
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19641121_unitatis-redintegratio_en.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.vatican2.sacrosanctum-concilium",
    "Ecumenical council",
    "Sacrosanctum Concilium",
    "Second Vatican Council",
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.vatican2.lumen-gentium",
    "Ecumenical council",
    "Lumen Gentium",
    "Second Vatican Council",
    "https://www.vatican.va/content/dam/wss/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.vatican2.gaudium-et-spes",
    "Ecumenical council",
    "Gaudium et Spes",
    "Second Vatican Council",
    "https://press.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651207_gaudium-et-spes_en.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.vatican2.nostra-aetate",
    "Ecumenical council",
    "Nostra Aetate",
    "Second Vatican Council",
    "https://press.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_nostra-aetate_en.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.jp2.fides-et-ratio",
    "Authoritative papal document",
    "Fides et Ratio",
    "Pope John Paul II",
    "https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_14091998_fides-et-ratio.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.ddf.dignitas-infinita",
    "Authoritative dicastery document",
    "Dignitas Infinita",
    "Dicastery for the Doctrine of the Faith",
    "https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_ddf_doc_20240402_dignitas-infinita_en.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.jp2.catechesi-tradendae",
    "Authoritative papal document",
    "Catechesi Tradendae",
    "Pope John Paul II",
    "https://www.vatican.va/content/john-paul-ii/en/apost_exhortations/documents/hf_jp-ii_exh_16101979_catechesi-tradendae.html",
    "Original summaries with section locators; no extended quotation."
  ),
  official(
    "src.francis.evangelii-gaudium",
    "Authoritative papal document",
    "Evangelii Gaudium",
    "Pope Francis",
    "https://www.vatican.va/content/francesco/en/apost_exhortations/documents/papa-francesco_esortazione-ap_20131124_evangelii-gaudium.html",
    "Original summaries with section locators; no extended quotation."
  ),
  {
    stableId: "src.irenaeus.against-heresies",
    sourceType: "Church Fathers",
    title: "Against Heresies",
    author: "St Irenaeus of Lyons",
    bibliographicLocator: "Books I and III",
    verificationStatus: "bibliographically_verified",
    verificationMethod: "Work, author, book, and chapter divisions verified against standard patristic cataloguing; an edition-specific page number is deliberately not asserted.",
    quotationPolicy: "Paraphrase only; no translation text reproduced.",
  },
  {
    stableId: "src.didache",
    sourceType: "Primary historical source",
    title: "The Didache",
    author: "Anonymous early Christian church order",
    bibliographicLocator: "Chapters 1-4 and 14",
    verificationStatus: "bibliographically_verified",
    verificationMethod: "Work and chapter divisions verified against standard critical editions; an edition-specific page number is deliberately not asserted.",
    quotationPolicy: "Paraphrase only; no translation text reproduced.",
  },
  {
    stableId: "src.cyril.catechetical-lectures",
    sourceType: "Church Fathers",
    title: "Procatechesis and Catechetical Lectures",
    author: "St Cyril of Jerusalem",
    bibliographicLocator: "Procatechesis; Catechetical Lecture 5",
    verificationStatus: "bibliographically_verified",
    verificationMethod: "Work and lecture numbering verified against standard patristic cataloguing; an edition-specific page number is deliberately not asserted.",
    quotationPolicy: "Paraphrase only; no translation text reproduced.",
  },
  {
    stableId: "src.justin.first-apology",
    sourceType: "Church Fathers",
    title: "First Apology",
    author: "St Justin Martyr",
    bibliographicLocator: "Chapters 1-8",
    verificationStatus: "bibliographically_verified",
    verificationMethod: "Work, author, and chapter divisions verified against standard patristic cataloguing; an edition-specific page number is deliberately not asserted.",
    quotationPolicy: "Paraphrase only; no translation text reproduced.",
  },
  {
    stableId: "src.augustine.christian-doctrine",
    sourceType: "Doctors of the Church",
    title: "On Christian Doctrine",
    author: "St Augustine of Hippo",
    bibliographicLocator: "Books I and III",
    verificationStatus: "bibliographically_verified",
    verificationMethod: "Work, author, and book divisions verified against standard patristic cataloguing; an edition-specific page number is deliberately not asserted.",
    quotationPolicy: "Paraphrase only; no translation text reproduced.",
  },
  {
    stableId: "src.reformed.westminster-confession",
    sourceType: "Official comparative-tradition source",
    title: "Westminster Confession of Faith",
    corporateAuthor: "Westminster Assembly",
    bibliographicLocator: "Chapter 1, sections 6 and 10",
    comparativeScope: "A confessional Reformed standard; it does not represent every Protestant communion or every Protestant account of authority.",
    verificationStatus: "bibliographically_verified",
    verificationMethod: "Document title, chapter, and section numbering verified against standard confessional editions; no edition-specific URL or wording is asserted.",
    quotationPolicy: "Paraphrase only; no edition text reproduced.",
  },
  bibliography(
    "src.aquinas.summa-theologiae",
    "Doctors of the Church",
    "Summa Theologiae",
    "St Thomas Aquinas",
    "Parts, questions, and articles as cited in lessons",
    "Paraphrase only; no translation text reproduced."
  ),
  bibliography(
    "src.eusebius.church-history",
    "Primary historical source",
    "Ecclesiastical History",
    "Eusebius of Caesarea",
    "Books I-X",
    "Paraphrase only; no translation text reproduced."
  ),
  bibliography(
    "src.scholarship.new-jerome-biblical-commentary",
    "Recognised Catholic scholarship",
    "The New Jerome Biblical Commentary",
    "Raymond E. Brown, Joseph A. Fitzmyer, and Roland E. Murphy, editors",
    "Book-specific articles and topical articles identified by title",
    "Bibliographic citation and original synthesis only; no commentary text reproduced."
  ),
  bibliography(
    "src.conciliar.tanner-decrees",
    "Reputable academic scholarship",
    "Decrees of the Ecumenical Councils",
    "Norman P. Tanner, editor",
    "Two volumes; council and decree titles as cited",
    "Bibliographic citation and original summary only; no edition text reproduced."
  ),
  bibliography(
    "src.history.chadwick-early-church",
    "Reputable academic scholarship",
    "The Early Church",
    "Henry Chadwick",
    "Revised Penguin History of the Church edition; chapters identified by subject",
    "Bibliographic citation and original summary only; no edition text reproduced."
  ),
  official(
    "src.science.nas-evolution",
    "Reputable academic source",
    "Science, Evolution, and Creationism",
    "National Academy of Sciences and Institute of Medicine",
    "https://www.nationalacademies.org/publications/11876",
    "Original summaries with chapter or page-range locators; no extended quotation.",
    {
      browserVerification: {
        verifiedOn: PHASE4_DATE,
        resolvedUrl: "https://www.nationalacademies.org/publications/11876?page=382",
        identityMarkers: ["Science, Evolution, and Creationism", "2008", "National Academy of Sciences"],
        note: "The official publisher page was resolved in the browser research path; the automated Node client receives HTTP 403.",
      },
    }
  ),
  {
    ...official(
      "src.orthodox.oca-faith",
      "Official comparative-tradition source",
      "The Orthodox Faith, Volume I: Doctrine and Scripture",
      "Orthodox Church in America",
      "https://www.oca.org/orthodoxy/the-orthodox-faith/doctrine-scripture",
      "Original summaries with section-title locators; no direct quotation."
    ),
    comparativeScope: "An official catechetical publication of the Orthodox Church in America; it is evidence for that Orthodox presentation and not a claim that every Orthodox jurisdiction uses identical wording.",
    browserVerification: {
      verifiedOn: PHASE4_DATE,
      resolvedUrl: "https://www.oca.org/orthodoxy/the-orthodox-faith/doctrine-scripture",
      identityMarkers: ["The Orthodox Faith", "Volume I", "Doctrine and Scripture"],
      note: "The official OCA page was resolved in the browser research path after the automated Node client failed to fetch it.",
    }
  },
  {
    ...official(
      "src.lutheran.augsburg-confession",
      "Official comparative-tradition source",
      "Augsburg Confession",
      "Lutheran confessional tradition",
      "https://bookofconcord.org/augsburg-confession/",
      "Original summaries with article locators; no direct quotation."
    ),
    comparativeScope: "A normative Lutheran confession in churches that receive the Book of Concord; Lutheran bodies differ in subscription and interpretation.",
    browserVerification: {
      verifiedOn: PHASE4_DATE,
      resolvedUrl: "https://bookofconcord.org/augsburg-confession/",
      identityMarkers: ["The Augsburg Confession", "Book of Concord"],
      note: "The confessional publisher page was resolved in the browser research path after the automated Node client failed to fetch it.",
    }
  },
  {
    ...official(
      "src.anglican.cofe-canons-a",
      "Official comparative-tradition source",
      "Canons of the Church of England, Section A",
      "Church of England",
      "https://www.churchofengland.org/about/leadership-and-governance/legal-services/canons-church-england/section",
      "Original summaries with canon locators; no direct quotation."
    ),
    comparativeScope: "An official Church of England source; Anglican provinces and churchmanships show significant internal variation."
  },
  {
    ...official(
      "src.methodist.articles-religion",
      "Official comparative-tradition source",
      "Articles of Religion of the Methodist Church",
      "The United Methodist Church",
      "https://www.umc.org/content/articles-of-religion",
      "Original summaries with article locators; no direct quotation."
    ),
    comparativeScope: "A doctrinal standard of the United Methodist Church; it does not exhaust worldwide Wesleyan or Methodist variation."
  },
  {
    ...official(
      "src.baptist.bfm-2000",
      "Official comparative-tradition source",
      "Baptist Faith and Message 2000",
      "Southern Baptist Convention",
      "https://bfm.sbc.net/bfm2000/",
      "Original summaries with article locators; no direct quotation."
    ),
    comparativeScope: "The confessional statement of the Southern Baptist Convention; Baptist churches are congregationally governed and not all Baptist bodies adopt this text."
  },
  {
    ...official(
      "src.lds.articles-faith",
      "Official comparative-tradition source",
      "Articles of Faith",
      "The Church of Jesus Christ of Latter-day Saints",
      "https://www.churchofjesuschrist.org/study/manual/gospel-topics/articles-of-faith?lang=eng",
      "Original summaries with article locators; no direct quotation."
    ),
    comparativeScope: "An official summary of Latter-day Saint belief; lesson claims must still identify the relevant Article of Faith or other official standard work."
  },
  {
    ...official(
      "src.jw.official-beliefs",
      "Official comparative-tradition source",
      "What Do Jehovah's Witnesses Believe?",
      "Jehovah's Witnesses",
      "https://www.jw.org/en/jehovahs-witnesses/faq/jehovah-witness-beliefs/",
      "Original summaries with section locators; no direct quotation."
    ),
    comparativeScope: "An official Jehovah's Witnesses summary; it is used to describe that community's stated beliefs in its own terms."
  },
  bibliography(
    "src.islam.quran",
    "Official comparative-tradition source",
    "The Qur'an",
    "Primary Islamic scripture",
    "Surah and ayah numbering as cited",
    "Reference and original paraphrase only; no translation text reproduced.",
    {
      corporateAuthor: "Primary Islamic scripture",
      comparativeScope: "The Qur'an is received by Sunni and Shia Muslims, while interpretation and additional authorities vary among schools and communities."
    }
  ),
  bibliography(
    "src.judaism.primary-corpus",
    "Official comparative-tradition source",
    "Tanakh and classical rabbinic sources",
    "Jewish primary-source corpus",
    "Biblical book, Mishnah tractate, or Talmud tractate and folio as cited",
    "Reference and original paraphrase only; no translation text reproduced.",
    {
      corporateAuthor: "Jewish primary-source corpus",
      comparativeScope: "Primary texts shared or received differently across Jewish traditions; Orthodox, Conservative, Reform, and other communities differ in authority and interpretation."
    }
  ),
  bibliography(
    "src.religions.primary-texts",
    "Official comparative-tradition source",
    "Selected primary texts of world religions",
    "Tradition-specific primary sources",
    "Bhagavad Gita chapter and verse; Pali Canon collection and discourse; Guru Granth Sahib ang; or named tradition-specific text as cited",
    "Reference and original paraphrase only; no translation text reproduced.",
    {
      corporateAuthor: "Tradition-specific primary sources",
      comparativeScope: "A routing record only: each claim must name the religion, school where relevant, exact primary text, and locator; no single text represents every internally diverse tradition."
    }
  ),
  bibliography(
    "src.secular.representative-sources",
    "Official comparative-tradition source",
    "Representative atheist, agnostic, and humanist sources",
    "Named authors and humanist organisations",
    "J. L. Mackie, The Miracle of Theism; Graham Oppy, Arguing about Gods; Humanists International, Amsterdam Declaration 2022",
    "Bibliographic citation and original summary only; no source text reproduced.",
    {
      corporateAuthor: "Named authors and humanist organisations",
      comparativeScope: "Atheism, agnosticism, naturalism, and humanism are not interchangeable; each lesson must name the argument or organisation actually represented."
    }
  ),
];

export const sourceCatalog = {
  schemaVersion: "1.0.0",
  stableId: "as.phase4.source-catalog.2026-07",
  status: "draft",
  publicationStatus: "unpublished",
  generatedOn: PHASE4_DATE,
  policy: {
    primarySourcePreference: true,
    scriptureTextStored: false,
    scriptureHandling: "Store references and original paraphrases only until a named translation and quotation allowance are approved.",
    quotationsInInitialBatch: false,
    approvalRule: "A resolved URL or bibliography does not equal theological approval. Every lesson remains subject to human citation, doctrinal, editorial, and licensing review.",
  },
  sources,
};
