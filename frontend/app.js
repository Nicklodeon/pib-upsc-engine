/* =========================================================
   PIB UPSC — APP.JS
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
        `${String(
            date.getMonth() + 1
        ).padStart(2, "0")}`
    );
}


function getMonthLabelFromKey(key) {

    if (
        !key ||
        key === "UNKNOWN"
    ) {
        return "RECENT ARTICLES";
    }

    const [
        year,
        month
    ] = key.split("-");

    const date =
        new Date(
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
   SORTING
   ========================================================= */

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
        } =
            await db
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

        buildMonthSlicers();

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
   MONTH SLICERS
   ========================================================= */

function buildMonthSlicers() {

    const monthFilter =
        document.getElementById(
            "month-filter"
        );

    const dashboardMonthFilter =
        document.getElementById(
            "dashboard-month-filter"
        );


    const monthMap =
        new Map();


    articles.forEach(
        article => {

            const key =
                getMonthKey(
                    article
                );

            if (
                key === "UNKNOWN"
            ) {
                return;
            }

            if (
                !monthMap.has(key)
            ) {

                monthMap.set(
                    key,
                    getMonthLabelFromKey(
                        key
                    )
                );

            }

        }
    );


    const months =
        Array.from(
            monthMap.entries()
        ).sort(
            (a, b) =>
                b[0].localeCompare(
                    a[0]
                )
        );


    const options = `

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
            .join("")
        }

    `;


    if (monthFilter) {

        monthFilter.innerHTML =
            options;

        monthFilter.value =
            selectedMonth;

    }


    if (dashboardMonthFilter) {

        dashboardMonthFilter.innerHTML =
            options;

        dashboardMonthFilter.value =
            selectedMonth;

    }


    /*
     * If the previously selected month no longer
     * exists, safely fall back to ALL.
     */

    const validMonth =
        selectedMonth === "ALL" ||
        months.some(
            ([key]) =>
                key === selectedMonth
        );


    if (!validMonth) {

        selectedMonth =
            "ALL";

        if (monthFilter) {
            monthFilter.value =
                "ALL";
        }

        if (dashboardMonthFilter) {
            dashboardMonthFilter.value =
                "ALL";
        }
    }
}


/* =========================================================
   SET MONTH
   ========================================================= */

function setSelectedMonth(month) {

    selectedMonth =
        month || "ALL";


    const monthFilter =
        document.getElementById(
            "month-filter"
        );

    const dashboardMonthFilter =
        document.getElementById(
            "dashboard-month-filter"
        );


    if (monthFilter) {

        monthFilter.value =
            selectedMonth;

    }


    if (dashboardMonthFilter) {

        dashboardMonthFilter.value =
            selectedMonth;

    }


    /*
     * Re-render both places immediately.
     */

    renderDashboardArticles();

    applyAllFilters();
}


/* =========================================================
   APPLY CURRENT AFFAIRS FILTERS
   ========================================================= */

function applyAllFilters() {

    let filtered =
        [...articles];


    /*
     * MONTH
     */

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


    /*
     * IMPORTANCE
     */

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
            Number(
                importance
            );

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
                            article.importance ||
                            0
                        );

                    return (
                        score >= min &&
                        score <= max
                    );
                }
            );
    }


    /*
     * GS PAPER
     */

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
                    Array.isArray(
                        article.gs_papers
                    ) &&
                    article.gs_papers.includes(
                        gs
                    )
            );
    }


    /*
     * RELEVANCE
     */

    const relevanceFilter =
        document.getElementById(
            "relevance-filter"
        );

    const relevance =
        relevanceFilter
            ? relevanceFilter.value
            : "";


    if (relevance) {

        filtered =
            filtered.filter(
                article =>
                    String(
                        Boolean(
                            article.relevant
                        )
                    ) ===
                    relevance
            );
    }


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
                Boolean(
                    article.processed
                )
        ).length;


    const relevant =
        articles.filter(
            article =>
                Boolean(
                    article.relevant
                )
        ).length;


    const important =
        articles.filter(
            article =>
                Number(
                    article.importance ||
                    0
                ) >= 7
        ).length;


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


    renderDashboardArticles();
}


/* =========================================================
   DASHBOARD ARTICLES
   ========================================================= */

function renderDashboardArticles() {

    const container =
        document.getElementById(
            "recent-articles"
        );

    if (!container) {
        return;
    }


    /*
     * FILTER BY SELECTED MONTH
     */

    let filtered =
        [...articles];


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


    filtered =
        sortNewestFirst(
            filtered
        );


    /*
     * UPDATE THE HEADING DIRECTLY
     * FROM THE SELECTED MONTH.
     */

    const heading =
        document.getElementById(
            "dashboard-month-heading"
        );


    if (heading) {

        if (
            selectedMonth === "ALL"
        ) {

            heading.textContent =
                "LATEST ARTICLES";

        } else {

            heading.textContent =
                getMonthLabelFromKey(
                    selectedMonth
                );

        }

    }


    /*
     * SHOW ONLY SIX ON DASHBOARD
     */

    const recent =
        filtered.slice(
            0,
            6
        );


    if (
        recent.length === 0
    ) {

        container.innerHTML = `

            <div
                class="empty-state"
            >
                No articles found for
                ${
                    selectedMonth === "ALL"
                        ? "the selected filters"
                        : escapeHtml(
                            getMonthLabelFromKey(
                                selectedMonth
                            )
                        )
                }.
            </div>

        `;

        return;
    }


    container.innerHTML =
        recent
            .map(
                articleCard
            )
            .join("");
}


/* =========================================================
   ARTICLE CARD
   ========================================================= */

function articleCard(article) {

    const importance =
        Number(
            article.importance ||
            0
        );


    const priority =
        importance >= 9
            ? "high"
            : importance >= 7
                ? "medium"
                : "low";


    const date =
        getDisplayDate(
            article
        );


    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    const summary =
        article.english_summary ||
        (
            Array.isArray(
                article.topics
            )
                ? article.topics
                    .slice(0, 2)
                    .join(" · ")
                : ""
        );


    const gsPapers =
        Array.isArray(
            article.gs_papers
        )
            ? article.gs_papers
            : [];


    return `

        <article
            class="article-card"
        >

            ${
                date
                    ? `

                        <div
                            class="article-date"
                        >
                            ${escapeHtml(
                                formatDate(date)
                            )}
                        </div>

                    `
                    : ""
            }


            <div
                class="article-meta"
            >

                <span
                    class="badge ${priority}"
                >
                    ${importance}/10
                </span>


                ${gsPapers
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
                type="button"
                onclick="openArticle(${JSON.stringify(article.id)})"
            >
                Read analysis →
            </button>

        </article>

    `;
}


/* =========================================================
   CURRENT AFFAIRS
   ========================================================= */

function renderArticles(filtered) {

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

            <div
                class="empty-state"
            >
                No articles found for
                the selected filters.
            </div>

        `;

        return;
    }


    filtered =
        sortNewestFirst(
            filtered
        );


    const groups =
        new Map();


    filtered.forEach(
        article => {

            const key =
                getMonthKey(
                    article
                );


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
                .push(
                    article
                );

        }
    );


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
                (
                    [
                        key,
                        monthArticles
                    ]
                ) => `

                    <section
                        class="month-section"
                    >

                        <div
                            class="month-heading"
                        >
                            ${escapeHtml(
                                getMonthLabelFromKey(
                                    key
                                )
                            )}
                        </div>


                        <div
                            class="article-list"
                        >

                            ${monthArticles
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
            article.importance ||
            0
        );


    const priority =
        importance >= 9
            ? "high"
            : importance >= 7
                ? "medium"
                : "low";


    const date =
        getDisplayDate(
            article
        );


    const gsPapers =
        Array.isArray(
            article.gs_papers
        )
            ? article.gs_papers
            : [];


    const topics =
        Array.isArray(
            article.topics
        )
            ? article.topics
            : [];


    return `

        <article
            class="list-item"
        >

            <div>

                ${
                    date
                        ? `

                            <div
                                class="article-date"
                            >
                                ${escapeHtml(
                                    formatDate(date)
                                )}
                            </div>

                        `
                        : ""
                }


                <div
                    class="article-meta"
                >

                    <span
                        class="badge ${priority}"
                    >
                        ${importance}/10
                    </span>


                    ${gsPapers
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
                    ${escapeHtml(
                        article.english_title ||
                        article.title ||
                        "Untitled article"
                    )}
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
                        ${escapeHtml(
                            formatDate(date)
                        )}
                    </div>
                `
                : ""
        }


        <div class="article-meta">

            <span class="badge high">
                Importance
                ${Number(
                    article.importance || 0
                )}/10
            </span>


            ${
                (
                    Array.isArray(
                        article.gs_papers
                    )
                        ? article.gs_papers
                        : []
                )
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


            html += `

                <div
                    class="detail-section"
                >

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

        html += `

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

        modal.classList.remove(
            "hidden"
        );

        document.body.style.overflow =
            "hidden";
    }
}


/* =========================================================
   FLASHCARDS
   ========================================================= */

function buildFlashcards() {

    flashcards = [];


    articles.forEach(
        article => {

            if (
                !Array.isArray(
                    article.flashcards
                )
            ) {
                return;
            }


            article.flashcards.forEach(
                card => {

                    flashcards.push({

                        ...card,

                        article:
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


    if (
        flashcards.length === 0
    ) {

        container.innerHTML = `

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
                    card.question || ""
                )}
            </h3>


            <div
                id="flash-answer"
                class="answer"
                style="display:none"
            >
                ${escapeHtml(
                    card.answer || ""
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


    const progress =
        document.getElementById(
            "flashcard-progress"
        );


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
        articles
            .filter(
                article =>
                    Boolean(
                        article.relevant
                    ) &&
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


    container.innerHTML =
        important.length
            ? important
                .map(
                    articleListItem
                )
                .join("")
            : `

                <div class="empty-state">
                    No high-priority articles
                    available for revision.
                </div>

            `;
}


/* =========================================================
   GS
   ========================================================= */

function renderGS(gs) {

    const filtered =
        articles.filter(
            article =>
                Array.isArray(
                    article.gs_papers
                ) &&
                article.gs_papers.includes(gs)
        );


    const container =
        document.getElementById(
            "gs-articles"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `

        <h3>
            ${escapeHtml(gs)}
            Current Affairs
        </h3>


        <div class="article-list">

            ${sortNewestFirst(filtered)
                .map(articleListItem)
                .join("")
            }

        </div>

    `;
}


/* =========================================================
   MONTH FILTER EVENTS
   ========================================================= */

const monthFilter =
    document.getElementById(
        "month-filter"
    );


if (monthFilter) {

    monthFilter.addEventListener(
        "change",
        event => {

            setSelectedMonth(
                event.target.value
            );

        }
    );
}


/* =========================================================
   DASHBOARD MONTH FILTER
   ========================================================= */

const dashboardMonthFilter =
    document.getElementById(
        "dashboard-month-filter"
    );


if (dashboardMonthFilter) {

    dashboardMonthFilter.addEventListener(
        "change",
        event => {

            setSelectedMonth(
                event.target.value
            );

        }
    );
}


/* =========================================================
   OTHER FILTERS
   ========================================================= */

const importanceFilter =
    document.getElementById(
        "importance-filter"
    );

const gsFilter =
    document.getElementById(
        "gs-filter"
    );

const relevanceFilter =
    document.getElementById(
        "relevance-filter"
    );


[
    importanceFilter,
    gsFilter,
    relevanceFilter
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
    .querySelectorAll(".nav-item")
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


function showView(view) {

    document
        .querySelectorAll(".view")
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
        .querySelectorAll(".nav-item")
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
}


/* =========================================================
   GS EVENTS
   ========================================================= */

document
    .querySelectorAll(".gs-card")
    .forEach(
        card => {

            card.addEventListener(
                "click",
                () => {

                    showView("gs");

                    renderGS(
                        card.dataset.gs
                    );

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


            const filtered =
                articles.filter(
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
                                Array.isArray(
                                    article.topics
                                )
                                    ? article.topics
                                    : []
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

            renderArticles(
                filtered
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


function closeArticleModal() {

    const modal =
        document.getElementById(
            "article-modal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

        document.body.style.overflow =
            "";
    }
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

    const containers = [

        document.getElementById(
            "articles-list"
        ),

        document.getElementById(
            "recent-articles"
        )

    ];


    containers
        .filter(Boolean)
        .forEach(
            container => {

                container.innerHTML = `

                    <div class="empty-state">
                        ${escapeHtml(message)}
                    </div>

                `;

            }
        );
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
