export const PHASE4_DATE = "2026-07-19";

const official = (stableId, sourceType, title, corporateAuthor, url, quotationPolicy) => ({
  stableId,
  sourceType,
  title,
  corporateAuthor,
  url,
  accessDate: PHASE4_DATE,
  verificationStatus: "official_url_verified",
  verificationMethod: "Resolved against the official publisher on 2026-07-19; locators are checked during lesson validation.",
  quotationPolicy,
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

export const sources = [
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
