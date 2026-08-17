/* =========================================================
   PIB UPSC — APP.JS
   Stable production version
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
   GLOBAL STATE
   ========================================================= */

let articles = [];
let flashcards = [];

let currentFlashcard = 0;
let lastFetchTime = null;
let isLoading = false;

let selectedMonth = "ALL";


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initialiseApp();
});


/* =========================================================
   INITIALISE
   ========================================================= */

function initialiseApp() {

    setupNavigation();
    setupFilters();
    setupSearch();
    setupModal();
    setupRefresh();

    loadArticles();
}


/* =========================================================
   DATE HELPERS
   ========================================================= */

/*
 * Priority:
 * 1. published_at
 * 2. fetched_at
 * 3. created_at
 * 4. inserted_at
 * 5. updated_at
 */
function getArticleDate(article) {

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

        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}


function getDisplayDate(article) {

    const articleDate = getArticleDate(article);

    if (articleDate) {
        return articleDate;
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

    if (Number.isNaN(date.getTime())) {
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


function getMonthKey(article) {

    const date = getDisplayDate(article);

    if (!date) {
        return "UNKNOWN";
    }

    return (
        `${date.getFullYear()}-` +
        `${String(date.getMonth() + 1).padStart(2, "0")}`
    );
}


function getMonthLabelFromKey(key) {

    if (!key || key === "UNKNOWN") {
        return "RECENT ARTICLES";
    }

    const [year, month] = key.split("-");

    const date = new Date(
        Number(year),
        Number(month) - 1,
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


/* =========================================================
   NORMALISATION HELPERS
   ========================================================= */

function getImportance(article) {

    const value = Number(
        article.importance
    );

    if (Number.isNaN(value)) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(10, value)
    );
}


function isRelevant(article) {

    /*
     * If the AI explicitly marked it false,
     * it is not part of the UPSC feed.
     */

    if (
        article.relevant === false ||
        article.relevant === "false" ||
        article.relevant === 0 ||
        article.relevant === "0"
    ) {
        return false;
    }

    /*
     * If importance is below 7,
     * don't show it in the UPSC-facing feed.
     */

    return getImportance(article) >= 7;
}


/*
 * This is the MOST IMPORTANT display filter.
 *
 * Database can contain:
 * - irrelevant articles
 * - failed AI processing
 * - 0/10 articles
 * - background releases
 *
 * The UPSC UI should only show meaningful articles.
 */
function getUPSCArticles() {

    return articles.filter(
        article => isRelevant(article)
    );
}


function getArray(value) {

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

            if (Array.isArray(parsed)) {
                return parsed;
            }

        } catch (error) {
            /*
             * Ignore invalid JSON.
             */
        }

        return value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    return [];
}


function getGsPapers(article) {

    return getArray(
        article.gs_papers
    );
}


function getTopics(article) {

    return getArray(
        article.topics
    );
}


/* =========================================================
   SORTING
   ========================================================= */

function articleTimestamp(article) {

    const date =
        getArticleDate(article);

    if (!date) {
        return 0;
    }

    return date.getTime();
}


function sortNewestFirst(list) {

    return [...list].sort(
        (a, b) =>
            articleTimestamp(b) -
            articleTimestamp(a)
    );
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

    button.disabled = loading;

    button.classList.toggle(
        "loading",
        loading
    );
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

    const date =
        new Date(lastFetchTime);

    element.textContent =
        `Updated ${date.toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )}`;
}


/* =========================================================
   LOAD ARTICLES FROM SUPABASE
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
            .select("*");

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
                ? data
                : [];

        articles =
            sortNewestFirst(
                articles
            );

        lastFetchTime =
            new Date();

        /*
         * Rebuild everything from fresh data.
         */

        buildMonthSlicer();
        buildFlashcards();

        renderDashboard();
        applyAllFilters();
        renderRevision();

        updateLastUpdated();

    } catch (error) {

        console.error(
            "Load error:",
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
   MONTH SLICER
   ========================================================= */

function buildMonthSlicer() {

    const select =
        document.getElementById(
            "month-filter"
        );

    if (!select) {
        return;
    }

    const monthMap = new Map();

    /*
     * IMPORTANT:
     * Build months from ALL database articles,
     * not only relevant articles.
     *
     * This means the slicer reflects the database.
     */

    articles.forEach(article => {

        const key =
            getMonthKey(article);

        if (key === "UNKNOWN") {
            return;
        }

        if (!monthMap.has(key)) {

            monthMap.set(
                key,
                getMonthLabelFromKey(key)
            );
        }
    });


    const months =
        Array.from(
            monthMap.entries()
        ).sort(
            (a, b) =>
                b[0].localeCompare(
                    a[0]
                )
        );


    select.innerHTML =
        `
        <option value="ALL">
            All Months
        </option>

        ${
            months
                .map(
                    ([key, label]) =>
                        `
                        <option value="${escapeHtml(key)}">
                            ${escapeHtml(label)}
                        </option>
                        `
                )
                .join("")
        }
        `;


    const stillExists =
        months.some(
            ([key]) =>
                key === selectedMonth
        );


    if (
        selectedMonth !== "ALL" &&
        stillExists
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
   FILTERS
   ========================================================= */

function applyAllFilters() {

    /*
     * START WITH ONLY UPSC-RELEVANT ARTICLES.
     *
     * This removes 0/10 articles from the feed.
     */

    let filtered =
        getUPSCArticles();


    /* -------------------------
       MONTH
       ------------------------- */

    if (
        selectedMonth !== "ALL"
    ) {

        filtered =
            filtered.filter(
                article =>
                    getMonthKey(article) ===
                    selectedMonth
            );
    }


    /* -------------------------
       IMPORTANCE
       ------------------------- */

    const importanceFilter =
        document.getElementById(
            "importance-filter"
        );

    const importance =
        importanceFilter
            ? importanceFilter.value
            : "";


    if (importance) {

        const min =
            Number(importance);

        let max = 10;

        if (min === 7) {
            max = 8;
        }

        if (min === 4) {
            max = 6;
        }

        if (min === 1) {
            max = 3;
        }

        filtered =
            filtered.filter(
                article => {

                    const score =
                        getImportance(article);

                    return (
                        score >= min &&
                        score <= max
                    );
                }
            );
    }


    /* -------------------------
       GS PAPER
       ------------------------- */

    const gsFilter =
        document.getElementById(
            "gs-filter"
        );

    const gs =
        gsFilter
            ? gsFilter.value
            : "";


    if (gs) {

        filtered =
            filtered.filter(
                article =>
                    getGsPapers(article)
                        .includes(gs)
            );
    }


    /* -------------------------
       RELEVANCE
       ------------------------- */

    /*
     * Since this is already the UPSC feed,
     * "All Articles" effectively means
     * all UPSC-relevant articles.
     */

    const relevanceFilter =
        document.getElementById(
            "relevance-filter"
        );

    const relevance =
        relevanceFilter
            ? relevanceFilter.value
            : "";


    if (relevance === "true") {

        filtered =
            filtered.filter(
                article =>
                    isRelevant(article)
            );
    }


    if (relevance === "false") {

        /*
         * There are intentionally no
         * non-relevant articles in the
         * UPSC Current Affairs feed.
         */

        filtered = [];
    }


    renderArticles(
        sortNewestFirst(filtered)
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
                article.processed === 1
        ).length;


    const relevant =
        getUPSCArticles().length;


    const important =
        getUPSCArticles().filter(
            article =>
                getImportance(article) >= 7
        ).length;


    /*
     * DATABASE METRICS
     */

    setText(
        "hero-count",
        relevant
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
        relevant
    );

    setText(
        "important-count",
        important
    );


    /*
     * RECENT FEED
     *
     * Only relevant articles.
     */

    const recent =
        getUPSCArticles()
            .slice(0, 6);


    const container =
        document.getElementById(
            "recent-articles"
        );


    if (!container) {
        return;
    }


    if (recent.length === 0) {

        container.innerHTML =
            `
            <div class="empty-state">
                No UPSC-relevant articles available yet.
            </div>
            `;

        return;
    }


    container.innerHTML =
        `
        <div class="recent-grid">
            ${
                recent
                    .map(articleCard)
                    .join("")
            }
        </div>
        `;
}


/* =========================================================
   ARTICLE CARD
   ========================================================= */

function articleCard(article) {

    const importance =
        getImportance(article);


    const priority =
        importance >= 9
            ? "high"
            : "medium";


    const date =
        getDisplayDate(article);


    const dateText =
        formatDate(date);


    const gsPapers =
        getGsPapers(article);


    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    const summary =
        article.english_summary ||
        "";


    return `
        <article class="article-card">

            ${
                dateText
                    ? `
                        <div class="article-date">
                            ${escapeHtml(dateText)}
                        </div>
                    `
                    : ""
            }


            <div class="article-meta">

                <span class="badge ${priority}">
                    ${importance}/10
                </span>


                ${
                    gsPapers
                        .slice(0, 2)
                        .map(
                            gs =>
                                `
                                <span class="badge">
                                    ${escapeHtml(gs)}
                                </span>
                                `
                        )
                        .join("")
                }

            </div>


            <h4>
                ${escapeHtml(title)}
            </h4>


            ${
                summary
                    ? `
                        <p>
                            ${escapeHtml(summary)}
                        </p>
                    `
                    : ""
            }


            <button
                class="article-action"
                data-article-id="${escapeHtml(article.id)}"
            >
                Read analysis →
            </button>

        </article>
    `;
}


/* =========================================================
   ARTICLE LIST
   ========================================================= */

function renderArticles(filtered) {

    const container =
        document.getElementById(
            "articles-list"
        );


    if (!container) {
        return;
    }


    /*
     * Safety:
     * Never allow irrelevant / low-score
     * articles into this view.
     */

    filtered =
        filtered.filter(
            article =>
                isRelevant(article)
        );


    if (
        !filtered ||
        filtered.length === 0
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                No UPSC-relevant articles found for the selected filters.
            </div>
            `;

        return;
    }


    filtered =
        sortNewestFirst(filtered);


    /*
     * GROUP BY MONTH
     */

    const groups =
        new Map();


    filtered.forEach(article => {

        const key =
            getMonthKey(article);


        if (!groups.has(key)) {

            groups.set(
                key,
                []
            );
        }


        groups
            .get(key)
            .push(article);
    });


    const sortedGroups =
        Array.from(
            groups.entries()
        ).sort(
            (a, b) =>
                b[0].localeCompare(
                    a[0]
                )
        );


    container.innerHTML =
        sortedGroups
            .map(
                ([key, monthArticles]) =>
                    `
                    <section class="month-section">

                        <div class="month-heading">
                            ${escapeHtml(
                                getMonthLabelFromKey(key)
                            )}
                        </div>


                        <div class="article-list">

                            ${
                                monthArticles
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


    attachArticleButtons();
}


/* =========================================================
   ARTICLE LIST ITEM
   ========================================================= */

function articleListItem(article) {

    const importance =
        getImportance(article);


    const priority =
        importance >= 9
            ? "high"
            : "medium";


    const date =
        getDisplayDate(article);


    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    const topics =
        getTopics(article);


    const gsPapers =
        getGsPapers(article);


    return `
        <article class="list-item">

            <div class="list-item-content">

                ${
                    date
                        ? `
                            <div class="article-date">
                                ${escapeHtml(
                                    formatDate(date)
                                )}
                            </div>
                        `
                        : ""
                }


                <div class="article-meta">

                    <span class="badge ${priority}">
                        ${importance}/10
                    </span>


                    ${
                        gsPapers
                            .map(
                                gs =>
                                    `
                                    <span class="badge">
                                        ${escapeHtml(gs)}
                                    </span>
                                    `
                            )
                            .join("")
                    }

                </div>


                <h4>
                    ${escapeHtml(title)}
                </h4>


                ${
                    topics.length
                        ? `
                            <p>
                                ${escapeHtml(
                                    topics.join(" · ")
                                )}
                            </p>
                        `
                        : ""
                }

            </div>


            <button
                class="article-action"
                data-article-id="${escapeHtml(article.id)}"
            >
                Read analysis →
            </button>

        </article>
    `;
}


/* =========================================================
   ARTICLE BUTTON EVENTS
   ========================================================= */

function attachArticleButtons() {

    document
        .querySelectorAll(
            "[data-article-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openArticle(
                        button.dataset.articleId
                    );

                }
            );

        });
}


/* =========================================================
   ARTICLE DETAIL MODAL
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


    const importance =
        getImportance(article);


    const gsPapers =
        getGsPapers(article);


    let html =
        `
        ${
            date
                ? `
                    <div class="article-date">
                        ${escapeHtml(
                            formatDate(date)
                        )}
                    </div>
                `
                : ""
        }


        <div class="article-meta">

            <span class="badge high">
                Importance ${importance}/10
            </span>


            ${
                gsPapers
                    .map(
                        gs =>
                            `
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
            getArray(article.prelims_facts)
        ],

        [
            "Mains Notes",
            getArray(article.mains_notes)
        ],

        [
            "Important Data",
            getArray(article.data_points)
        ],

        [
            "Schemes / Programmes",
            getArray(article.schemes)
        ],

        [
            "Institutions",
            getArray(article.institutions)
        ],

        [
            "Implications",
            getArray(article.implications)
        ],

        [
            "Possible UPSC Questions",
            getArray(article.possible_questions)
        ],

        [
            "Keywords",
            getArray(article.keywords)
        ],

        [
            "Flashcards",
            getArray(article.flashcards)
        ]

    ];


    sections.forEach(
        ([title, values]) => {

            if (
                !Array.isArray(values) ||
                values.length === 0
            ) {
                return;
            }


            /*
             * Flashcards can be objects,
             * so handle them separately.
             */

            const formatted =
                values
                    .map(item => {

                        if (
                            typeof item === "object" &&
                            item !== null
                        ) {

                            return (
                                item.question ||
                                item.answer ||
                                JSON.stringify(item)
                            );
                        }

                        return String(item);
                    })
                    .filter(Boolean);


            if (!formatted.length) {
                return;
            }


            html +=
                `
                <div class="detail-section">

                    <h4>
                        ${escapeHtml(title)}
                    </h4>


                    <ul>

                        ${
                            formatted
                                .map(
                                    item =>
                                        `
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

        html +=
            `
            <div class="detail-section">

                <a
                    href="${escapeHtml(article.link)}"
                    target="_blank"
                    rel="noopener noreferrer"
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
        document.body.classList.add("modal-open");
    }
}


/* =========================================================
   FLASHCARDS
   ========================================================= */

function buildFlashcards() {

    flashcards = [];


    articles.forEach(article => {

        const cards =
            getArray(
                article.flashcards
            );


        cards.forEach(card => {

            if (
                typeof card === "object" &&
                card !== null
            ) {

                flashcards.push({
                    ...card,
                    article:
                        article.title ||
                        article.english_title ||
                        ""
                });

            }

        });

    });


    currentFlashcard = 0;

    renderFlashcard();
}


function renderFlashcard() {

    const container =
        document.getElementById(
            "flashcard-container"
        );


    if (!container) {
        return;
    }


    if (
        flashcards.length === 0
    ) {

        container.innerHTML =
            `
            <div class="flashcard">

                <h3>
                    No flashcards yet
                </h3>

                <p class="answer">
                    Process more PIB articles
                    to generate revision cards.
                </p>

            </div>
            `;

        updateFlashcardProgress();

        return;
    }


    const card =
        flashcards[
            currentFlashcard
        ];


    container.innerHTML =
        `
        <div class="flashcard">

            <span class="type">
                ${escapeHtml(
                    card.type ||
                    "Concept"
                )}
            </span>


            <h3>
                ${escapeHtml(
                    card.question ||
                    ""
                )}
            </h3>


            <div
                id="flash-answer"
                class="answer"
                style="display:none;"
            >
                ${escapeHtml(
                    card.answer ||
                    ""
                )}
            </div>


            <div class="flashcard-actions">

                <button
                    class="article-action"
                    id="show-answer-btn"
                >
                    Show answer
                </button>


                <button
                    class="article-action"
                    id="next-card-btn"
                >
                    Next →
                </button>

            </div>

        </div>
        `;


    document
        .getElementById(
            "show-answer-btn"
        )
        ?.addEventListener(
            "click",
            showAnswer
        );


    document
        .getElementById(
            "next-card-btn"
        )
        ?.addEventListener(
            "click",
            nextFlashcard
        );


    updateFlashcardProgress();
}


function updateFlashcardProgress() {

    const progress =
        document.getElementById(
            "flashcard-progress"
        );


    if (!progress) {
        return;
    }


    progress.textContent =
        flashcards.length
            ? `${currentFlashcard + 1} / ${flashcards.length}`
            : "0 / 0";
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

    if (!flashcards.length) {
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

    const important =
        getUPSCArticles()
            .sort(
                (a, b) =>
                    getImportance(b) -
                    getImportance(a)
            )
            .slice(0, 15);


    const container =
        document.getElementById(
            "revision-list"
        );


    if (!container) {
        return;
    }


    if (!important.length) {

        container.innerHTML =
            `
            <div class="empty-state">
                No high-priority articles available.
            </div>
            `;

        return;
    }


    container.innerHTML =
        `
        <div class="article-list">
            ${
                important
                    .map(articleListItem)
                    .join("")
            }
        </div>
        `;


    attachArticleButtons();
}


/* =========================================================
   GS PAPERS
   ========================================================= */

function renderGS(gs) {

    const filtered =
        getUPSCArticles()
            .filter(
                article =>
                    getGsPapers(article)
                        .includes(gs)
            );


    const container =
        document.getElementById(
            "gs-articles"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        `
        <h3>
            ${escapeHtml(gs)}
            Current Affairs
        </h3>


        ${
            filtered.length
                ? `
                    <div class="article-list">
                        ${
                            sortNewestFirst(filtered)
                                .map(articleListItem)
                                .join("")
                        }
                    </div>
                `
                : `
                    <div class="empty-state">
                        No relevant articles for ${escapeHtml(gs)}.
                    </div>
                `
        }
        `;


    attachArticleButtons();
}


/* =========================================================
   FILTER EVENTS
   ========================================================= */

function setupFilters() {

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


    [
        "importance-filter",
        "gs-filter",
        "relevance-filter"
    ]
        .map(
            id =>
                document.getElementById(id)
        )
        .filter(Boolean)
        .forEach(element => {

            element.addEventListener(
                "change",
                applyAllFilters
            );

        });


    /*
     * GS cards
     */

    document
        .querySelectorAll(
            ".gs-card"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    const gs =
                        card.dataset.gs;

                    showView("gs");

                    renderGS(gs);

                }
            );

        });
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

    /*
     * Main navigation.
     */

    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showView(
                        button.dataset.view
                    );

                }
            );

        });


    /*
     * "View all" button.
     */

    document
        .querySelectorAll(
            '.text-button[data-view]'
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showView(
                        button.dataset.view
                    );

                }
            );

        });
}


function showView(view) {

    document
        .querySelectorAll(
            ".view"
        )
        .forEach(element => {

            element.classList.remove(
                "active-view"
            );

        });


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
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.view ===
                view
            );

        });


    const titles = {

        dashboard: "Dashboard",
        articles: "Current Affairs",
        gs: "GS Papers",
        flashcards: "Flashcards",
        revision: "Revision"

    };


    setText(
        "page-title",
        titles[view] ||
        "Dashboard"
    );
}


/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {

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


            /*
             * Search only the UPSC feed.
             */

            let filtered =
                getUPSCArticles();


            filtered =
                filtered.filter(
                    article => {

                        const title =
                            String(
                                article.english_title ||
                                article.title ||
                                ""
                            )
                                .toLowerCase();


                        const summary =
                            String(
                                article.english_summary ||
                                ""
                            )
                                .toLowerCase();


                        const raw =
                            String(
                                article.raw_text ||
                                ""
                            )
                                .toLowerCase();


                        const topics =
                            getTopics(article)
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


            showView("articles");

            renderArticles(filtered);

        }
    );
}


/* =========================================================
   MODAL
   ========================================================= */

function setupModal() {

    const closeModal =
        document.getElementById(
            "close-modal"
        );


    if (closeModal) {

        closeModal.addEventListener(
            "click",
            closeArticleModal
        );
    }


    const articleModal =
        document.getElementById(
            "article-modal"
        );


    if (articleModal) {

        articleModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    articleModal
                ) {

                    closeArticleModal();
                }

            }
        );
    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeArticleModal();
            }

        }
    );
}


function closeArticleModal() {

    const modal =
        document.getElementById(
            "article-modal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }


    document.body.classList.remove(
        "modal-open"
    );
}


/* =========================================================
   REFRESH
   ========================================================= */

function setupRefresh() {

    const refreshButton =
        document.getElementById(
            "refresh-btn"
        );


    if (!refreshButton) {
        return;
    }


    refreshButton.addEventListener(
        "click",
        loadArticles
    );
}


/* =========================================================
   UTILITIES
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;
    }
}


function showLoadError(message) {

    const container =
        document.getElementById(
            "articles-list"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        `
        <div class="empty-state">
            ${escapeHtml(message)}
        </div>
        `;
}


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
