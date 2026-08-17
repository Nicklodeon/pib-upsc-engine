/* =========================================================
   PIB UPSC — APP.JS
   Relevant-only dashboard + monthly slicer + PDF export
   ========================================================= */


/* =========================================================
   SUPABASE
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

let currentFilteredArticles = [];


/* =========================================================
   RELEVANCE HELPERS
   ========================================================= */

/*
 * The database may contain:
 *
 * true
 * false
 * "true"
 * "false"
 * 1
 * 0
 *
 * This function normalises all of them.
 */

function isRelevant(article) {

    if (!article) {
        return false;
    }

    const value = article.relevant;

    if (value === true) {
        return true;
    }

    if (value === 1) {
        return true;
    }

    if (
        typeof value === "string" &&
        value.toLowerCase().trim() === "true"
    ) {
        return true;
    }

    return false;
}


/*
 * IMPORTANT:
 *
 * Every UI-facing list should use this function.
 *
 * Irrelevant articles remain in the raw database response
 * but NEVER enter the application UI.
 */

function getRelevantArticles() {

    return articles.filter(
        article => isRelevant(article)
    );
}


/* =========================================================
   DATE HELPERS
   ========================================================= */

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

    const date = getArticleDate(article);

    if (date) {
        return date;
    }

    if (lastFetchTime) {
        return new Date(lastFetchTime);
    }

    return null;
}


function formatDate(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date =
        dateValue instanceof Date
            ? dateValue
            : new Date(dateValue);

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

    const date =
        getDisplayDate(article);

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

    const parts =
        key.split("-");

    const year =
        Number(parts[0]);

    const month =
        Number(parts[1]);

    const date =
        new Date(
            year,
            month - 1,
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

    button.disabled =
        loading;

    button.classList.toggle(
        "loading",
        loading
    );

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
                ? sortNewestFirst(data)
                : [];

        lastFetchTime =
            new Date();

        /*
         * Rebuild everything using the latest data.
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

    const relevant =
        getRelevantArticles();

    const monthMap =
        new Map();

    relevant.forEach(
        article => {

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
        }
    );

    const months =
        Array.from(
            monthMap.entries()
        ).sort(
            (a, b) =>
                b[0].localeCompare(a[0])
        );


    select.innerHTML =
        `
        <option value="ALL">
            All Months
        </option>

        ${months
            .map(
                ([key, label]) =>
                    `
                    <option value="${escapeHtml(key)}">
                        ${escapeHtml(label)}
                    </option>
                    `
            )
            .join("")}
        `;


    /*
     * Restore selected month if it still exists.
     */

    const exists =
        months.some(
            ([key]) =>
                key === selectedMonth
        );

    if (
        selectedMonth !== "ALL" &&
        exists
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
   APPLY FILTERS
   ========================================================= */

function applyAllFilters() {

    /*
     * START WITH RELEVANT ARTICLES ONLY.
     *
     * This is the critical rule that removes
     * irrelevant articles from the entire UI.
     */

    let filtered =
        getRelevantArticles();


    /* -----------------------------------------------------
       MONTH
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       IMPORTANCE
       ----------------------------------------------------- */

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

        let max;

        if (min === 9) {
            max = 10;
        } else if (min === 7) {
            max = 8;
        } else if (min === 4) {
            max = 6;
        } else {
            max = 3;
        }

        filtered =
            filtered.filter(
                article => {

                    const score =
                        Number(
                            article.importance || 0
                        );

                    return (
                        score >= min &&
                        score <= max
                    );
                }
            );
    }


    /* -----------------------------------------------------
       GS PAPER
       ----------------------------------------------------- */

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
                article => {

                    const papers =
                        Array.isArray(
                            article.gs_papers
                        )
                            ? article.gs_papers
                            : [];

                    return papers.includes(gs);
                }
            );
    }


    /*
     * Save the final UI dataset.
     *
     * PDF uses this exact dataset.
     */

    currentFilteredArticles =
        sortNewestFirst(filtered);


    renderArticles(
        currentFilteredArticles
    );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

    /*
     * Dashboard NEVER uses raw articles.
     */

    const relevant =
        getRelevantArticles();


    const total =
        relevant.length;


    const processed =
        relevant.filter(
            article =>
                Boolean(article.processed)
        ).length;


    const important =
        relevant.filter(
            article =>
                Number(
                    article.importance || 0
                ) >= 7
        ).length;


    /*
     * Hero and metric counts.
     */

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
        important
    );


    /*
     * Recent articles.
     */

    const recent =
        sortNewestFirst(relevant)
            .slice(0, 6);


    const recentContainer =
        document.getElementById(
            "recent-articles"
        );


    if (!recentContainer) {
        return;
    }


    recentContainer.innerHTML =
        recent
            .map(articleCard)
            .join("");


    /*
     * Build / refresh the right-side
     * quick revision panel.
     */

    renderQuickRevision(
        relevant
    );
}


/* =========================================================
   QUICK REVISION
   ========================================================= */

function renderQuickRevision(
    relevant
) {

    /*
     * Create the dashboard right column
     * if the HTML doesn't already contain one.
     */

    let grid =
        document.querySelector(
            "#dashboard-view .dashboard-content-grid"
        );


    const recentContainer =
        document.getElementById(
            "recent-articles"
        );


    if (!recentContainer) {
        return;
    }


    /*
     * The current HTML has recent-articles directly
     * below the section header.
     *
     * Wrap it in the dashboard two-column layout
     * dynamically so we don't need to touch the
     * data / navigation structure.
     */

    if (!grid) {

        grid =
            document.createElement("div");

        grid.className =
            "dashboard-content-grid";


        recentContainer.parentNode.insertBefore(
            grid,
            recentContainer
        );


        const recentWrapper =
            document.createElement("div");

        recentWrapper.className =
            "dashboard-main-articles";


        recentContainer.parentNode.insertBefore(
            recentWrapper,
            recentContainer
        );


        recentWrapper.appendChild(
            recentContainer
        );


        grid.appendChild(
            recentWrapper
        );


        const quick =
            document.createElement("aside");

        quick.className =
            "quick-revision";

        quick.id =
            "quick-revision-panel";

        grid.appendChild(
            quick
        );
    }


    const quick =
        document.getElementById(
            "quick-revision-panel"
        );


    if (!quick) {
        return;
    }


    const highPriority =
        sortNewestFirst(
            relevant
                .filter(
                    article =>
                        Number(
                            article.importance || 0
                        ) >= 7
                )
        )
        .slice(0, 5);


    quick.innerHTML =
        `
        <div class="section-label">
            Quick Revision
        </div>

        <h3>
            High Priority
        </h3>

        <div class="quick-revision-list">

            ${
                highPriority.length
                    ? highPriority
                        .map(
                            article => {

                                const score =
                                    Number(
                                        article.importance || 0
                                    );

                                return `
                                <div class="quick-revision-item">

                                    <div class="article-meta">

                                        <span class="badge high">
                                            ${score}/10
                                        </span>

                                    </div>

                                    <h4>
                                        ${escapeHtml(
                                            article.english_title ||
                                            article.title ||
                                            "Untitled article"
                                        )}
                                    </h4>

                                    <p>
                                        ${escapeHtml(
                                            article.english_summary ||
                                            getTopicText(article)
                                        )}
                                    </p>

                                </div>
                                `;
                            }
                        )
                        .join("")
                    : `
                        <div class="empty-state">
                            No high-priority articles yet.
                        </div>
                    `
            }

        </div>
        `;
}


/* =========================================================
   ARTICLE CARD
   ========================================================= */

function articleCard(article) {

    /*
     * Safety:
     * articleCard should never display irrelevant content.
     */

    if (!isRelevant(article)) {
        return "";
    }


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


    const dateText =
        formatDate(date);


    return `
        <article class="article-card">

            ${
                dateText
                    ? `
                        <div class="article-date">
                            ${dateText}
                        </div>
                    `
                    : ""
            }

            <div class="article-meta">

                <span class="badge ${priority}">
                    ${importance}/10
                </span>

                ${
                    getGsPapers(article)
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

                ${
                    hasPrelims(article)
                        ? `
                            <span class="badge">
                                Prelims
                            </span>
                        `
                        : ""
                }

            </div>


            <h4>
                ${escapeHtml(
                    article.english_title ||
                    article.title ||
                    "Untitled article"
                )}
            </h4>


            <p>
                ${escapeHtml(
                    getShortSummary(article)
                )}
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
     * Hard relevance safety check.
     */

    filtered =
        (filtered || [])
            .filter(
                article =>
                    isRelevant(article)
            );


    if (filtered.length === 0) {

        container.innerHTML =
            `
            <div class="empty-state">
                No relevant articles found for the selected filters.
            </div>
            `;

        return;
    }


    filtered =
        sortNewestFirst(filtered);


    /*
     * Group by month.
     */

    const groups =
        new Map();


    filtered.forEach(
        article => {

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
        }
    );


    const sortedGroups =
        Array.from(
            groups.entries()
        )
        .sort(
            (a, b) =>
                b[0].localeCompare(a[0])
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

                            ${monthArticles
                                .map(articleListItem)
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

    if (!isRelevant(article)) {
        return "";
    }


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

                    <span class="badge ${priority}">
                        ${importance}/10
                    </span>


                    ${
                        getGsPapers(article)
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


                    ${
                        hasPrelims(article)
                            ? `
                                <span class="badge">
                                    Prelims
                                </span>
                            `
                            : ""
                    }

                </div>


                <h4>
                    ${escapeHtml(
                        article.english_title ||
                        article.title ||
                        "Untitled article"
                    )}
                </h4>


                <p>
                    ${escapeHtml(
                        getShortSummary(article)
                    )}
                </p>

            </div>


            <button
                class="text-button"
                type="button"
                onclick="openArticle(${JSON.stringify(article.id)})"
            >
                Read analysis →
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


    /*
     * Never open irrelevant articles.
     */

    if (
        !article ||
        !isRelevant(article)
    ) {
        return;
    }


    const date =
        getDisplayDate(article);


    let html =
        `

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
                ${Number(article.importance || 0)}/10
            </span>


            ${
                getGsPapers(article)
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

            if (
                !Array.isArray(values) ||
                values.length === 0
            ) {
                return;
            }


            html +=
                `
                <div class="detail-section">

                    <h4>
                        ${escapeHtml(title)}
                    </h4>

                    <ul>

                        ${values
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

        detail.innerHTML =
            html;
    }


    if (modal) {

        modal.classList.remove(
            "hidden"
        );
    }
}


/* =========================================================
   FLASHCARDS
   ========================================================= */

function buildFlashcards() {

    flashcards = [];


    /*
     * ONLY RELEVANT ARTICLES.
     */

    getRelevantArticles()
        .forEach(
            article => {

                if (
                    !Array.isArray(
                        article.flashcards
                    )
                ) {
                    return;
                }


                article.flashcards
                    .forEach(
                        card => {

                            flashcards.push({

                                ...card,

                                article:
                                    article.english_title ||
                                    article.title

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


    if (!container) {
        return;
    }


    if (flashcards.length === 0) {

        container.innerHTML =
            `
            <div class="flashcard">

                <h3>
                    No flashcards yet
                </h3>

                <p class="answer">
                    Process relevant PIB articles
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


    if (!flashcards.length) {

        progress.textContent =
            "0 / 0";

        return;
    }


    progress.textContent =
        `${currentFlashcard + 1} / ${flashcards.length}`;
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
        getRelevantArticles()
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
                No high-priority relevant articles yet.
            </div>
            `;

        return;
    }


    container.innerHTML =
        important
            .map(articleListItem)
            .join("");
}


/* =========================================================
   GS
   ========================================================= */

function renderGS(gs) {

    const filtered =
        getRelevantArticles()
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
        <div class="month-heading">
            ${escapeHtml(gs)} CURRENT AFFAIRS
        </div>

        <div class="article-list">

            ${sortNewestFirst(filtered)
                .map(articleListItem)
                .join("")
            }

        </div>
        `;
}


/* =========================================================
   FILTER EVENTS
   ========================================================= */

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

            /*
             * This immediately updates:
             *
             * - month heading
             * - articles
             * - PDF dataset
             */

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
        element => {

            element.addEventListener(
                "change",
                applyAllFilters
            );

        }
    );


/* =========================================================
   NAVIGATION
   ========================================================= */

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

            button.addEventListener(
                "click",
                () =>
                    showView(
                        button.dataset.view
                    )
            );

        }
    );


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
                    button.dataset.view === view
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


    /*
     * When Current Affairs opens,
     * make sure it is rendered using
     * the latest filters.
     */

    if (view === "articles") {

        applyAllFilters();
    }
}


/* =========================================================
   GS CARD EVENTS
   ========================================================= */

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

                    showView("gs");

                    renderGS(gs);
                }
            );

        }
    );


/* =========================================================
   SEARCH
   ========================================================= */

const search =
    document.getElementById(
        "global-search"
    );


if (search) {

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
             * Search ONLY relevant articles.
             */

            const filtered =
                getRelevantArticles()
                    .filter(
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
                                (
                                    article.topics ||
                                    []
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


            showView("articles");


            currentFilteredArticles =
                sortNewestFirst(filtered);


            renderArticles(
                currentFilteredArticles
            );
        }
    );
}


/* =========================================================
   MODAL
   ========================================================= */

const closeModal =
    document.getElementById(
        "close-modal"
    );


if (closeModal) {

    closeModal.addEventListener(
        "click",
        () => {

            const modal =
                document.getElementById(
                    "article-modal"
                );


            if (modal) {

                modal.classList.add(
                    "hidden"
                );
            }

        }
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
                event.target.id ===
                "article-modal"
            ) {

                event.currentTarget
                    .classList.add(
                        "hidden"
                    );
            }

        }
    );
}


/* =========================================================
   REFRESH
   ========================================================= */

const refreshButton =
    document.getElementById(
        "refresh-btn"
    );


if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        loadArticles
    );
}


/* =========================================================
   PDF GENERATION
   ========================================================= */

const downloadPdfButton =
    document.getElementById(
        "download-pdf-btn"
    );


if (downloadPdfButton) {

    downloadPdfButton.addEventListener(
        "click",
        generatePDF
    );
}


/*
 * Main PDF function.
 *
 * IMPORTANT:
 * It uses currentFilteredArticles.
 *
 * Therefore:
 *
 * Month filter
 * Importance filter
 * GS filter
 * Search
 *
 * all determine what goes into the PDF.
 *
 * Irrelevant articles can NEVER enter the PDF.
 */

async function generatePDF() {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    /*
     * Make absolutely sure the dataset
     * contains only relevant articles.
     */

    const pdfArticles =
        (currentFilteredArticles || [])
            .filter(
                article =>
                    isRelevant(article)
            );


    if (!pdfArticles.length) {

        alert(
            "There are no relevant articles to export."
        );

        return;
    }


    /*
     * Check jsPDF.
     */

    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        alert(
            "PDF generator is still loading. Please wait a moment and try again."
        );

        return;
    }


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Generating PDF...";
    }


    try {

        const {
            jsPDF
        } = window.jspdf;


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
            15;

        const usableWidth =
            pageWidth -
            margin * 2;


        let y =
            margin;


        /*
         * PDF title.
         */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(20);

        doc.text(
            "PIB UPSC Current Affairs",
            margin,
            y
        );


        y += 8;


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(9);

        doc.setTextColor(
            105,
            110,
            118
        );


        let filterLabel =
            "All relevant articles";


        if (
            selectedMonth !== "ALL"
        ) {

            filterLabel =
                getMonthLabelFromKey(
                    selectedMonth
                );
        }


        doc.text(
            `${filterLabel} · ${pdfArticles.length} articles`,
            margin,
            y
        );


        y += 8;


        doc.setDrawColor(
            220,
            222,
            225
        );


        doc.line(
            margin,
            y,
            pageWidth - margin,
            y
        );


        y += 9;


        /*
         * Articles.
         */

        pdfArticles.forEach(
            (article, index) => {

                const title =
                    article.english_title ||
                    article.title ||
                    "Untitled article";


                const date =
                    formatDate(
                        getDisplayDate(article)
                    );


                const importance =
                    Number(
                        article.importance || 0
                    );


                const gs =
                    getGsPapers(article)
                        .join(", ");


                /*
                 * Estimate title height.
                 */

                const titleLines =
                    doc.splitTextToSize(
                        title,
                        usableWidth
                    );


                const estimatedHeight =
                    12 +
                    titleLines.length * 5;


                if (
                    y + estimatedHeight >
                    pageHeight - 20
                ) {

                    doc.addPage();

                    y = margin;
                }


                /*
                 * Article number.
                 */

                doc.setTextColor(
                    30,
                    33,
                    37
                );

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(13);

                doc.text(
                    `${index + 1}. ${title}`,
                    margin,
                    y,
                    {
                        maxWidth: usableWidth
                    }
                );


                y +=
                    titleLines.length * 5 +
                    5;


                /*
                 * Metadata.
                 */

                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(8);

                doc.setTextColor(
                    105,
                    110,
                    118
                );


                const metadata =
                    [
                        date,
                        `${importance}/10`,
                        gs
                    ]
                    .filter(Boolean)
                    .join(" · ");


                if (metadata) {

                    doc.text(
                        metadata,
                        margin,
                        y
                    );

                    y += 5;
                }


                /*
                 * Summary.
                 */

                const summary =
                    getShortSummary(
                        article
                    );


                if (summary) {

                    doc.setFont(
                        "helvetica",
                        "bold"
                    );

                    doc.setFontSize(9);

                    doc.setTextColor(
                        35,
                        38,
                        42
                    );

                    doc.text(
                        "Summary",
                        margin,
                        y
                    );

                    y += 4;


                    doc.setFont(
                        "helvetica",
                        "normal"
                    );

                    doc.setFontSize(8.5);

                    doc.setTextColor(
                        75,
                        80,
                        88
                    );


                    const summaryLines =
                        doc.splitTextToSize(
                            summary,
                            usableWidth
                        );


                    doc.text(
                        summaryLines,
                        margin,
                        y
                    );


                    y +=
                        summaryLines.length * 4 +
                        5;
                }


                /*
                 * UPSC information around the article.
                 */

                const pdfSections = [

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


                pdfSections.forEach(
                    ([sectionTitle, values]) => {

                        if (
                            !Array.isArray(values) ||
                            values.length === 0
                        ) {
                            return;
                        }


                        /*
                         * Keep PDF readable.
                         * Maximum 6 points per section.
                         */

                        const usableValues =
                            values.slice(0, 6);


                        if (
                            y + 12 >
                            pageHeight - 20
                        ) {

                            doc.addPage();

                            y = margin;
                        }


                        doc.setFont(
                            "helvetica",
                            "bold"
                        );

                        doc.setFontSize(8.5);

                        doc.setTextColor(
                            35,
                            38,
                            42
                        );


                        doc.text(
                            sectionTitle,
                            margin,
                            y
                        );


                        y += 4;


                        doc.setFont(
                            "helvetica",
                            "normal"
                        );

                        doc.setFontSize(8);

                        doc.setTextColor(
                            75,
                            80,
                            88
                        );


                        usableValues.forEach(
                            value => {

                                const text =
                                    `• ${String(value)}`;


                                const lines =
                                    doc.splitTextToSize(
                                        text,
                                        usableWidth - 2
                                    );


                                if (
                                    y +
                                    lines.length * 3.8 +
                                    3 >
                                    pageHeight - 18
                                ) {

                                    doc.addPage();

                                    y = margin;
                                }


                                doc.text(
                                    lines,
                                    margin + 1,
                                    y
                                );


                                y +=
                                    lines.length * 3.8 +
                                    2;
                            }
                        );


                        y += 2;
                    }
                );


                /*
                 * Original PIB link.
                 */

                if (article.link) {

                    if (
                        y + 10 >
                        pageHeight - 18
                    ) {

                        doc.addPage();

                        y = margin;
                    }


                    doc.setFont(
                        "helvetica",
                        "normal"
                    );

                    doc.setFontSize(7.5);

                    doc.setTextColor(
                        75,
                        105,
                        160
                    );


                    doc.text(
                        "Original PIB release available on the website",
                        margin,
                        y
                    );


                    y += 5;
                }


                /*
                 * Separator.
                 */

                doc.setDrawColor(
                    225,
                    227,
                    230
                );


                if (
                    y + 5 >
                    pageHeight - 15
                ) {

                    doc.addPage();

                    y = margin;

                } else {

                    doc.line(
                        margin,
                        y,
                        pageWidth - margin,
                        y
                    );

                    y += 7;
                }

            }
        );


        /*
         * Footer on every page.
         */

        const totalPages =
            doc.internal.getNumberOfPages();


        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {

            doc.setPage(page);

            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(7);

            doc.setTextColor(
                145,
                149,
                155
            );


            doc.text(
                "PIB UPSC · AI-assisted current affairs",
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


        /*
         * Filename.
         */

        const filename =
            selectedMonth === "ALL"
                ? "PIB_UPSC_Current_Affairs.pdf"
                : `PIB_UPSC_${selectedMonth}.pdf`;


        doc.save(filename);

    } catch (error) {

        console.error(
            "PDF generation error:",
            error
        );

        alert(
            "Unable to generate the PDF. Please check the browser console for details."
        );

    } finally {

        if (button) {

            button.disabled =
                false;

            button.innerHTML =
                "Download PDF";
        }
    }
}


/* =========================================================
   PDF HELPER
   ========================================================= */

function getShortSummary(article) {

    if (
        article.english_summary &&
        String(
            article.english_summary
        ).trim()
    ) {

        return String(
            article.english_summary
        ).trim();
    }


    if (
        article.summary &&
        String(
            article.summary
        ).trim()
    ) {

        return String(
            article.summary
        ).trim();
    }


    if (
        Array.isArray(
            article.topics
        ) &&
        article.topics.length
    ) {

        return article.topics
            .slice(0, 4)
            .join(" · ");
    }


    return "";
}


function getTopicText(article) {

    if (
        Array.isArray(
            article.topics
        )
    ) {

        return article.topics
            .slice(0, 4)
            .join(" · ");
    }

    return "";
}


function getGsPapers(article) {

    if (
        !Array.isArray(
            article.gs_papers
        )
    ) {

        return [];
    }


    return article.gs_papers;
}


function hasPrelims(article) {

    const papers =
        getGsPapers(article);


    return papers.includes(
        "Prelims"
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


function showLoadError(
    message
) {

    const container =
        document.getElementById(
            "articles-list"
        );


    if (container) {

        container.innerHTML =
            `
            <div class="empty-state">
                ${escapeHtml(message)}
            </div>
            `;
    }
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =========================================================
   INITIALISE
   ========================================================= */

loadArticles();
