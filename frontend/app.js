/* =========================================================
   PIB UPSC — APP.JS
   Relevant-only application
   Dynamic month slicer
   Two-column article layout
   PDF export
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://gmytscoqupsozionnryy.supabase.co";


const SUPABASE_KEY =
    "sb_publishable_dpY7xVY8df2CqDfoT9rTFg_PGpgpWNF";


const {
    createClient
} = supabase;


const db =
    createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );



/* =========================================================
   GLOBAL STATE
   ========================================================= */

let articles = [];

let allDatabaseArticles = [];

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



function getDisplayDate(article) {

    const date =
        getArticleDate(
            article
        );


    if (date) {
        return date;
    }


    if (lastFetchTime) {

        return new Date(
            lastFetchTime
        );

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
            : new Date(
                dateValue
            );


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
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"
        }
    );

}



function getMonthKey(article) {

    const date =
        getDisplayDate(
            article
        );


    if (!date) {

        return "UNKNOWN";

    }


    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(
        2,
        "0"
    )}`;

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
    ] =
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
            month:
                "long",

            year:
                "numeric"
        }
    ).toUpperCase();

}



/* =========================================================
   IMPORTANCE
   ========================================================= */

function getImportance(article) {

    const value =
        Number(
            article?.importance
        );


    if (
        Number.isNaN(
            value
        )
    ) {

        return 0;

    }


    return value;

}



/* =========================================================
   RELEVANCE
   ========================================================= */

function isRelevant(article) {

    /*
     * We intentionally require the database
     * relevance field to be true.
     *
     * This ensures 0/10 irrelevant articles
     * disappear from EVERY part of the app.
     */

    return (
        article?.relevant === true ||
        article?.relevant === "true"
    );

}



/* =========================================================
   SORTING
   ========================================================= */

function articleTimestamp(article) {

    const date =
        getArticleDate(
            article
        );


    if (!date) {

        return 0;

    }


    return date.getTime();

}



function sortNewestFirst(list) {

    return [
        ...list
    ].sort(
        (
            a,
            b
        ) =>
            articleTimestamp(
                b
            ) -
            articleTimestamp(
                a
            )
    );

}



/* =========================================================
   LOADING STATE
   ========================================================= */

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


    button.classList.toggle(
        "loading",
        loading
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


    const date =
        new Date(
            lastFetchTime
        );


    element.textContent =
        `Updated ${date.toLocaleTimeString(
            "en-IN",
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
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


    setLoading(
        true
    );


    showHeroStatus(
        "Refreshing current affairs..."
    );


    try {

        const {
            data,
            error
        } =
            await db
                .from(
                    "articles"
                )
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


        /*
         * Keep a copy of the complete
         * database response.
         */

        allDatabaseArticles =
            Array.isArray(
                data
            )
                ? data
                : [];


        /*
         * CRITICAL:
         *
         * From this point onward the application
         * works ONLY with relevant articles.
         */

        articles =
            allDatabaseArticles.filter(
                isRelevant
            );


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


        showHeroStatus(
            `${articles.length} relevant articles`
        );


    } catch (
        error
    ) {

        console.error(
            error
        );


        showLoadError(
            "Something went wrong while loading articles."
        );


    } finally {

        setLoading(
            false
        );

    }

}



/* =========================================================
   HERO STATUS
   ========================================================= */

function showHeroStatus(
    message
) {

    const element =
        document.getElementById(
            "hero-fetch-status"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.style.display =
        "none";

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


    const oldValue =
        selectedMonth;


    const monthMap =
        new Map();


    /*
     * Only relevant articles reach this point.
     */

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
                !monthMap.has(
                    key
                )
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

        ${months
            .map(
                (
                    [
                        key,
                        label
                    ]
                ) =>
                    `
                    <option value="${escapeHtml(
                        key
                    )}">
                        ${escapeHtml(
                            label
                        )}
                    </option>
                    `
            )
            .join("")}
        `;


    const exists =
        months.some(
            (
                [key]
            ) =>
                key === oldValue
        );


    if (
        oldValue !== "ALL" &&
        exists
    ) {

        select.value =
            oldValue;

        selectedMonth =
            oldValue;

    } else {

        select.value =
            "ALL";

        selectedMonth =
            "ALL";

    }


    updateMonthHeading();

}



/* =========================================================
   MONTH HEADING
   ========================================================= */

function updateMonthHeading() {

    const heading =
        document.getElementById(
            "articles-month-heading"
        );


    if (!heading) {
        return;
    }


    if (
        selectedMonth === "ALL"
    ) {

        heading.textContent =
            "ALL CURRENT AFFAIRS";

        return;

    }


    heading.textContent =
        getMonthLabelFromKey(
            selectedMonth
        );

}



/* =========================================================
   APPLY FILTERS
   ========================================================= */

function applyAllFilters() {

    let filtered =
        [
            ...articles
        ];


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
                    ) === selectedMonth
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


        if (
            min === 9
        ) {

            max = 10;

        } else if (
            min === 7
        ) {

            max = 8;

        } else if (
            min === 4
        ) {

            max = 6;

        } else {

            max = 3;

        }


        filtered =
            filtered.filter(
                article => {

                    const score =
                        getImportance(
                            article
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
                    (
                        article.gs_papers ||
                        []
                    ).includes(
                        gs
                    )
            );

    }


    /*
     * Final safety filter.
     *
     * Even if another function accidentally
     * passes an irrelevant article, it cannot
     * reach the screen.
     */

    filtered =
        filtered.filter(
            isRelevant
        );


    renderArticles(
        filtered
    );


    updateMonthHeading();

}



/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

    /*
     * Everything here is based ONLY on
     * relevant articles.
     */

    const total =
        articles.length;


    const processed =
        articles.filter(
            article =>
                article.processed === true ||
                article.processed === "true"
        ).length;


    const highPriority =
        articles.filter(
            article =>
                getImportance(
                    article
                ) >= 7
        ).length;


    let averageImportance =
        0;


    if (articles.length) {

        const totalImportance =
            articles.reduce(
                (
                    sum,
                    article
                ) =>
                    sum +
                    getImportance(
                        article
                    ),
                0
            );


        averageImportance =
            (
                totalImportance /
                articles.length
            ).toFixed(
                1
            );

    }


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
        highPriority
    );


    setText(
        "important-count",
        averageImportance
    );


    /*
     * Dashboard recent articles.
     */

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


    renderDashboardPriority();

}



/* =========================================================
   DASHBOARD PRIORITY
   ========================================================= */

function renderDashboardPriority() {

    const container =
        document.getElementById(
            "dashboard-priority-list"
        );


    if (!container) {
        return;
    }


    const priorityArticles =
        sortNewestFirst(
            articles
                .filter(
                    article =>
                        getImportance(
                            article
                        ) >= 7
                )
        )
        .slice(
            0,
            6
        );


    if (
        priorityArticles.length === 0
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                No high-priority articles yet.
            </div>
            `;

        return;

    }


    container.innerHTML =
        priorityArticles
            .map(
                article => {

                    const score =
                        getImportance(
                            article
                        );


                    return `
                        <div
                            class="priority-item"
                            onclick="openArticle(${JSON.stringify(
                                article.id
                            )})"
                        >

                            <div
                                class="priority-score"
                                style="color:${
                                    score >= 9
                                        ? "#4776d9"
                                        : "#c88719"
                                };"
                            >
                                ${score}/10
                            </div>

                            <h4>
                                ${escapeHtml(
                                    article.english_title ||
                                    article.title ||
                                    "Untitled article"
                                )}
                            </h4>

                        </div>
                    `;

                }
            )
            .join("");

}



/* =========================================================
   ARTICLE CARD
   ========================================================= */

function articleCard(
    article
) {

    /*
     * Safety:
     */

    if (
        !isRelevant(
            article
        )
    ) {

        return "";

    }


    const importance =
        getImportance(
            article
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


    const dateText =
        formatDate(
            date
        );


    const summary =
        article.english_summary ||
        article.summary ||
        (
            article.topics ||
            []
        )
            .slice(
                0,
                3
            )
            .join(
                " · "
            );


    return `

        <article
            class="article-card"
        >

            ${
                dateText
                    ? `
                        <div
                            class="article-date"
                        >
                            ${dateText}
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
                        .slice(
                            0,
                            2
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
                    summary
                )}
            </p>


            <button
                type="button"
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
     * Absolute final relevance protection.
     */

    filtered =
        (
            filtered ||
            []
        ).filter(
            isRelevant
        );


    if (
        filtered.length === 0
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                No relevant articles found for
                the selected filters.
            </div>
            `;

        return;

    }


    filtered =
        sortNewestFirst(
            filtered
        );


    /*
     * If a month is explicitly selected,
     * all articles belong to that month.
     *
     * If ALL is selected, group by month.
     */

    const groups =
        new Map();


    filtered.forEach(
        article => {

            const key =
                getMonthKey(
                    article
                );


            if (
                !groups.has(
                    key
                )
            ) {

                groups.set(
                    key,
                    []
                );

            }


            groups
                .get(
                    key
                )
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


    /*
     * When a specific month is selected,
     * don't repeat multiple month headings.
     */

    container.innerHTML =
        sortedGroups
            .map(
                (
                    [
                        key,
                        monthArticles
                    ]
                ) => {

                    const heading =
                        selectedMonth === "ALL"
                            ? `
                                <div
                                    class="articles-month-heading"
                                >
                                    ${escapeHtml(
                                        getMonthLabelFromKey(
                                            key
                                        )
                                    )}
                                </div>
                            `
                            : "";


                    return `

                        ${heading}

                        <div
                            class="article-list"
                        >

                            ${monthArticles
                                .filter(
                                    isRelevant
                                )
                                .map(
                                    articleCard
                                )
                                .join("")}

                        </div>

                    `;

                }
            )
            .join("");

}



/* =========================================================
   ARTICLE DETAIL
   ========================================================= */

function openArticle(
    id
) {

    const article =
        articles.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    id
                )
        );


    /*
     * Irrelevant articles are not even in
     * `articles`, so they cannot be opened.
     */

    if (
        !article ||
        !isRelevant(
            article
        )
    ) {

        return;

    }


    const date =
        getDisplayDate(
            article
        );


    let html =
        `

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
                class="badge high"
            >
                Importance
                ${getImportance(
                    article
                )}/10
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


        <h1
            class="detail-title"
        >
            ${escapeHtml(
                article.english_title ||
                article.title ||
                "Untitled article"
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
                !Array.isArray(
                    values
                ) ||
                values.length === 0
            ) {

                return;

            }


            html +=
                `

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
                            .join("")}

                    </ul>

                </div>

            `;

        }
    );


    if (
        article.link
    ) {

        html +=
            `

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


    /*
     * `articles` is already relevant-only.
     */

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
                            article.english_title ||
                            article.title

                    });

                }
            );

        }
    );


    currentFlashcard =
        0;


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

            <div
                class="flashcard"
            >

                <h3>
                    No flashcards yet
                </h3>

                <p
                    class="answer"
                    style="display:block"
                >
                    Relevant PIB articles with
                    flashcards will appear here.
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


    if (
        flashcards.length === 0
    ) {

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

        currentFlashcard =
            0;

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
                    getImportance(
                        article
                    ) >= 7
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    getImportance(
                        b
                    ) -
                    getImportance(
                        a
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

        container.innerHTML =
            `
            <div class="empty-state">
                No high-priority relevant articles.
            </div>
            `;

        return;

    }


    container.innerHTML =
        important
            .map(
                articleCard
            )
            .join("");

}



/* =========================================================
   GS
   ========================================================= */

function renderGS(
    gs
) {

    /*
     * Relevant-only because `articles` is
     * already filtered.
     */

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


    if (
        filtered.length === 0
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                No relevant articles found for ${escapeHtml(
                    gs
                )}.
            </div>
            `;

        return;

    }


    container.innerHTML =
        `

        <h3>
            ${escapeHtml(
                gs
            )}
            Current Affairs
        </h3>


        <div
            class="article-list"
        >

            ${sortNewestFirst(
                filtered
            )
                .map(
                    articleCard
                )
                .join("")}

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


            updateMonthHeading();


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
    .filter(
        Boolean
    )
    .forEach(
        element => {

            element.addEventListener(
                "change",
                applyAllFilters
            );

        }
    );



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


                    renderGS(
                        gs
                    );

                }
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
        titles[
            view
        ] ||
        "Dashboard"
    );

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


            /*
             * Search ONLY relevant articles.
             */

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
                                article.topics ||
                                []
                            )
                                .join(
                                    " "
                                )
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

                            raw.includes(
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
   ESC CLOSE MODAL
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Escape"
        ) {

            return;

        }


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
   PDF EXPORT
   ========================================================= */

const pdfButton =
    document.getElementById(
        "download-pdf-btn"
    );


if (pdfButton) {

    pdfButton.addEventListener(
        "click",
        generateCurrentAffairsPDF
    );

}



/* =========================================================
   GET PDF ARTICLES
   ========================================================= */

function getPDFArticles() {

    /*
     * Start from relevant articles only.
     */

    let filtered =
        articles.filter(
            isRelevant
        );


    /*
     * Month.
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
     * Importance.
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


        if (
            min === 9
        ) {

            max = 10;

        } else if (
            min === 7
        ) {

            max = 8;

        } else if (
            min === 4
        ) {

            max = 6;

        } else {

            max = 3;

        }


        filtered =
            filtered.filter(
                article => {

                    const score =
                        getImportance(
                            article
                        );


                    return (
                        score >= min &&
                        score <= max
                    );

                }
            );

    }


    /*
     * GS.
     */

    const gsFilter =
        document.getElementById(
            "gs-filter"
        );


    if (
        gsFilter &&
        gsFilter.value
    ) {

        filtered =
            filtered.filter(
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
     * Final relevance protection.
     */

    return sortNewestFirst(
        filtered.filter(
            isRelevant
        )
    );

}



/* =========================================================
   GENERATE PDF
   ========================================================= */

async function generateCurrentAffairsPDF() {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    if (!button) {
        return;
    }


    const pdfArticles =
        getPDFArticles();


    if (
        pdfArticles.length === 0
    ) {

        alert(
            "There are no relevant articles for the selected filters."
        );

        return;

    }


    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        alert(
            "PDF generator is still loading. Please try again."
        );

        return;

    }


    const originalText =
        button.innerHTML;


    button.disabled =
        true;


    button.innerHTML =
        "Generating...";


    try {

        const {
            jsPDF
        } =
            window.jspdf;


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
            doc.internal.pageSize.getWidth();


        const pageHeight =
            doc.internal.pageSize.getHeight();


        const margin =
            16;


        const contentWidth =
            pageWidth -
            margin * 2;


        drawPDFHeader(
            doc,
            margin,
            pageWidth
        );


        let y =
            43;


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
            95,
            101,
            110
        );


        doc.text(
            `UPSC-focused current affairs digest · ${monthLabel}`,
            margin,
            y
        );


        y += 5;


        const highPriority =
            pdfArticles.filter(
                article =>
                    getImportance(
                        article
                    ) >= 7
            ).length;


        doc.text(
            `${pdfArticles.length} relevant articles · ${highPriority} high-priority`,
            margin,
            y
        );


        y += 12;


        pdfArticles.forEach(
            (
                article,
                index
            ) => {

                if (
                    y >
                    pageHeight - 48
                ) {

                    doc.addPage();


                    drawPDFHeader(
                        doc,
                        margin,
                        pageWidth
                    );


                    y =
                        42;

                }


                y =
                    drawPDFArticle(
                        doc,
                        article,
                        index + 1,
                        y,
                        margin,
                        contentWidth
                    );

            }
        );


        addPDFFooters(
            doc,
            margin,
            pageWidth,
            pageHeight
        );


        const fileName =
            `PIB-UPSC-${selectedMonth === "ALL"
                ? "All-Months"
                : selectedMonth
            }.pdf`;


        doc.save(
            fileName
        );


    } catch (
        error
    ) {

        console.error(
            "PDF generation failed:",
            error
        );


        alert(
            "Unable to generate the PDF. Please try again."
        );

    } finally {

        button.disabled =
            false;


        button.innerHTML =
            originalText;

    }

}



/* =========================================================
   PDF HEADER
   ========================================================= */

function drawPDFHeader(
    doc,
    margin,
    pageWidth
) {

    doc.setFont(
        "helvetica",
        "bold"
    );


    doc.setFontSize(
        18
    );


    doc.setTextColor(
        25,
        28,
        32
    );


    doc.text(
        "PIB UPSC",
        margin,
        18
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
        "CURRENT AFFAIRS DIGEST",
        margin,
        24
    );


    const today =
        new Date()
            .toLocaleDateString(
                "en-IN",
                {
                    day:
                        "2-digit",

                    month:
                        "short",

                    year:
                        "numeric"
                }
            );


    doc.text(
        today,
        pageWidth - margin,
        18,
        {
            align:
                "right"
        }
    );


    doc.setDrawColor(
        220,
        223,
        227
    );


    doc.line(
        margin,
        29,
        pageWidth - margin,
        29
    );

}



/* =========================================================
   PDF ARTICLE
   ========================================================= */

function drawPDFArticle(
    doc,
    article,
    number,
    y,
    margin,
    contentWidth
) {

    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    const summary =
        article.english_summary ||
        article.summary ||
        "Summary not available.";


    const importance =
        getImportance(
            article
        );


    const date =
        getDisplayDate(
            article
        );


    const gs =
        (
            article.gs_papers ||
            []
        ).join(
            ", "
        );


    const topics =
        (
            article.topics ||
            []
        ).join(
            ", "
        );


    /*
     * TITLE
     */

    doc.setFont(
        "helvetica",
        "bold"
    );


    doc.setFontSize(
        12
    );


    doc.setTextColor(
        28,
        31,
        35
    );


    const titleLines =
        doc.splitTextToSize(
            `${number}. ${cleanPDFText(
                title
            )}`,
            contentWidth
        );


    doc.text(
        titleLines,
        margin,
        y
    );


    y +=
        titleLines.length *
        5.3;


    /*
     * META
     */

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


    const meta = [];


    if (date) {

        meta.push(
            formatDate(
                date
            )
        );

    }


    if (gs) {

        meta.push(
            gs
        );

    }


    meta.push(
        `Importance ${importance}/10`
    );


    doc.text(
        meta.join(
            "  |  "
        ),
        margin,
        y
    );


    y += 7;


    /*
     * SUMMARY
     */

    y =
        drawPDFTextBlock(
            doc,
            "SHORT SUMMARY",
            summary,
            y,
            margin,
            contentWidth
        );


    /*
     * UPSC
     */

    const whyUPSC =
        buildWhyUPSC(
            article
        );


    y =
        drawPDFTextBlock(
            doc,
            "WHY IT MATTERS FOR UPSC",
            whyUPSC,
            y,
            margin,
            contentWidth
        );


    /*
     * PRELIMS
     */

    const prelims =
        getArrayField(
            article,
            [
                "prelims_facts",
                "prelims_points",
                "key_facts"
            ]
        );


    if (
        prelims.length
    ) {

        y =
            drawPDFBulletSection(
                doc,
                "PRELIMS FOCUS",
                prelims.slice(
                    0,
                    6
                ),
                y,
                margin,
                contentWidth
            );

    }


    /*
     * MAINS
     */

    const mains =
        getArrayField(
            article,
            [
                "mains_notes",
                "mains_points",
                "implications"
            ]
        );


    if (
        mains.length
    ) {

        y =
            drawPDFBulletSection(
                doc,
                "MAINS FOCUS",
                mains.slice(
                    0,
                    5
                ),
                y,
                margin,
                contentWidth
            );

    }


    /*
     * DATA
     */

    const dataPoints =
        getArrayField(
            article,
            [
                "data_points"
            ]
        );


    if (
        dataPoints.length
    ) {

        y =
            drawPDFBulletSection(
                doc,
                "IMPORTANT DATA",
                dataPoints.slice(
                    0,
                    5
                ),
                y,
                margin,
                contentWidth
            );

    }


    /*
     * TOPICS
     */

    if (
        topics
    ) {

        y =
            drawPDFTextBlock(
                doc,
                "KEYWORDS",
                topics,
                y,
                margin,
                contentWidth
            );

    }


    /*
     * SOURCE
     */

    if (
        article.link
    ) {

        y =
            drawPDFTextBlock(
                doc,
                "SOURCE",
                article.link,
                y,
                margin,
                contentWidth
            );

    }


    /*
     * Separator
     */

    y += 3;


    doc.setDrawColor(
        225,
        227,
        230
    );


    doc.line(
        margin,
        y,
        margin + contentWidth,
        y
    );


    y += 9;


    return y;

}



/* =========================================================
   PDF TEXT BLOCK
   ========================================================= */

function drawPDFTextBlock(
    doc,
    heading,
    text,
    y,
    margin,
    contentWidth
) {

    if (!text) {
        return y;
    }


    doc.setFont(
        "helvetica",
        "bold"
    );


    doc.setFontSize(
        8.5
    );


    doc.setTextColor(
        35,
        38,
        42
    );


    doc.text(
        heading,
        margin,
        y
    );


    y += 4;


    doc.setFont(
        "helvetica",
        "normal"
    );


    doc.setFontSize(
        8.5
    );


    doc.setTextColor(
        76,
        82,
        92
    );


    const lines =
        doc.splitTextToSize(
            cleanPDFText(
                text
            ),
            contentWidth
        );


    doc.text(
        lines,
        margin,
        y
    );


    y +=
        lines.length *
        4;


    y += 5;


    return y;

}



/* =========================================================
   PDF BULLETS
   ========================================================= */

function drawPDFBulletSection(
    doc,
    heading,
    items,
    y,
    margin,
    contentWidth
) {

    if (
        !items ||
        items.length === 0
    ) {

        return y;

    }


    doc.setFont(
        "helvetica",
        "bold"
    );


    doc.setFontSize(
        8.5
    );


    doc.setTextColor(
        35,
        38,
        42
    );


    doc.text(
        heading,
        margin,
        y
    );


    y += 5;


    doc.setFont(
        "helvetica",
        "normal"
    );


    doc.setFontSize(
        8.5
    );


    doc.setTextColor(
        76,
        82,
        92
    );


    items.forEach(
        item => {

            const text =
                cleanPDFText(
                    item
                );


            if (!text) {
                return;
            }


            const lines =
                doc.splitTextToSize(
                    text,
                    contentWidth - 6
                );


            doc.text(
                "•",
                margin,
                y
            );


            doc.text(
                lines,
                margin + 4,
                y
            );


            y +=
                lines.length *
                4;


            y += 2;

        }
    );


    y += 3;


    return y;

}



/* =========================================================
   WHY UPSC
   ========================================================= */

function buildWhyUPSC(
    article
) {

    const gs =
        (
            article.gs_papers ||
            []
        ).join(
            ", "
        );


    const topics =
        (
            article.topics ||
            []
        ).slice(
            0,
            4
        );


    const implications =
        getArrayField(
            article,
            [
                "implications"
            ]
        );


    const parts = [];


    if (gs) {

        parts.push(
            `Relevant GS area: ${gs}.`
        );

    }


    if (
        topics.length
    ) {

        parts.push(
            `Key themes include ${topics.join(
                ", "
            )}.`
        );

    }


    if (
        implications.length
    ) {

        parts.push(
            implications[0]
        );

    }


    if (
        parts.length === 0
    ) {

        return (
            "This article has been classified as relevant for UPSC preparation and should be reviewed for its factual and analytical significance."
        );

    }


    return parts.join(
        " "
    );

}



/* =========================================================
   ARRAY FIELD
   ========================================================= */

function getArrayField(
    article,
    fields
) {

    for (
        const field of fields
    ) {

        const value =
            article?.[
                field
            ];


        if (
            Array.isArray(
                value
            ) &&
            value.length
        ) {

            return value
                .filter(
                    item =>
                        item !== null &&
                        item !== undefined
                )
                .map(
                    item =>
                        typeof item === "object"
                            ? JSON.stringify(
                                item
                            )
                            : String(
                                item
                            )
                );

        }

    }


    return [];

}



/* =========================================================
   CLEAN PDF TEXT
   ========================================================= */

function cleanPDFText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(
        value
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}



/* =========================================================
   PDF FOOTERS
   ========================================================= */

function addPDFFooters(
    doc,
    margin,
    pageWidth,
    pageHeight
) {

    const pageCount =
        doc.internal.getNumberOfPages();


    for (
        let page = 1;
        page <= pageCount;
        page++
    ) {

        doc.setPage(
            page
        );


        doc.setDrawColor(
            225,
            227,
            230
        );


        doc.line(
            margin,
            pageHeight - 13,
            pageWidth - margin,
            pageHeight - 13
        );


        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.setFontSize(
            7.5
        );


        doc.setTextColor(
            125,
            130,
            138
        );


        doc.text(
            "PIB UPSC · Current Affairs Digest",
            margin,
            pageHeight - 8
        );


        doc.text(
            `Page ${page} of ${pageCount}`,
            pageWidth - margin,
            pageHeight - 8,
            {
                align:
                    "right"
            }
        );

    }

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

        container.innerHTML =
            `

            <div
                class="empty-state"
            >
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


    return String(
        value
    )

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
