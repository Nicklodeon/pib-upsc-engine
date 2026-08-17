/* =========================================================
   PIB UPSC — APP.JS
   Relevant articles + month slicer + PDF download
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

let selectedMonth = "ALL";

let lastFetchTime = null;

let isLoading = false;


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
        getArticleDate(article);

    if (!date) {
        return "UNKNOWN";
    }

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}`;
}


function getMonthLabel(key) {

    if (!key || key === "UNKNOWN") {
        return "CURRENT AFFAIRS";
    }

    const [year, month] =
        key.split("-");

    const date =
        new Date(
            Number(year),
            Number(month) - 1,
            1
        );

    return date.toLocaleDateString(
        "en-IN",
        {
            month: "long",
            year: "numeric"
        }
    ).toUpperCase();
}


/* =========================================================
   SORTING
   ========================================================= */

function sortNewestFirst(list) {

    return [...list].sort(
        (a, b) => {

            const dateA =
                getArticleDate(a);

            const dateB =
                getArticleDate(b);

            return (
                (dateB?.getTime() || 0) -
                (dateA?.getTime() || 0)
            );
        }
    );
}


/* =========================================================
   UTILITIES
   ========================================================= */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
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
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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

    button.style.opacity =
        loading ? "0.55" : "";

    button.style.cursor =
        loading ? "wait" : "";

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
        `Updated ${lastFetchTime.toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )}`;
}


/* =========================================================
   LOAD ARTICLES
   =========================================================

   IMPORTANT:
   Only relevant=true is filtered here.

   Importance is NOT used as a global filter.

   Therefore if the database contains:

       70 total
       44 relevant
       34 high priority

   the application displays all 44 relevant articles.
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
            .eq(
                "relevant",
                true
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
                    article =>
                        article.relevant === true
                )
                : [];


        articles =
            sortNewestFirst(
                articles
            );


        lastFetchTime =
            new Date();


        console.log(
            `Loaded ${articles.length} relevant articles`
        );


        buildMonthSlicer();

        renderDashboard();

        applyAllFilters();

        renderRevision();

        updateLastUpdated();

    } catch (error) {

        console.error(
            "Article loading failed:",
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

            monthMap.set(
                key,
                getMonthLabel(key)
            );
        }
    );


    const months =
        Array.from(
            monthMap.entries()
        )
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

        ${
            months
                .map(
                    (
                        [key, label]
                    ) => `
                        <option value="${escapeHtml(key)}">
                            ${escapeHtml(label)}
                        </option>
                    `
                )
                .join("")
        }

    `;


    if (
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
   FILTERS
   ========================================================= */

function applyAllFilters() {

    let filtered =
        [...articles];


    /* MONTH */

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


    /* IMPORTANCE */

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


    /* GS */

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
                    (
                        article.gs_papers ||
                        []
                    ).includes(gs)
            );
    }


    /* RELEVANCE */

    const relevanceFilter =
        document.getElementById(
            "relevance-filter"
        );


    const relevance =
        relevanceFilter
            ? relevanceFilter.value
            : "";


    if (relevance === "false") {

        filtered = [];

    } else if (relevance === "true") {

        filtered =
            filtered.filter(
                article =>
                    article.relevant === true
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
                article.processed
        ).length;


    const relevant =
        articles.length;


    const important =
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
        relevant
    );

    setText(
        "important-count",
        important
    );


    const recent =
        articles.slice(
            0,
            6
        );


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
        getArticleDate(
            article
        );


    return `

        <article class="article-card">

            <div class="article-date">
                ${escapeHtml(
                    formatDate(date)
                )}
            </div>


            <div class="article-meta">

                <span class="badge ${priority}">
                    ${importance}/10
                </span>


                ${
                    (
                        article.gs_papers ||
                        []
                    )
                        .slice(
                            0,
                            2
                        )
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
                    (
                        article.topics ||
                        []
                    )
                        .slice(
                            0,
                            2
                        )
                        .join(" · ")
                )}
            </p>


            <button
                type="button"
                onclick="openArticle('${String(
                    article.id
                ).replaceAll(
                    "'",
                    "\\'"
                )}')"
            >
                Read analysis →
            </button>

        </article>

    `;
}


/* =========================================================
   ARTICLE LIST
   ========================================================= */

function renderArticles(
    filtered
) {

    const container =
        document.getElementById(
            "articles-list"
        );


    if (!container) {
        return;
    }


    /*
     * Final safety check.
     */

    filtered =
        (filtered || [])
            .filter(
                article =>
                    article.relevant === true
            );


    if (
        filtered.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                No relevant articles found
                for the selected filters.

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
        Array.from(
            groups.entries()
        )
        .sort(
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

                    <section class="month-section">

                        <div class="month-heading">

                            ${escapeHtml(
                                getMonthLabel(key)
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
}


/* =========================================================
   ARTICLE LIST ITEM
   ========================================================= */

function articleListItem(article) {

    if (
        article.relevant !== true
    ) {
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
        getArticleDate(
            article
        );


    return `

        <article class="list-item">

            <div>

                <div class="article-date">

                    ${escapeHtml(
                        formatDate(date)
                    )}

                </div>


                <div class="article-meta">

                    <span class="badge ${priority}">
                        ${importance}/10
                    </span>


                    ${
                        (
                            article.gs_papers ||
                            []
                        )
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


                <h4>
                    ${escapeHtml(
                        article.english_title ||
                        article.title ||
                        "Untitled article"
                    )}
                </h4>


                <p>
                    ${escapeHtml(
                        (
                            article.topics ||
                            []
                        ).join(
                            " · "
                        )
                    )}
                </p>

            </div>


            <button
                type="button"
                class="text-button"
                onclick="openArticle('${String(
                    article.id
                ).replaceAll(
                    "'",
                    "\\'"
                )}')"
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
                String(
                    item.id
                ) ===
                String(id)
        );


    if (
        !article ||
        article.relevant !== true
    ) {
        return;
    }


    const date =
        getArticleDate(
            article
        );


    let html = `

        <div class="article-date">
            ${escapeHtml(
                formatDate(date)
            )}
        </div>


        <div class="article-meta">

            <span class="badge high">
                Importance
                ${article.importance || 0}/10
            </span>


            ${
                (
                    article.gs_papers ||
                    []
                )
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
        (
            [
                title,
                values
            ]
        ) => {

            if (
                !Array.isArray(values) ||
                values.length === 0
            ) {
                return;
            }


            html += `

                <div class="detail-section">

                    <h4>
                        ${escapeHtml(title)}
                    </h4>


                    <ul>

                        ${
                            values
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
   REVISION
   ========================================================= */

function renderRevision() {

    const important =
        articles
            .filter(
                article =>
                    article.relevant === true &&
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


    const container =
        document.getElementById(
            "revision-list"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        important
            .map(
                articleListItem
            )
            .join("");
}


/* =========================================================
   GS
   ========================================================= */

function renderGS(
    gs
) {

    const filtered =
        articles.filter(
            article =>
                article.relevant === true &&
                (
                    article.gs_papers ||
                    []
                ).includes(gs)
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

            ${
                sortNewestFirst(
                    filtered
                )
                    .map(
                        articleListItem
                    )
                    .join("")
            }

        </div>

    `;
}


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

                        if (
                            article.relevant !== true
                        ) {
                            return false;
                        }


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
   NAVIGATION
   ========================================================= */

function showView(
    view
) {

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
}


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

            applyAllFilters();

        }
    );
}


[
    "importance-filter",
    "gs-filter",
    "relevance-filter"
]
.forEach(
    id => {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.addEventListener(
                "change",
                applyAllFilters
            );

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
   MODAL CLOSE
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
   PDF — GET ARTICLES
   ========================================================= */

function getArticlesForPDF() {

    let result =
        articles.filter(
            article =>
                article.relevant === true &&
                Number(article.importance || 0) >= 7
        );


    /*
     * Respect selected month.
     */

    if (
        selectedMonth !== "ALL"
    ) {

        result =
            result.filter(
                article =>
                    getMonthKey(article) ===
                    selectedMonth
            );
    }


    /*
     * Respect selected GS filter.
     */

    const gsFilter =
        document.getElementById(
            "gs-filter"
        );


    if (
        gsFilter &&
        gsFilter.value
    ) {

        result =
            result.filter(
                article =>
                    (
                        article.gs_papers ||
                        []
                    ).includes(
                        gsFilter.value
                    )
            );
    }


    /*
     * Respect importance filter.
     */

    const importanceFilter =
        document.getElementById(
            "importance-filter"
        );


    if (
        importanceFilter &&
        importanceFilter.value
    ) {

        const min =
            Number(
                importanceFilter.value
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


        result =
            result.filter(
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


    return sortNewestFirst(
        result
    );
}


/* =========================================================
   PDF — ARTICLE HTML
   ========================================================= */

function createPDFArticle(
    article
) {

    const date =
        getArticleDate(
            article
        );


    const title =
        article.english_title ||
        article.title ||
        "Untitled Article";


    const summary =
        article.english_summary ||
        article.summary ||
        "";


    const importance =
        Number(
            article.importance || 0
        );


    const gsPapers =
        Array.isArray(
            article.gs_papers
        )
            ? article.gs_papers
            : [];


    let html = `

        <article class="pdf-article">

            <div class="pdf-date">
                ${escapeHtml(
                    formatDate(date)
                )}
            </div>


            <h2 class="pdf-title">
                ${escapeHtml(title)}
            </h2>


            <div class="pdf-meta">

                Importance:
                <strong>
                    ${importance}/10
                </strong>

                ${
                    gsPapers.length
                        ? `
                            &nbsp; • &nbsp;
                            ${escapeHtml(
                                gsPapers.join(", ")
                            )}
                        `
                        : ""
                }

            </div>


            ${
                summary
                    ? `
                        <div class="pdf-section">

                            <h3>
                                Summary
                            </h3>

                            <p>
                                ${escapeHtml(summary)}
                            </p>

                        </div>
                    `
                    : ""
            }

    `;


    if (
        Array.isArray(
            article.prelims_facts
        ) &&
        article.prelims_facts.length
    ) {

        html += `

            <div class="pdf-section">

                <h3>
                    Prelims Facts
                </h3>

                <ul>

                    ${
                        article.prelims_facts
                            .map(
                                item =>
                                    `
                                    <li>
                                        ${escapeHtml(
                                            item
                                        )}
                                    </li>
                                    `
                            )
                            .join("")
                    }

                </ul>

            </div>

        `;
    }


    if (
        Array.isArray(
            article.mains_notes
        ) &&
        article.mains_notes.length
    ) {

        html += `

            <div class="pdf-section">

                <h3>
                    Mains Notes
                </h3>

                <ul>

                    ${
                        article.mains_notes
                            .map(
                                item =>
                                    `
                                    <li>
                                        ${escapeHtml(
                                            item
                                        )}
                                    </li>
                                    `
                            )
                            .join("")
                    }

                </ul>

            </div>

        `;
    }


    if (
        Array.isArray(
            article.data_points
        ) &&
        article.data_points.length
    ) {

        html += `

            <div class="pdf-section">

                <h3>
                    Important Data
                </h3>

                <ul>

                    ${
                        article.data_points
                            .map(
                                item =>
                                    `
                                    <li>
                                        ${escapeHtml(
                                            item
                                        )}
                                    </li>
                                    `
                            )
                            .join("")
                    }

                </ul>

            </div>

        `;
    }


    if (
        Array.isArray(
            article.schemes
        ) &&
        article.schemes.length
    ) {

        html += `

            <div class="pdf-section">

                <h3>
                    Schemes / Programmes
                </h3>

                <ul>

                    ${
                        article.schemes
                            .map(
                                item =>
                                    `
                                    <li>
                                        ${escapeHtml(
                                            item
                                        )}
                                    </li>
                                    `
                            )
                            .join("")
                    }

                </ul>

            </div>

        `;
    }


    if (
        Array.isArray(
            article.institutions
        ) &&
        article.institutions.length
    ) {

        html += `

            <div class="pdf-section">

                <h3>
                    Institutions
                </h3>

                <ul>

                    ${
                        article.institutions
                            .map(
                                item =>
                                    `
                                    <li>
                                        ${escapeHtml(
                                            item
                                        )}
                                    </li>
                                    `
                            )
                            .join("")
                    }

                </ul>

            </div>

        `;
    }


    if (
        Array.isArray(
            article.implications
        ) &&
        article.implications.length
    ) {

        html += `

            <div class="pdf-section">

                <h3>
                    Implications
                </h3>

                <ul>

                    ${
                        article.implications
                            .map(
                                item =>
                                    `
                                    <li>
                                        ${escapeHtml(
                                            item
                                        )}
                                    </li>
                                    `
                            )
                            .join("")
                    }

                </ul>

            </div>

        `;
    }


    html += `

        </article>

    `;


    return html;
}


/* =========================================================
   PDF — GENERATE
   ========================================================= */

function downloadPDF() {

    const pdfArticles =
        getArticlesForPDF();


    if (
        pdfArticles.length === 0
    ) {

        alert(
            "No relevant articles are available for the selected filters."
        );

        return;
    }


    /*
     * Open immediately from button click.
     * This avoids popup blocking.
     */

    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "Please allow pop-ups for this website and try again."
        );

        return;
    }


    const monthGroups =
        new Map();


    pdfArticles.forEach(
        article => {

            const month =
                getMonthKey(
                    article
                );


            if (
                !monthGroups.has(month)
            ) {

                monthGroups.set(
                    month,
                    []
                );
            }


            monthGroups
                .get(month)
                .push(
                    article
                );

        }
    );


    let articlesHTML = "";


    Array.from(
        monthGroups.entries()
    )
        .sort(
            (a, b) =>
                b[0].localeCompare(
                    a[0]
                )
        )
        .forEach(
            (
                [
                    month,
                    monthArticles
                ]
            ) => {

                articlesHTML += `

                    <div
                        class="month-heading"
                    >

                        ${escapeHtml(
                            getMonthLabel(month)
                        )}

                    </div>

                `;


                monthArticles.forEach(
                    article => {

                        articlesHTML +=
                            createPDFArticle(
                                article
                            );

                    }
                );

            }
        );


    const monthLabel =
        selectedMonth === "ALL"
            ? "All Months"
            : getMonthLabel(
                selectedMonth
            );


    const documentHTML = `

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">


            <title>
                PIB UPSC Current Affairs
            </title>


            <style>

                @page {

                    size: A4;

                    margin:
                        16mm 15mm 16mm 15mm;

                }


                * {

                    box-sizing:
                        border-box;

                }


                html,
                body {

                    margin:
                        0;

                    padding:
                        0;

                }


                body {

                    font-family:

                        "Noto Sans Devanagari",

                        "Noto Sans",

                        Arial,

                        sans-serif;

                    color:
                        #202124;

                    background:
                        #ffffff;

                    font-size:
                        11pt;

                    line-height:
                        1.55;

                }


                .header {

                    border-bottom:
                        2px solid #202124;

                    padding-bottom:
                        12px;

                    margin-bottom:
                        20px;

                }


                .brand {

                    font-size:
                        10pt;

                    font-weight:
                        700;

                    letter-spacing:
                        2px;

                    color:
                        #666;

                    text-transform:
                        uppercase;

                }


                .main-title {

                    font-size:
                        25pt;

                    font-weight:
                        800;

                    margin:
                        5px 0;

                }


                .subtitle {

                    font-size:
                        10pt;

                    color:
                        #666;

                }


                .month-heading {

                    font-size:
                        15pt;

                    font-weight:
                        800;

                    letter-spacing:
                        1.5px;

                    margin:
                        25px 0 14px;

                    padding-bottom:
                        7px;

                    border-bottom:
                        1px solid #d9d9d9;

                    page-break-after:
                        avoid;

                }


                .pdf-article {

                    page-break-inside:
                        avoid;

                    margin-bottom:
                        24px;

                    padding-bottom:
                        20px;

                    border-bottom:
                        1px solid #e3e3e3;

                }


                .pdf-date {

                    color:
                        #777;

                    font-size:
                        9pt;

                    margin-bottom:
                        5px;

                }


                .pdf-title {

                    font-size:
                        15pt;

                    line-height:
                        1.35;

                    margin:
                        0 0 7px;

                    font-weight:
                        800;

                }


                .pdf-meta {

                    font-size:
                        9pt;

                    color:
                        #666;

                    margin-bottom:
                        12px;

                }


                .pdf-section {

                    margin-top:
                        13px;

                }


                .pdf-section h3 {

                    font-size:
                        11pt;

                    margin:
                        0 0 5px;

                    font-weight:
                        800;

                }


                .pdf-section p {

                    margin:
                        0;

                }


                .pdf-section ul {

                    margin:
                        4px 0 0;

                    padding-left:
                        20px;

                }


                .pdf-section li {

                    margin-bottom:
                        4px;

                }


                .footer {

                    margin-top:
                        30px;

                    padding-top:
                        10px;

                    border-top:
                        1px solid #ddd;

                    font-size:
                        8.5pt;

                    color:
                        #777;

                }


                @media print {

                    body {

                        -webkit-print-color-adjust:
                            exact;

                        print-color-adjust:
                            exact;

                    }

                }

            </style>

        </head>


        <body>


            <header class="header">

                <div class="brand">
                    PIB UPSC
                </div>


                <div class="main-title">
                    Current Affairs
                </div>


                <div class="subtitle">

                    Relevant Articles ·
                    ${escapeHtml(
                        monthLabel
                    )}
                    ·
                    ${pdfArticles.length}
                    Articles

                </div>

            </header>


            ${articlesHTML}


            <div class="footer">

                PIB UPSC Current Affairs Engine

                <br>

                Generated on
                ${escapeHtml(
                    formatDate(
                        new Date()
                    )
                )}

            </div>


        </body>

        </html>

    `;


    printWindow.document.open();

    printWindow.document.write(
        documentHTML
    );

    printWindow.document.close();


    /*
     * Wait for the new document to render.
     */

    setTimeout(
        function() {

            printWindow.focus();

            printWindow.print();

        },
        800
    );
}


/* =========================================================
   PDF BUTTON
   ========================================================= */

function setupPDFButton() {

    const ids = [

        "download-pdf",

        "download-pdf-btn",

        "pdf-download"

    ];


    let button = null;


    for (
        const id of ids
    ) {

        const candidate =
            document.getElementById(
                id
            );


        if (candidate) {

            button =
                candidate;

            break;

        }

    }


    if (!button) {

        console.warn(
            "Download PDF button not found."
        );

        return;
    }


    /*
     * Make sure it is not disabled.
     */

    button.disabled =
        false;


    button.removeAttribute(
        "disabled"
    );


    button.style.pointerEvents =
        "auto";


    button.style.cursor =
        "pointer";


    /*
     * Prevent duplicate event listeners.
     */

    if (
        button.dataset.pdfBound ===
        "true"
    ) {

        return;
    }


    button.dataset.pdfBound =
        "true";


    button.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            downloadPDF();

        }
    );
}


/* =========================================================
   INITIALISE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        setupPDFButton();

    }
);


/*
 * Also run immediately because app.js is normally
 * loaded at the bottom of index.html.
 */

setupPDFButton();


/*
 * Load articles.
 */

loadArticles();
