/* =========================================================
   PIB UPSC — APP.JS
   Live Supabase + relevant articles only
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
   STATE
   ========================================================= */

let articles = [];

let flashcards = [];

let currentFlashcard = 0;

let selectedMonth = "ALL";

let lastFetchTime = null;

let isLoading = false;

let autoRefreshTimer = null;


/* =========================================================
   CONFIG
   ========================================================= */

const PAGE_SIZE = 1000;

const AUTO_REFRESH_INTERVAL =
    60 * 1000;


/* =========================================================
   RELEVANCE
   ========================================================= */

function isRelevantArticle(article) {

    return (
        article &&
        (
            article.relevant === true ||
            article.relevant === "true" ||
            article.relevant === 1 ||
            article.relevant === "1"
        )
    );
}


function isProcessedArticle(article) {

    return (
        article &&
        (
            article.processed === true ||
            article.processed === "true" ||
            article.processed === 1 ||
            article.processed === "1"
        )
    );
}


/*
 * ONLY articles that have been AI processed
 * AND judged relevant are allowed into the UI.
 */
function isVisibleArticle(article) {

    return (
        isProcessedArticle(article) &&
        isRelevantArticle(article)
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

    for (
        const value of candidates
    ) {

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


function formatDate(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date =
        dateValue instanceof Date
            ? dateValue
            : new Date(dateValue);

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


function getMonthKey(article) {

    const date =
        getArticleDate(article);

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


function getMonthLabel(key) {

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
   SORT
   ========================================================= */

function sortNewestFirst(list) {

    return [...list].sort(
        (a, b) => {

            const da =
                getArticleDate(a);

            const db =
                getArticleDate(b);

            return (
                (db?.getTime() || 0) -
                (da?.getTime() || 0)
            );
        }
    );
}


/* =========================================================
   LOAD DATABASE
   ========================================================= */

async function fetchAllRelevantArticles() {

    let allRows = [];

    let from = 0;

    while (true) {

        const to =
            from + PAGE_SIZE - 1;

        const {
            data,
            error
        } = await db
            .from("articles")
            .select("*")

            /*
             * THIS IS THE CRITICAL FIX.
             *
             * Pending / irrelevant articles
             * never enter the frontend dataset.
             */
            .eq(
                "processed",
                true
            )
            .eq(
                "relevant",
                true
            )

            .order(
                "published_at",
                {
                    ascending: false,
                    nullsFirst: false
                }
            )

            .range(
                from,
                to
            );


        if (error) {

            console.error(
                "Supabase error:",
                error
            );

            throw error;
        }


        const rows =
            Array.isArray(data)
                ? data
                : [];


        allRows =
            allRows.concat(
                rows
            );


        if (
            rows.length <
            PAGE_SIZE
        ) {

            break;
        }


        from += PAGE_SIZE;
    }


    return allRows;
}


/* =========================================================
   LOAD
   ========================================================= */

async function loadArticles() {

    if (isLoading) {
        return;
    }

    setLoading(true);

    try {

        const oldMonth =
            selectedMonth;


        const data =
            await fetchAllRelevantArticles();


        articles =
            sortNewestFirst(
                data
            );


        lastFetchTime =
            new Date();


        buildMonthSlicer();


        /*
         * Restore month.
         */
        const monthFilter =
            document.getElementById(
                "month-filter"
            );


        if (
            monthFilter &&
            oldMonth !== "ALL" &&
            Array.from(
                monthFilter.options
            ).some(
                option =>
                    option.value ===
                    oldMonth
            )
        ) {

            selectedMonth =
                oldMonth;

            monthFilter.value =
                oldMonth;

        } else {

            selectedMonth =
                "ALL";

            if (monthFilter) {

                monthFilter.value =
                    "ALL";
            }
        }


        buildFlashcards();

        renderDashboard();

        applyAllFilters();

        renderRevision();

        updateLastUpdated();


        console.log(
            `Visible relevant articles: ${articles.length}`
        );

    } catch (error) {

        console.error(
            "Article loading failed:",
            error
        );

        showLoadError(
            "Unable to load current affairs."
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


    const months =
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
                !months.has(key)
            ) {

                months.set(
                    key,
                    getMonthLabel(key)
                );
            }
        }
    );


    const sortedMonths =
        Array.from(
            months.entries()
        ).sort(
            (
                a,
                b
            ) =>
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
            sortedMonths
                .map(
                    (
                        [key, label]
                    ) =>
                        `
                        <option
                            value="${key}"
                        >
                            ${escapeHtml(
                                label
                            )}
                        </option>
                        `
                )
                .join("")
        }
        `;


    if (
        selectedMonth !==
        "ALL" &&
        months.has(
            selectedMonth
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


    /*
     * MONTH
     */

    if (
        selectedMonth !==
        "ALL"
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

        const minimum =
            Number(
                importance
            );

        let maximum;

        if (
            minimum === 9
        ) {

            maximum = 10;

        } else if (
            minimum === 7
        ) {

            maximum = 8;

        } else if (
            minimum === 4
        ) {

            maximum = 6;

        } else {

            maximum = 3;
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
                        score >=
                            minimum &&
                        score <=
                            maximum
                    );
                }
            );
    }


    /*
     * GS
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
                    (
                        article.gs_papers ||
                        []
                    ).includes(
                        gs
                    )
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


    const highPriority =
        articles.filter(
            article =>
                Number(
                    article.importance ||
                    0
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


    /*
     * Since the frontend dataset contains only
     * processed + relevant articles, all visible
     * articles are AI processed.
     */

    setText(
        "processed-count",
        total
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

function articleCard(
    article
) {

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
        getArticleDate(
            article
        );


    const gs =
        (
            article.gs_papers ||
            []
        )
            .slice(
                0,
                2
            )
            .join(" · ");


    return `
        <article
            class="article-card"
        >

            ${
                date
                    ? `
                        <div class="article-date">
                            ${formatDate(
                                date
                            )}
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

                ${
                    gs
                        ? `
                            <span class="badge">
                                ${escapeHtml(
                                    gs
                                )}
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
                    article.english_summary ||
                    ""
                )}
            </p>


            <button
                onclick="
                    openArticle(
                        ${JSON.stringify(
                            article.id
                        )}
                    )
                "
            >
                Read analysis →
            </button>

        </article>
    `;
}


/* =========================================================
   ARTICLES
   ========================================================= */

function renderArticles(
    filtered = articles
) {

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
                No UPSC-relevant articles found.
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
            (
                a,
                b
            ) =>
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
                                getMonthLabel(
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

function articleListItem(
    article
) {

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
        getArticleDate(
            article
        );


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
                                ${formatDate(
                                    date
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


                    ${
                        (
                            article.gs_papers ||
                            []
                        )
                            .map(
                                gs =>
                                    `
                                    <span
                                        class="badge"
                                    >
                                        ${escapeHtml(
                                            gs
                                        )}
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
                        ""
                    )}
                </p>

            </div>


            <button
                class="text-button"
                onclick="
                    openArticle(
                        ${JSON.stringify(
                            article.id
                        )}
                    )
                "
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


    if (!article) {
        return;
    }


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


    const date =
        getArticleDate(
            article
        );


    let html = `

        ${
            date
                ? `
                    <div class="article-date">
                        ${formatDate(
                            date
                        )}
                    </div>
                `
                : ""
        }


        <div class="article-meta">

            <span class="badge high">
                Importance
                ${article.importance}/10
            </span>


            ${
                (
                    article.gs_papers ||
                    []
                )
                    .map(
                        gs =>
                            `
                            <span class="badge">
                                ${escapeHtml(
                                    gs
                                )}
                            </span>
                            `
                    )
                    .join("")
            }

        </div>


        <h1
            class="detail-title"
        >
            ${escapeHtml(
                article.english_title ||
                article.title ||
                ""
            )}
        </h1>


        ${
            article.english_summary
                ? `
                    <p
                        class="detail-summary"
                    >
                        ${escapeHtml(
                            article.english_summary
                        )}
                    </p>
                `
                : ""
        }

    `;


    sections.forEach(
        (
            [
                title,
                values
            ]
        ) => {

            if (
                !Array.isArray(
                    values
                ) ||
                values.length === 0
            ) {

                return;
            }


            html += `

                <div
                    class="detail-section"
                >

                    <h4>
                        ${escapeHtml(
                            title
                        )}
                    </h4>

                    <ul>

                        ${values
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
    );


    if (article.link) {

        html += `

            <div
                class="detail-section"
            >

                <a
                    href="${escapeHtml(
                        article.link
                    )}"
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


            article.flashcards
                .forEach(
                    card => {

                        flashcards.push(
                            {
                                ...card,

                                article:
                                    article.english_title ||
                                    article.title
                            }
                        );
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

            <div
                class="flashcard"
            >

                <h3>
                    No flashcards yet
                </h3>

                <p
                    class="answer"
                >
                    Process relevant PIB
                    articles to generate
                    revision cards.
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

        <div
            class="flashcard"
        >

            <span
                class="type"
            >
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
                style="display:none"
            >
                ${escapeHtml(
                    card.answer ||
                    ""
                )}
            </div>


            <div
                class="flashcard-actions"
            >

                <button
                    onclick="showAnswer()"
                >
                    Show answer
                </button>


                <button
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
            `${
                currentFlashcard + 1
            } / ${
                flashcards.length
            }`;
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

    const important =
        articles
            .filter(
                article =>
                    Number(
                        article.importance ||
                        0
                    ) >= 7
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.importance ||
                        0
                    ) -
                    Number(
                        a.importance ||
                        0
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


    if (
        important.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                No high-priority articles yet.
            </div>
        `;

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
                (
                    article.gs_papers ||
                    []
                ).includes(
                    gs
                )
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
            ${escapeHtml(
                gs
            )}
            Current Affairs
        </h3>


        <div
            class="article-list"
        >

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


    if (
        filtered.length === 0
    ) {

        container.innerHTML += `
            <div class="empty-state">
                No relevant articles found.
            </div>
        `;
    }
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


                        const topics =
                            (
                                article.topics ||
                                []
                            )
                                .join(" ")
                                .toLowerCase();


                        return (
                            title.includes(
                                query
                            )
                            ||
                            summary.includes(
                                query
                            )
                            ||
                            topics.includes(
                                query
                            )
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


    if (
        view ===
        "revision"
    ) {

        renderRevision();
    }


    if (
        view ===
        "flashcards"
    ) {

        renderFlashcard();
    }
}


/* =========================================================
   MODAL
   ========================================================= */

function setupModal() {

    const close =
        document.getElementById(
            "close-modal"
        );


    if (close) {

        close.addEventListener(
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


    const modal =
        document.getElementById(
            "article-modal"
        );


    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "article-modal"
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
   FILTER EVENTS
   ========================================================= */

function setupFilters() {

    const month =
        document.getElementById(
            "month-filter"
        );


    if (month) {

        month.addEventListener(
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
        "gs-filter"
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
}


/* =========================================================
   REFRESH
   ========================================================= */

function setupRefresh() {

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


function setLoading(
    loading
) {

    isLoading =
        loading;


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


function setupAutoRefresh() {

    if (
        autoRefreshTimer
    ) {

        clearInterval(
            autoRefreshTimer
        );
    }


    autoRefreshTimer =
        setInterval(
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    loadArticles();
                }

            },
            AUTO_REFRESH_INTERVAL
        );


    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                loadArticles();
            }
        }
    );
}


/* =========================================================
   PDF
   ========================================================= */

async function loadJsPDF() {

    if (
        window.jspdf &&
        window.jspdf.jsPDF
    ) {

        return window.jspdf.jsPDF;
    }


    return new Promise(
        (
            resolve,
            reject
        ) => {

            const script =
                document.createElement(
                    "script"
                );


            script.src =
                "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";


            script.onload =
                () => {

                    if (
                        window.jspdf &&
                        window.jspdf.jsPDF
                    ) {

                        resolve(
                            window.jspdf.jsPDF
                        );

                    } else {

                        reject(
                            new Error(
                                "jsPDF failed to load."
                            )
                        );
                    }
                };


            script.onerror =
                () => {

                    reject(
                        new Error(
                            "Unable to load PDF generator."
                        )
                    );
                };


            document.head.appendChild(
                script
            );
        }
    );
}


async function downloadPDF() {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Generating...";
    }


    try {

        /*
         * ONLY HIGH-PRIORITY RELEVANT ARTICLES.
         *
         * Importance >= 7
         */

        const pdfArticles =
            sortNewestFirst(
                articles.filter(
                    article =>
                        isRelevantArticle(
                            article
                        )
                        &&
                        Number(
                            article.importance ||
                            0
                        ) >= 7
                )
            );


        if (
            pdfArticles.length === 0
        ) {

            alert(
                "No high-priority relevant articles available."
            );

            return;
        }


        const jsPDF =
            await loadJsPDF();


        const doc =
            new jsPDF(
                {
                    orientation:
                        "portrait",

                    unit:
                        "mm",

                    format:
                        "a4"
                }
            );


        const pageWidth =
            doc.internal.pageSize
                .getWidth();


        const pageHeight =
            doc.internal.pageSize
                .getHeight();


        const margin =
            16;


        let y =
            18;


        function addText(
            text,
            x,
            currentY,
            maxWidth,
            fontSize,
            bold = false
        ) {

            doc.setFont(
                "helvetica",
                bold
                    ? "bold"
                    : "normal"
            );


            doc.setFontSize(
                fontSize
            );


            const lines =
                doc.splitTextToSize(
                    String(
                        text ||
                        ""
                    ),
                    maxWidth
                );


            doc.text(
                lines,
                x,
                currentY
            );


            return (
                currentY +
                (
                    lines.length *
                    fontSize *
                    0.42
                )
            );
        }


        /*
         * HEADER
         */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            20
        );

        doc.text(
            "PIB UPSC CURRENT AFFAIRS",
            margin,
            y
        );


        y += 9;


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            10
        );

        doc.text(
            "High-Priority UPSC Revision",
            margin,
            y
        );


        y += 10;


        doc.setDrawColor(
            210,
            210,
            210
        );

        doc.line(
            margin,
            y,
            pageWidth - margin,
            y
        );


        y += 10;


        /*
         * ARTICLES
         */

        pdfArticles.forEach(
            (
                article,
                index
            ) => {

                if (
                    y >
                    pageHeight - 35
                ) {

                    doc.addPage();

                    y = 18;
                }


                /*
                 * Title
                 */

                y =
                    addText(
                        article.english_title ||
                        article.title ||
                        "Untitled",

                        margin,

                        y,

                        pageWidth -
                        margin * 2,

                        14,

                        true
                    );


                y += 3;


                /*
                 * Metadata
                 */

                const date =
                    getArticleDate(
                        article
                    );


                const gs =
                    (
                        article.gs_papers ||
                        []
                    ).join(
                        ", "
                    );


                const metadata =
                    [
                        date
                            ? formatDate(
                                date
                            )
                            : "",

                        `${article.importance}/10`,

                        gs
                    ]
                        .filter(
                            Boolean
                        )
                        .join(
                            "  •  "
                        );


                y =
                    addText(
                        metadata,

                        margin,

                        y,

                        pageWidth -
                        margin * 2,

                        9,

                        false
                    );


                y += 4;


                /*
                 * Summary
                 */

                y =
                    addText(
                        article.english_summary ||
                        "",

                        margin,

                        y,

                        pageWidth -
                        margin * 2,

                        10,

                        false
                    );


                y += 5;


                /*
                 * Prelims
                 */

                if (
                    Array.isArray(
                        article.prelims_facts
                    ) &&
                    article.prelims_facts.length
                ) {

                    y =
                        addText(
                            "Prelims Facts",

                            margin,

                            y,

                            pageWidth -
                            margin * 2,

                            11,

                            true
                        );


                    y += 2;


                    article.prelims_facts
                        .slice(
                            0,
                            5
                        )
                        .forEach(
                            fact => {

                                y =
                                    addText(
                                        "• " +
                                        fact,

                                        margin + 3,

                                        y,

                                        pageWidth -
                                        margin * 2 -
                                        3,

                                        9,

                                        false
                                    );

                                y += 1;
                            }
                        );


                    y += 2;
                }


                /*
                 * Mains
                 */

                if (
                    Array.isArray(
                        article.mains_notes
                    ) &&
                    article.mains_notes.length
                ) {

                    y =
                        addText(
                            "Mains Notes",

                            margin,

                            y,

                            pageWidth -
                            margin * 2,

                            11,

                            true
                        );


                    y += 2;


                    article.mains_notes
                        .slice(
                            0,
                            5
                        )
                        .forEach(
                            note => {

                                y =
                                    addText(
                                        "• " +
                                        note,

                                        margin + 3,

                                        y,

                                        pageWidth -
                                        margin * 2 -
                                        3,

                                        9,

                                        false
                                    );

                                y += 1;
                            }
                        );


                    y += 2;
                }


                /*
                 * Important data
                 */

                if (
                    Array.isArray(
                        article.data_points
                    ) &&
                    article.data_points.length
                ) {

                    y =
                        addText(
                            "Important Data",

                            margin,

                            y,

                            pageWidth -
                            margin * 2,

                            11,

                            true
                        );


                    y += 2;


                    article.data_points
                        .slice(
                            0,
                            3
                        )
                        .forEach(
                            data => {

                                y =
                                    addText(
                                        "• " +
                                        data,

                                        margin + 3,

                                        y,

                                        pageWidth -
                                        margin * 2 -
                                        3,

                                        9,

                                        false
                                    );

                                y += 1;
                            }
                        );


                    y += 2;
                }


                /*
                 * Separator
                 */

                y += 3;


                doc.setDrawColor(
                    225,
                    225,
                    225
                );


                doc.line(
                    margin,
                    y,
                    pageWidth -
                    margin,
                    y
                );


                y += 8;
            }
        );


        /*
         * Footer
         */

        const pages =
            doc.internal
                .getNumberOfPages();


        for (
            let page = 1;
            page <= pages;
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
                8
            );


            doc.text(
                `PIB UPSC • Page ${page} of ${pages}`,
                margin,
                pageHeight - 8
            );
        }


        const date =
            new Date()
                .toISOString()
                .slice(
                    0,
                    10
                );


        doc.save(
            `PIB_UPSC_High_Priority_${date}.pdf`
        );


    } catch (error) {

        console.error(
            "PDF generation failed:",
            error
        );


        alert(
            "PDF generation failed. Please try again."
        );

    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "↓ Download PDF";
        }
    }
}


/* =========================================================
   PDF BUTTON
   ========================================================= */

function setupPDF() {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    if (!button) {

        console.warn(
            "Download PDF button not found."
        );

        return;
    }


    button.addEventListener(
        "click",
        downloadPDF
    );
}


/* =========================================================
   LAST UPDATED
   ========================================================= */

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
        `Updated ${
            lastFetchTime
                .toLocaleTimeString(
                    "en-IN",
                    {
                        hour:
                            "2-digit",

                        minute:
                            "2-digit"
                    }
                )
        }`;
}


/* =========================================================
   NAV SETUP
   ========================================================= */

function setupNavigation() {

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
            ".gs-card"
        )
        .forEach(
            card => {

                card.addEventListener(
                    "click",
                    () => {

                        showView(
                            "gs"
                        );

                        renderGS(
                            card.dataset.gs
                        );
                    }
                );
            }
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
        document.getElementById(
            id
        );


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

        container.innerHTML = `
            <div class="empty-state">
                ${escapeHtml(
                    message
                )}
            </div>
        `;
    }
}


function escapeHtml(
    value
) {

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

function initialiseApp() {

    setupNavigation();

    setupSearch();

    setupModal();

    setupFilters();

    setupRefresh();

    setupAutoRefresh();

    setupPDF();

    loadArticles();
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initialiseApp
    );

} else {

    initialiseApp();
}
