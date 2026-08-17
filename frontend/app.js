/* =========================================================
   PIB UPSC — APP.JS
   ========================================================= */

const SUPABASE_URL =
    "https://gmytscoqupsozionnryy.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_dpY7xVY8df2CqDfoT9rTFg_PGpgpWNF";

const { createClient } = supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================================
   STATE
   ========================================================= */

let articles = [];

let flashcards = [];

let currentFlashcard = 0;

let lastFetchTime = null;

let isLoading = false;

let selectedMonth = "ALL";

let currentDisplayedArticles = [];


/* =========================================================
   UTILITIES
   ========================================================= */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


/* =========================================================
   RELEVANCE
   ========================================================= */

function isRelevantArticle(article) {

    if (!article) {
        return false;
    }

    return (
        article.relevant === true ||
        article.relevant === "true" ||
        article.relevant === 1 ||
        article.relevant === "1"
    );
}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function getArticleDate(article) {

    if (!article) {
        return null;
    }

    const candidates = [
        article.published_at,
        article.fetched_at,
        article.created_at,
        article.inserted_at,
        article.updated_at
    ];

    for (const value of candidates) {

        if (!value) {
            continue;
        }

        const date =
            new Date(value);

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {
            return date;
        }
    }

    return null;
}


function getDisplayDate(article) {

    const date =
        getArticleDate(article);

    if (date) {
        return date;
    }

    if (lastFetchTime) {
        return new Date(lastFetchTime);
    }

    return null;
}


function formatDate(value) {

    if (!value) {
        return "";
    }

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function articleTimestamp(article) {

    const date =
        getArticleDate(article);

    return date
        ? date.getTime()
        : 0;
}


function sortNewestFirst(list) {

    return [...list].sort(
        (a, b) =>
            articleTimestamp(b) -
            articleTimestamp(a)
    );
}


/* =========================================================
   ARRAY / JSON HELPERS
   ========================================================= */

function toArray(value) {

    if (Array.isArray(value)) {
        return value;
    }

    if (
        typeof value === "string" &&
        value.trim()
    ) {

        try {

            const parsed =
                JSON.parse(value);

            if (
                Array.isArray(parsed)
            ) {
                return parsed;
            }

        } catch (error) {
            /* continue */
        }

        return value
            .split(/[,|;]+/)
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean);
    }

    return [];
}


function getGsPapers(article) {

    if (!article) {
        return [];
    }

    return toArray(
        article.gs_papers
    )
        .map(
            item =>
                String(item).trim()
        )
        .filter(Boolean);
}


function getArticleFlashcards(article) {

    if (!article) {
        return [];
    }

    return toArray(
        article.flashcards
    );
}


/* =========================================================
   MONTH
   ========================================================= */

function getMonthKey(article) {

    const date =
        getDisplayDate(article);

    if (!date) {
        return "UNKNOWN";
    }

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0")
    );
}


function getMonthLabelFromKey(key) {

    if (
        !key ||
        key === "UNKNOWN"
    ) {
        return "RECENT ARTICLES";
    }

    const parts =
        key.split("-");

    const date =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            1
        );

    return date
        .toLocaleDateString(
            "en-IN",
            {
                month: "long",
                year: "numeric"
            }
        )
        .toUpperCase();
}


function buildMonthSlicer() {

    const select =
        document.getElementById(
            "month-filter"
        );

    if (!select) {
        return;
    }

    const monthMap =
        new Map();

    articles.forEach(
        article => {

            const key =
                getMonthKey(article);

            if (
                key === "UNKNOWN"
            ) {
                return;
            }

            monthMap.set(
                key,
                getMonthLabelFromKey(
                    key
                )
            );
        }
    );


    const months =
        [...monthMap.entries()]
            .sort(
                (a, b) =>
                    b[0].localeCompare(
                        a[0]
                    )
            );


    select.innerHTML = `
        <option value="ALL">
            All Months
        </option>

        ${months
            .map(
                ([key, label]) => `
                    <option value="${escapeHtml(key)}">
                        ${escapeHtml(label)}
                    </option>
                `
            )
            .join("")}
    `;


    if (
        selectedMonth !== "ALL" &&
        months.some(
            ([key]) =>
                key === selectedMonth
        )
    ) {

        select.value =
            selectedMonth;

    } else {

        selectedMonth =
            "ALL";

        select.value =
            "ALL";
    }
}


/* =========================================================
   LOADING
   ========================================================= */

function setLoading(loading) {

    isLoading = loading;

    const button =
        document.getElementById(
            "refresh-btn"
        );

    if (!button) {
        return;
    }

    button.disabled =
        loading;

    button.style.opacity =
        loading
            ? "0.55"
            : "";

    button.style.cursor =
        loading
            ? "wait"
            : "";
}


function updateLastUpdated() {

    const element =
        document.getElementById(
            "last-updated"
        );

    if (!element) {
        return;
    }

    if (!lastFetchTime) {

        element.textContent =
            "Not updated yet";

        return;
    }

    element.textContent =
        `Updated ${new Date(
            lastFetchTime
        ).toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )}`;
}


/* =========================================================
   LOAD ARTICLES
   ========================================================= */

async function loadArticles() {

    if (isLoading) {
        return;
    }

    setLoading(true);

    try {

        const {
            data,
            error
        } = await db
            .from("articles")
            .select("*")
            .eq("relevant", true)
            .order(
                "published_at",
                {
                    ascending: false,
                    nullsFirst: false
                }
            );


        if (error) {

            console.error(
                "Supabase error:",
                error
            );

            showLoadError(
                "Unable to load current affairs."
            );

            return;
        }


        articles =
            Array.isArray(data)
                ? data.filter(
                    isRelevantArticle
                )
                : [];


        articles =
            sortNewestFirst(
                articles
            );


        lastFetchTime =
            new Date();


        buildMonthSlicer();

        buildFlashcards();

        renderDashboard();

        applyAllFilters();

        renderRevision();

        updateLastUpdated();

    } catch (error) {

        console.error(
            error
        );

        showLoadError(
            "Something went wrong while loading articles."
        );

    } finally {

        setLoading(false);
    }
}


/* =========================================================
   FILTERS
   ========================================================= */

function getArticlesMatchingFilters() {

    let filtered =
        [...articles];


    /* MONTH */

    if (
        selectedMonth !== "ALL"
    ) {

        filtered =
            filtered.filter(
                article =>
                    getMonthKey(
                        article
                    ) ===
                    selectedMonth
            );
    }


    /* IMPORTANCE */

    const importanceElement =
        document.getElementById(
            "importance-filter"
        );

    const importance =
        importanceElement
            ? importanceElement.value
            : "";


    if (importance) {

        const min =
            Number(importance);

        let max =
            3;

        if (min === 9) {
            max = 10;
        }

        if (min === 7) {
            max = 8;
        }

        if (min === 4) {
            max = 6;
        }


        filtered =
            filtered.filter(
                article => {

                    const value =
                        Number(
                            article.importance || 0
                        );

                    return (
                        value >= min &&
                        value <= max
                    );
                }
            );
    }


    /* GS */

    const gsElement =
        document.getElementById(
            "gs-filter"
        );

    const gs =
        gsElement
            ? gsElement.value
            : "";


    if (gs) {

        filtered =
            filtered.filter(
                article =>
                    getGsPapers(
                        article
                    ).includes(gs)
            );
    }


    return filtered;
}


function applyAllFilters() {

    const filtered =
        getArticlesMatchingFilters();

    currentDisplayedArticles =
        [...filtered];

    renderArticles(
        filtered
    );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

    const total =
        articles.length;


    const processed =
        articles.filter(
            article =>
                article.processed === true ||
                article.processed === "true" ||
                article.processed === 1 ||
                article.processed === "1"
        ).length;


    const highPriority =
        articles.filter(
            article =>
                Number(
                    article.importance || 0
                ) >= 7
        ).length;


    setText(
        "hero-count",
        total
    );

    setText(
        "total-count",
        total
    );

    setText(
        "processed-count",
        processed
    );

    setText(
        "relevant-count",
        total
    );

    setText(
        "important-count",
        highPriority
    );


    const recent =
        articles.slice(0, 6);


    const container =
        document.getElementById(
            "recent-articles"
        );


    if (container) {

        container.innerHTML =
            recent
                .map(
                    articleCard
                )
                .join("");
    }
}


/* =========================================================
   ARTICLE CARD
   ========================================================= */

function articleCard(article) {

    const importance =
        Number(
            article.importance || 0
        );


    const priority =
        importance >= 9
            ? "high"
            : importance >= 7
                ? "medium"
                : "low";


    const date =
        getDisplayDate(article);


    const gs =
        getGsPapers(article)
            .slice(0, 2);


    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    const summary =
        article.english_summary ||
        article.summary ||
        (
            toArray(
                article.topics
            ).slice(
                0,
                2
            ).join(" · ")
        );


    return `

        <article class="article-card">

            ${
                date
                    ? `
                        <div class="article-date">
                            ${formatDate(date)}
                        </div>
                    `
                    : ""
            }


            <div class="article-meta">

                <span
                    class="badge ${priority}"
                >
                    ${importance}/10
                </span>


                ${gs
                    .map(
                        item => `
                            <span class="badge">
                                ${escapeHtml(item)}
                            </span>
                        `
                    )
                    .join("")
                }

            </div>


            <h4>
                ${escapeHtml(title)}
            </h4>


            <p>
                ${escapeHtml(summary)}
            </p>


            <button
                type="button"
                onclick="openArticle(${JSON.stringify(article.id)})"
            >
                Read analysis →
            </button>

        </article>

    `;
}


/* =========================================================
   ARTICLE HEADING
   ========================================================= */

function updateArticlesHeading() {

    const heading =
        document.getElementById(
            "articles-heading"
        );

    if (!heading) {
        return;
    }


    heading.textContent =
        selectedMonth === "ALL"
            ? "ALL CURRENT AFFAIRS"
            : getMonthLabelFromKey(
                selectedMonth
            );
}


/* =========================================================
   ARTICLES LIST
   ========================================================= */

function renderArticles(filtered) {

    updateArticlesHeading();


    const container =
        document.getElementById(
            "articles-list"
        );


    if (!container) {
        return;
    }


    if (
        !filtered ||
        filtered.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                No articles found for
                the selected filters.
            </div>
        `;

        return;
    }


    const sorted =
        sortNewestFirst(
            filtered
        );


    const groups =
        new Map();


    sorted.forEach(
        article => {

            const key =
                getMonthKey(article);

            if (
                !groups.has(key)
            ) {

                groups.set(
                    key,
                    []
                );
            }

            groups
                .get(key)
                .push(article);
        }
    );


    const sortedGroups =
        [...groups.entries()]
            .sort(
                (a, b) =>
                    b[0].localeCompare(
                        a[0]
                    )
            );


    container.innerHTML =
        sortedGroups
            .map(
                ([key, items]) => `

                    <section class="month-section">

                        ${
                            selectedMonth === "ALL"
                                ? `
                                    <div class="month-heading">
                                        ${escapeHtml(
                                            getMonthLabelFromKey(
                                                key
                                            )
                                        )}
                                    </div>
                                `
                                : ""
                        }


                        <div class="article-list">

                            ${items
                                .map(
                                    articleListItem
                                )
                                .join("")
                            }

                        </div>

                    </section>

                `
            )
            .join("");
}


/* =========================================================
   ARTICLE LIST ITEM
   ========================================================= */

function articleListItem(article) {

    const importance =
        Number(
            article.importance || 0
        );


    const priority =
        importance >= 9
            ? "high"
            : importance >= 7
                ? "medium"
                : "low";


    const date =
        getDisplayDate(article);


    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    const topics =
        toArray(
            article.topics
        );


    const gs =
        getGsPapers(article);


    return `

        <article class="list-item">

            <div>

                ${
                    date
                        ? `
                            <div class="article-date">
                                ${formatDate(date)}
                            </div>
                        `
                        : ""
                }


                <div class="article-meta">

                    <span
                        class="badge ${priority}"
                    >
                        ${importance}/10
                    </span>


                    ${gs
                        .map(
                            item => `
                                <span class="badge">
                                    ${escapeHtml(item)}
                                </span>
                            `
                        )
                        .join("")
                    }

                </div>


                <h4>
                    ${escapeHtml(title)}
                </h4>


                <p>
                    ${escapeHtml(
                        topics.join(" · ")
                    )}
                </p>

            </div>


            <button
                type="button"
                class="text-button"
                onclick="openArticle(${JSON.stringify(article.id)})"
            >
                Read →
            </button>

        </article>

    `;
}


/* =========================================================
   ARTICLE DETAIL
   ========================================================= */

function openArticle(id) {

    const article =
        articles.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!article) {
        return;
    }


    const date =
        getDisplayDate(article);


    let html = `

        ${
            date
                ? `
                    <div class="article-date">
                        ${formatDate(date)}
                    </div>
                `
                : ""
        }


        <div class="article-meta">

            <span class="badge high">
                Importance
                ${article.importance || 0}/10
            </span>


            ${getGsPapers(article)
                .map(
                    gs => `
                        <span class="badge">
                            ${escapeHtml(gs)}
                        </span>
                    `
                )
                .join("")
            }

        </div>


        <h1 class="detail-title">
            ${escapeHtml(
                article.english_title ||
                article.title ||
                "Untitled article"
            )}
        </h1>


        ${
            article.english_summary
                ? `
                    <p class="detail-summary">
                        ${escapeHtml(
                            article.english_summary
                        )}
                    </p>
                `
                : ""
        }

    `;


    const sections = [

        [
            "Prelims Facts",
            article.prelims_facts
        ],

        [
            "Mains Notes",
            article.mains_notes
        ],

        [
            "Important Data",
            article.data_points
        ],

        [
            "Schemes / Programmes",
            article.schemes
        ],

        [
            "Institutions",
            article.institutions
        ],

        [
            "Implications",
            article.implications
        ],

        [
            "Possible UPSC Questions",
            article.possible_questions
        ]

    ];


    sections.forEach(
        ([title, values]) => {

            const items =
                toArray(values);

            if (
                items.length === 0
            ) {
                return;
            }


            html += `

                <div class="detail-section">

                    <h4>
                        ${escapeHtml(title)}
                    </h4>

                    <ul>

                        ${items
                            .map(
                                item => `
                                    <li>
                                        ${escapeHtml(item)}
                                    </li>
                                `
                            )
                            .join("")
                        }

                    </ul>

                </div>

            `;
        }
    );


    if (article.link) {

        html += `

            <div class="detail-section">

                <a
                    href="${escapeHtml(article.link)}"
                    target="_blank"
                    rel="noopener"
                >
                    Read original PIB release →
                </a>

            </div>

        `;
    }


    const detail =
        document.getElementById(
            "article-detail"
        );


    const modal =
        document.getElementById(
            "article-modal"
        );


    if (detail) {
        detail.innerHTML = html;
    }


    if (modal) {
        modal.classList.remove("hidden");
    }
}


/* =========================================================
   FLASHCARDS
   ========================================================= */

function buildFlashcards() {

    flashcards = [];


    articles.forEach(
        article => {

            const title =
                article.english_title ||
                article.title ||
                "Current Affair";


            /*
             * First use explicitly generated
             * flashcards if they exist.
             */

            const explicitCards =
                getArticleFlashcards(
                    article
                );


            if (
                explicitCards.length > 0
            ) {

                explicitCards.forEach(
                    card => {

                        if (!card) {
                            return;
                        }


                        const question =
                            card.question ||
                            card.q ||
                            card.front ||
                            "";


                        const answer =
                            card.answer ||
                            card.a ||
                            card.back ||
                            "";


                        if (
                            !question ||
                            !answer
                        ) {
                            return;
                        }


                        flashcards.push({

                            type:
                                card.type ||
                                "Concept",

                            question,

                            answer,

                            article:
                                title

                        });

                    }
                );


                return;
            }


            /*
             * FALLBACK:
             *
             * Existing processed article
             * fields are converted into
             * useful revision cards.
             */

            const summary =
                article.english_summary ||
                article.summary ||
                "";


            if (summary) {

                flashcards.push({

                    type:
                        "Overview",

                    question:
                        `What is the key development in: ${title}?`,

                    answer:
                        summary,

                    article:
                        title

                });
            }


            const prelims =
                toArray(
                    article.prelims_facts
                );


            prelims
                .slice(0, 3)
                .forEach(
                    fact => {

                        if (!fact) {
                            return;
                        }


                        flashcards.push({

                            type:
                                "Prelims",

                            question:
                                `What should you remember about ${title}?`,

                            answer:
                                String(fact),

                            article:
                                title

                        });

                    }
                );


            const mains =
                toArray(
                    article.mains_notes
                );


            mains
                .slice(0, 2)
                .forEach(
                    note => {

                        if (!note) {
                            return;
                        }


                        flashcards.push({

                            type:
                                "Mains",

                            question:
                                `What is an important Mains takeaway from ${title}?`,

                            answer:
                                String(note),

                            article:
                                title

                        });

                    }
                );

        }
    );


    currentFlashcard = 0;

    renderFlashcard();
}


function renderFlashcard() {

    const container =
        document.getElementById(
            "flashcard-container"
        );


    const progress =
        document.getElementById(
            "flashcard-progress"
        );


    if (!container) {
        return;
    }


    if (
        flashcards.length === 0
    ) {

        container.innerHTML = `

            <div class="flashcard">

                <h3>
                    No flashcards available
                </h3>

                <p class="answer">
                    No processed revision material
                    is available yet.
                </p>

            </div>

        `;


        if (progress) {
            progress.textContent =
                "0 / 0";
        }


        return;
    }


    const card =
        flashcards[
            currentFlashcard
        ];


    container.innerHTML = `

        <div class="flashcard">

            <span class="type">
                ${escapeHtml(
                    card.type ||
                    "Concept"
                )}
            </span>


            <h3>
                ${escapeHtml(
                    card.question
                )}
            </h3>


            <div
                id="flash-answer"
                class="answer"
                style="display:none"
            >
                ${escapeHtml(
                    card.answer
                )}
            </div>


            <div class="flashcard-actions">

                <button
                    type="button"
                    onclick="showAnswer()"
                >
                    Show answer
                </button>


                <button
                    type="button"
                    onclick="nextFlashcard()"
                >
                    Next →
                </button>

            </div>

        </div>

    `;


    if (progress) {

        progress.textContent =
            `${currentFlashcard + 1} / ${flashcards.length}`;
    }
}


function showAnswer() {

    const answer =
        document.getElementById(
            "flash-answer"
        );

    if (answer) {
        answer.style.display =
            "block";
    }
}


function nextFlashcard() {

    if (
        flashcards.length === 0
    ) {
        return;
    }


    currentFlashcard++;

    if (
        currentFlashcard >=
        flashcards.length
    ) {
        currentFlashcard = 0;
    }


    renderFlashcard();
}


/* =========================================================
   REVISION
   ========================================================= */

function renderRevision() {

    const container =
        document.getElementById(
            "revision-list"
        );


    if (!container) {
        return;
    }


    const important =
        articles
            .filter(
                article =>
                    Number(
                        article.importance || 0
                    ) >= 7
            )
            .sort(
                (a, b) =>
                    Number(
                        b.importance || 0
                    ) -
                    Number(
                        a.importance || 0
                    )
            )
            .slice(
                0,
                15
            );


    container.innerHTML =
        important
            .map(
                articleListItem
            )
            .join("");
}


/* =========================================================
   GS PAPERS
   ========================================================= */

function renderGS(gs) {

    const container =
        document.getElementById(
            "gs-articles"
        );


    if (!container) {
        return;
    }


    const filtered =
        articles.filter(
            article =>
                isRelevantArticle(article) &&
                getGsPapers(
                    article
                ).includes(gs)
        );


    const sorted =
        sortNewestFirst(
            filtered
        );


    container.innerHTML = `

        <div class="section-header">

            <div>

                <div class="section-label">
                    ${escapeHtml(gs)}
                </div>

                <h2>
                    ${escapeHtml(gs)}
                    Current Affairs
                </h2>

            </div>

        </div>


        ${
            sorted.length === 0

                ? `
                    <div class="empty-state">
                        No relevant current affairs
                        are mapped to
                        ${escapeHtml(gs)}
                        yet.
                    </div>
                `

                : `
                    <div class="article-list">
                        ${sorted
                            .map(
                                articleListItem
                            )
                            .join("")
                        }
                    </div>
                `
        }

    `;
}


/* =========================================================
   GS CARD CLICK HANDLERS
   ========================================================= */

function initialiseGsCards() {

    document
        .querySelectorAll(
            ".gs-card"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const gs =
                            button.dataset.gs;


                        if (!gs) {
                            return;
                        }


                        showView("gs");

                        renderGS(gs);


                        document
                            .querySelectorAll(
                                ".gs-card"
                            )
                            .forEach(
                                card =>
                                    card.classList.toggle(
                                        "selected",
                                        card ===
                                        button
                                    )
                            );

                    }
                );

            }
        );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showView(view) {

    document
        .querySelectorAll(
            ".view"
        )
        .forEach(
            element =>
                element.classList.remove(
                    "active-view"
                )
        );


    const target =
        document.getElementById(
            `${view}-view`
        );


    if (target) {

        target.classList.add(
            "active-view"
        );
    }


    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(
            button =>
                button.classList.toggle(
                    "active",
                    button.dataset.view ===
                    view
                )
        );


    const titles = {

        dashboard:
            "Dashboard",

        articles:
            "Current Affairs",

        gs:
            "GS Papers",

        flashcards:
            "Flashcards",

        revision:
            "Revision"

    };


    setText(
        "page-title",
        titles[view] ||
        "Dashboard"
    );


    if (
        view === "flashcards"
    ) {
        renderFlashcard();
    }


    if (
        view === "revision"
    ) {
        renderRevision();
    }
}


/* =========================================================
   NAV BUTTONS
   ========================================================= */

function initialiseNavigation() {

    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        showView(
                            button.dataset.view
                        )
                );

            }
        );


    document
        .querySelectorAll(
            "[data-view]"
        )
        .forEach(
            button => {

                if (
                    button.classList.contains(
                        "nav-item"
                    )
                ) {
                    return;
                }


                button.addEventListener(
                    "click",
                    () =>
                        showView(
                            button.dataset.view
                        )
                );

            }
        );
}


/* =========================================================
   FILTER EVENTS
   ========================================================= */

function initialiseFilters() {

    const monthFilter =
        document.getElementById(
            "month-filter"
        );


    if (monthFilter) {

        monthFilter.addEventListener(
            "change",
            event => {

                selectedMonth =
                    event.target.value ||
                    "ALL";

                applyAllFilters();

            }
        );
    }


    const importanceFilter =
        document.getElementById(
            "importance-filter"
        );


    const gsFilter =
        document.getElementById(
            "gs-filter"
        );


    [
        importanceFilter,
        gsFilter
    ]
        .filter(Boolean)
        .forEach(
            element =>
                element.addEventListener(
                    "change",
                    applyAllFilters
                )
        );
}


/* =========================================================
   SEARCH
   ========================================================= */

function initialiseSearch() {

    const search =
        document.getElementById(
            "global-search"
        );


    if (!search) {
        return;
    }


    search.addEventListener(
        "input",
        event => {

            const query =
                event.target.value
                    .toLowerCase()
                    .trim();


            if (!query) {

                applyAllFilters();

                return;
            }


            const base =
                getArticlesMatchingFilters();


            const filtered =
                base.filter(
                    article => {

                        const title =
                            (
                                article.english_title ||
                                article.title ||
                                ""
                            )
                                .toLowerCase();


                        const summary =
                            (
                                article.english_summary ||
                                article.summary ||
                                ""
                            )
                                .toLowerCase();


                        const raw =
                            (
                                article.raw_text ||
                                ""
                            )
                                .toLowerCase();


                        const topics =
                            toArray(
                                article.topics
                            )
                                .join(" ")
                                .toLowerCase();


                        return (
                            title.includes(query) ||
                            summary.includes(query) ||
                            raw.includes(query) ||
                            topics.includes(query)
                        );
                    }
                );


            currentDisplayedArticles =
                [...filtered];


            showView(
                "articles"
            );


            renderArticles(
                filtered
            );

        }
    );
}


/* =========================================================
   MODAL
   ========================================================= */

function initialiseModal() {

    const close =
        document.getElementById(
            "close-modal"
        );


    const modal =
        document.getElementById(
            "article-modal"
        );


    if (close) {

        close.addEventListener(
            "click",
            () => {

                if (modal) {

                    modal.classList.add(
                        "hidden"
                    );
                }

            }
        );
    }


    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    modal.classList.add(
                        "hidden"
                    );
                }

            }
        );
    }
}


/* =========================================================
   PDF
   ========================================================= */

function setPdfButtonState(
    loading
) {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    if (!button) {
        return;
    }


    button.disabled =
        loading;


    button.classList.toggle(
        "loading",
        loading
    );


    button.textContent =
        loading
            ? "Preparing PDF…"
            : "↓ Download PDF";
}


function getPdfArticles() {

    /*
     * IMPORTANT:
     *
     * PDF receives only currently displayed
     * relevant articles.
     */

    const source =
        Array.isArray(
            currentDisplayedArticles
        )
            ? currentDisplayedArticles
            : getArticlesMatchingFilters();


    return sortNewestFirst(
        source.filter(
            isRelevantArticle
        )
    );
}


function generateCurrentAffairsPDF() {

    const pdfApi =
        window.jspdf;


    if (
        !pdfApi ||
        !pdfApi.jsPDF
    ) {

        alert(
            "PDF generator is not ready. Please refresh the page and try again."
        );

        console.error(
            "jsPDF was not loaded."
        );

        return;
    }


    const pdfArticles =
        getPdfArticles();


    if (
        pdfArticles.length === 0
    ) {

        alert(
            "There are no relevant articles to export."
        );

        return;
    }


    setPdfButtonState(
        true
    );


    try {

        const {
            jsPDF
        } = pdfApi;


        const doc =
            new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });


        const pageWidth =
            doc.internal.pageSize.getWidth();


        const pageHeight =
            doc.internal.pageSize.getHeight();


        const margin =
            16;


        const contentWidth =
            pageWidth -
            margin * 2;


        let y = 18;


        function ensureSpace(
            height
        ) {

            if (
                y + height >
                pageHeight - 16
            ) {

                doc.addPage();

                y = 18;
            }
        }


        function writeWrapped(
            text,
            size = 9,
            lineHeight = 4.5,
            bold = false,
            color = [70, 76, 86]
        ) {

            if (!text) {
                return;
            }


            doc.setFont(
                "helvetica",
                bold
                    ? "bold"
                    : "normal"
            );


            doc.setFontSize(
                size
            );


            doc.setTextColor(
                color[0],
                color[1],
                color[2]
            );


            const lines =
                doc.splitTextToSize(
                    String(text),
                    contentWidth
                );


            ensureSpace(
                lines.length *
                lineHeight +
                2
            );


            doc.text(
                lines,
                margin,
                y
            );


            y +=
                lines.length *
                lineHeight;
        }


        /* HEADER */

        doc.setFont(
            "helvetica",
            "bold"
        );


        doc.setFontSize(
            20
        );


        doc.setTextColor(
            23,
            25,
            29
        );


        doc.text(
            "PIB UPSC",
            margin,
            y
        );


        y += 6;


        const monthLabel =
            selectedMonth === "ALL"
                ? "All Months"
                : getMonthLabelFromKey(
                    selectedMonth
                );


        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.setFontSize(
            9
        );


        doc.setTextColor(
            105,
            111,
            120
        );


        doc.text(
            `High-priority relevant current affairs · ${monthLabel}`,
            margin,
            y
        );


        y += 5;


        doc.text(
            `${pdfArticles.length} articles`,
            margin,
            y
        );


        y += 7;


        doc.setDrawColor(
            220,
            223,
            227
        );


        doc.line(
            margin,
            y,
            pageWidth - margin,
            y
        );


        y += 9;


        /* ARTICLES */

        pdfArticles.forEach(
            (article, index) => {

                ensureSpace(
                    30
                );


                doc.setFont(
                    "helvetica",
                    "bold"
                );


                doc.setFontSize(
                    8
                );


                doc.setTextColor(
                    115,
                    121,
                    130
                );


                doc.text(
                    `ARTICLE ${index + 1}`,
                    margin,
                    y
                );


                y += 5;


                const date =
                    getDisplayDate(
                        article
                    );


                const importance =
                    Number(
                        article.importance ||
                        0
                    );


                const gs =
                    getGsPapers(
                        article
                    ).join(
                        " · "
                    );


                const meta =
                    [
                        date
                            ? formatDate(date)
                            : "",

                        `${importance}/10`,

                        gs

                    ]
                        .filter(Boolean)
                        .join(
                            "   ·   "
                        );


                doc.setFont(
                    "helvetica",
                    "normal"
                );


                doc.setFontSize(
                    8
                );


                doc.setTextColor(
                    105,
                    111,
                    120
                );


                doc.text(
                    meta,
                    margin,
                    y
                );


                y += 6;


                writeWrapped(
                    article.english_title ||
                    article.title ||
                    "Untitled article",
                    12,
                    5.3,
                    true,
                    [23, 25, 29]
                );


                const summary =
                    article.english_summary ||
                    article.summary ||
                    "";


                if (summary) {

                    y += 2;

                    writeWrapped(
                        summary,
                        9,
                        4.5,
                        false,
                        [80, 87, 97]
                    );
                }


                const topics =
                    toArray(
                        article.topics
                    ).join(
                        " · "
                    );


                if (topics) {

                    y += 3;

                    writeWrapped(
                        `Topics: ${topics}`,
                        8,
                        4,
                        false,
                        [80, 87, 97]
                    );
                }


                const prelims =
                    toArray(
                        article.prelims_facts
                    );


                if (
                    prelims.length > 0
                ) {

                    y += 3;


                    writeWrapped(
                        "Prelims Facts",
                        9,
                        4.5,
                        true,
                        [30, 34, 40]
                    );


                    prelims
                        .slice(
                            0,
                            4
                        )
                        .forEach(
                            fact => {

                                writeWrapped(
                                    `• ${fact}`,
                                    8,
                                    4,
                                    false,
                                    [80, 87, 97]
                                );

                            }
                        );
                }


                const mains =
                    toArray(
                        article.mains_notes
                    );


                if (
                    mains.length > 0
                ) {

                    y += 3;


                    writeWrapped(
                        "Mains Notes",
                        9,
                        4.5,
                        true,
                        [30, 34, 40]
                    );


                    mains
                        .slice(
                            0,
                            3
                        )
                        .forEach(
                            note => {

                                writeWrapped(
                                    `• ${note}`,
                                    8,
                                    4,
                                    false,
                                    [80, 87, 97]
                                );

                            }
                        );
                }


                y += 4;


                doc.setDrawColor(
                    225,
                    227,
                    230
                );


                doc.line(
                    margin,
                    y,
                    pageWidth - margin,
                    y
                );


                y += 8;

            }
        );


        /* FOOTERS */

        const totalPages =
            doc.internal
                .getNumberOfPages();


        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {

            doc.setPage(
                page
            );


            doc.setFont(
                "helvetica",
                "normal"
            );


            doc.setFontSize(
                7
            );


            doc.setTextColor(
                135,
                140,
                147
            );


            doc.text(
                "PIB UPSC · Current Affairs",
                margin,
                pageHeight - 8
            );


            doc.text(
                `Page ${page} of ${totalPages}`,
                pageWidth - margin,
                pageHeight - 8,
                {
                    align: "right"
                }
            );

        }


        const safeMonth =
            monthLabel
                .replace(
                    /[^a-zA-Z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-|-$/g,
                    ""
                );


        doc.save(
            `PIB-UPSC-${safeMonth}-Current-Affairs.pdf`
        );


    } catch (error) {

        console.error(
            "PDF generation error:",
            error
        );


        alert(
            "Unable to generate the PDF. Please check the browser console."
        );

    } finally {

        setPdfButtonState(
            false
        );
    }
}


function initialisePdf() {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        generateCurrentAffairsPDF
    );
}


/* =========================================================
   REFRESH
   ========================================================= */

function initialiseRefresh() {

    const button =
        document.getElementById(
            "refresh-btn"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        loadArticles
    );
}


/* =========================================================
   ERROR
   ========================================================= */

function showLoadError(
    message
) {

    const container =
        document.getElementById(
            "articles-list"
        );


    if (container) {

        container.innerHTML = `

            <div class="empty-state">

                ${escapeHtml(
                    message
                )}

            </div>

        `;
    }
}


/* =========================================================
   INITIALISATION
   ========================================================= */

function initialiseApp() {

    initialiseNavigation();

    initialiseFilters();

    initialiseSearch();

    initialiseModal();

    initialiseGsCards();

    initialisePdf();

    initialiseRefresh();

    loadArticles();
}


document.addEventListener(
    "DOMContentLoaded",
    initialiseApp
);
