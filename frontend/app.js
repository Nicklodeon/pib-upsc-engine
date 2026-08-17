/* =========================================================
   PIB UPSC — APP.JS
   Current Affairs Engine
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

/*
 * This always contains the articles currently
 * visible after applying filters.
 *
 * PDF generation uses this.
 */
let currentFilteredArticles = [];


/* =========================================================
   RELEVANCE
   ========================================================= */

/*
 * IMPORTANT:
 *
 * The application should ONLY display UPSC-relevant
 * articles.
 *
 * This function handles boolean, numeric and string
 * representations safely.
 */

function isRelevant(article) {

    if (!article) {
        return false;
    }

    const value =
        article.relevant;

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "TRUE" ||
        value === "True"
    ) {
        return true;
    }

    return false;
}


/*
 * Return only relevant articles.
 */

function getRelevantArticles() {

    return articles.filter(
        article =>
            isRelevant(article)
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
        getDisplayDate(
            article
        );


    if (!date) {
        return "UNKNOWN";
    }


    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}`;
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
        getArticleDate(
            article
        );


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
   GS PAPER HELPERS
   ========================================================= */

function getGsPapers(article) {

    if (
        !article ||
        !Array.isArray(
            article.gs_papers
        )
    ) {

        return [];
    }


    return article.gs_papers
        .filter(Boolean)
        .map(
            value =>
                String(value)
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
                ? data
                : [];


        articles =
            sortNewestFirst(
                articles
            );


        lastFetchTime =
            new Date();


        /*
         * Build month slicer only from
         * relevant articles.
         */

        buildMonthSlicer();


        buildFlashcards();


        renderDashboard();


        applyAllFilters();


        renderRevision();


        updateLastUpdated();


        /*
         * Keep PDF button available.
         */

        setupPDFButton();


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
     * IMPORTANT:
     * Month options only come from relevant articles.
     */

    getRelevantArticles()
        .forEach(
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

        ${months
            .map(
                (
                    [key, label]
                ) => `

                    <option
                        value="${escapeHtml(
                            key
                        )}"
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


    const exists =
        months.some(
            ([key]) =>
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


    /*
     * Update visible month heading
     * immediately after rebuilding slicer.
     */

    updateMonthHeading();
}


/* =========================================================
   MONTH HEADING
   ========================================================= */

function updateMonthHeading() {

    /*
     * Try multiple possible IDs/classes so this works
     * with the existing HTML.
     */

    const elements = [

        document.getElementById(
            "month-heading"
        ),

        document.getElementById(
            "current-month-heading"
        ),

        document.querySelector(
            ".month-heading"
        )

    ].filter(Boolean);


    if (!elements.length) {
        return;
    }


    let text =
        "ALL CURRENT AFFAIRS";


    if (
        selectedMonth &&
        selectedMonth !== "ALL"
    ) {

        text =
            getMonthLabelFromKey(
                selectedMonth
            );

    }


    elements.forEach(
        element => {

            element.textContent =
                text;

        }
    );
}


/* =========================================================
   APPLY ALL FILTERS
   ========================================================= */

function applyAllFilters() {

    /*
     * START WITH RELEVANT ARTICLES ONLY.
     *
     * This is the most important filtering layer.
     */

    let filtered =
        getRelevantArticles();


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
                    getGsPapers(
                        article
                    ).includes(gs)
            );
    }


    /*
     * RELEVANCE FILTER
     *
     * We intentionally ignore a user selecting
     * "irrelevant", because irrelevant articles
     * must NEVER appear anywhere.
     */

    const relevanceFilter =
        document.getElementById(
            "relevance-filter"
        );


    if (
        relevanceFilter &&
        relevanceFilter.value === "false"
    ) {

        filtered = [];
    }


    /*
     * Sort.
     */

    filtered =
        sortNewestFirst(
            filtered
        );


    /*
     * Save for PDF.
     */

    currentFilteredArticles =
        filtered;


    /*
     * Render.
     */

    renderArticles(
        filtered
    );


    /*
     * Update month heading.
     */

    updateMonthHeading();
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

    /*
     * Dashboard statistics should also ONLY use
     * relevant articles.
     */

    const relevantArticles =
        getRelevantArticles();


    const total =
        relevantArticles.length;


    const processed =
        relevantArticles.filter(
            article =>
                article.processed
        ).length;


    const relevant =
        total;


    const important =
        relevantArticles.filter(
            article =>
                Number(
                    article.importance ||
                    0
                ) >= 7
        ).length;


    /*
     * Average importance.
     */

    const average =
        total
            ? Math.round(
                relevantArticles.reduce(
                    (
                        sum,
                        article
                    ) =>
                        sum +
                        Number(
                            article.importance ||
                            0
                        ),
                    0
                ) / total
            )
            : 0;


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


    setText(
        "average-importance",
        average
    );


    /*
     * Recent articles:
     * ONLY relevant.
     */

    const recent =
        sortNewestFirst(
            relevantArticles
        )
        .slice(
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


    /*
     * Quick revision panel.
     */

    renderQuickRevision(
        relevantArticles
    );
}


/* =========================================================
   QUICK REVISION
   ========================================================= */

function renderQuickRevision(
    relevantArticles
) {

    const container =
        document.getElementById(
            "quick-revision"
        );


    if (!container) {
        return;
    }


    const important =
        relevantArticles
            .filter(
                article =>
                    Number(
                        article.importance ||
                        0
                    ) >= 7
            )
            .sort(
                (a, b) =>
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
                8
            );


    if (!important.length) {

        container.innerHTML = `

            <div class="empty-state">
                No high-priority articles yet.
            </div>

        `;

        return;
    }


    container.innerHTML = important
        .map(
            article => `

                <div class="quick-revision-item">

                    <span class="badge high">
                        ${Number(
                            article.importance ||
                            0
                        )}/10
                    </span>

                    <span>
                        ${escapeHtml(
                            article.english_title ||
                            article.title ||
                            "Untitled article"
                        )}
                    </span>

                </div>

            `
        )
        .join("");
}


/* =========================================================
   ARTICLE CARD
   ========================================================= */

function articleCard(article) {

    /*
     * Safety:
     * irrelevant articles should never be rendered.
     */

    if (
        !isRelevant(article)
    ) {

        return "";
    }


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


    const dateText =
        formatDate(
            date
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
                            ${escapeHtml(
                                dateText
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


                ${getGsPapers(article)
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


                <span
                    class="badge"
                >
                    Prelims
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
                        )
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
     * Safety filter.
     */

    filtered =
        (
            filtered ||
            []
        )
        .filter(
            article =>
                isRelevant(article)
        );


    if (
        filtered.length === 0
    ) {

        currentFilteredArticles =
            [];


        container.innerHTML = `

            <div
                class="empty-state"
            >
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


    currentFilteredArticles =
        filtered;


    /*
     * Group by month.
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


    /*
     * Sort month groups newest first.
     */

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

                    <section
                        class="month-section"
                    >

                        <div
                            class="month-heading"
                        >
                            ${escapeHtml(
                                selectedMonth !== "ALL"
                                    ? getMonthLabelFromKey(
                                        selectedMonth
                                    )
                                    : getMonthLabelFromKey(
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

    if (
        !isRelevant(article)
    ) {

        return "";
    }


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
                                    formatDate(
                                        date
                                    )
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


                    ${getGsPapers(article)
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


    /*
     * Do not allow irrelevant article
     * to be opened.
     */

    if (
        !isRelevant(article)
    ) {

        return;
    }


    const date =
        getDisplayDate(
            article
        );


    let html = `

        ${
            date
                ? `

                    <div
                        class="article-date"
                    >
                        ${escapeHtml(
                            formatDate(
                                date
                            )
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
                ${Number(
                    article.importance ||
                    0
                )}/10
            </span>


            ${getGsPapers(article)
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


    /*
     * ONLY relevant articles.
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
                    Process relevant PIB articles
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
                    onclick="
                        showAnswer()
                    "
                >
                    Show answer
                </button>


                <button
                    onclick="
                        nextFlashcard()
                    "
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

    /*
     * ONLY relevant.
     */

    const important =
        getRelevantArticles()
            .filter(
                article =>
                    Number(
                        article.importance ||
                        0
                    ) >= 7
            )
            .sort(
                (a, b) =>
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


    if (!important.length) {

        container.innerHTML = `

            <div class="empty-state">
                No high-priority relevant articles.
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
   GS PAPERS
   ========================================================= */

function renderGS(gs) {

    /*
     * ONLY relevant.
     */

    const filtered =
        getRelevantArticles()
            .filter(
                article =>
                    getGsPapers(
                        article
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
                    articleListItem
                )
                .join("")
            }

        </div>

    `;
}


/* =========================================================
   FILTER EVENTS
   ========================================================= */

function setupFilterEvents() {

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
}


/* =========================================================
   NAVIGATION
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
}


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


            /*
             * Search results should still respect
             * the relevance rule.
             */

            currentFilteredArticles =
                filtered;


            renderArticles(
                filtered
            );

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
}


/* =========================================================
   REFRESH
   ========================================================= */

function setupRefresh() {

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
}


/* =========================================================
   PDF — HELPERS
   ========================================================= */

let pdfFontLoaded = false;


function arrayBufferToBase64(
    buffer
) {

    let binary = "";


    const bytes =
        new Uint8Array(
            buffer
        );


    const chunkSize =
        0x8000;


    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {

        binary +=
            String.fromCharCode(
                ...bytes.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
                        bytes.length
                    )
                )
            );
    }


    return btoa(
        binary
    );
}


/* =========================================================
   LOAD PDF FONT
   ========================================================= */

async function loadPDFFont(doc) {

    if (pdfFontLoaded) {

        doc.setFont(
            "NotoSansDevanagari",
            "normal"
        );


        return true;
    }


    try {

        const response =
            await fetch(
                "/fonts/NotoSansDevanagari-Regular.ttf"
            );


        if (!response.ok) {

            throw new Error(
                `Font HTTP error: ${response.status}`
            );
        }


        const buffer =
            await response.arrayBuffer();


        const base64 =
            arrayBufferToBase64(
                buffer
            );


        doc.addFileToVFS(
            "NotoSansDevanagari-Regular.ttf",
            base64
        );


        doc.addFont(
            "NotoSansDevanagari-Regular.ttf",
            "NotoSansDevanagari",
            "normal"
        );


        pdfFontLoaded = true;


        doc.setFont(
            "NotoSansDevanagari",
            "normal"
        );


        return true;


    } catch (error) {

        console.error(
            "Unable to load PDF Unicode font:",
            error
        );


        return false;
    }
}


/* =========================================================
   PDF TEXT HELPERS
   ========================================================= */

function cleanPDFText(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)
        .replace(
            /\r\n/g,
            "\n"
        )
        .replace(
            /\r/g,
            "\n"
        )
        .trim();
}


function getPDFSummary(article) {

    return cleanPDFText(
        article.english_summary ||
        article.summary ||
        ""
    );
}


function getPDFArray(value) {

    if (
        !Array.isArray(value)
    ) {

        return [];
    }


    return value
        .map(
            item =>
                cleanPDFText(
                    item
                )
        )
        .filter(Boolean);
}


/* =========================================================
   GENERATE PDF
   ========================================================= */

async function generatePDF() {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    /*
     * ALWAYS regenerate from the currently visible
     * relevant articles.
     */

    let pdfArticles =
        (
            currentFilteredArticles ||
            []
        )
        .filter(
            article =>
                isRelevant(article)
        );


    /*
     * If there are no currently filtered articles,
     * fall back to relevant articles matching month.
     */

    if (!pdfArticles.length) {

        pdfArticles =
            getRelevantArticles();


        if (
            selectedMonth !== "ALL"
        ) {

            pdfArticles =
                pdfArticles.filter(
                    article =>
                        getMonthKey(
                            article
                        ) ===
                        selectedMonth
                );
        }


        pdfArticles =
            sortNewestFirst(
                pdfArticles
            );
    }


    if (
        !pdfArticles.length
    ) {

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
            "PDF generator is still loading. Please try again in a moment."
        );


        return;
    }


    if (button) {

        button.disabled =
            true;


        button.textContent =
            "Preparing PDF...";
    }


    try {

        const {
            jsPDF
        } =
            window.jspdf;


        const doc =
            new jsPDF({

                orientation:
                    "portrait",

                unit:
                    "mm",

                format:
                    "a4"

            });


        /*
         * Unicode font.
         */

        const fontLoaded =
            await loadPDFFont(
                doc
            );


        if (!fontLoaded) {

            throw new Error(
                "Noto Sans Devanagari font could not be loaded."
            );
        }


        doc.setFont(
            "NotoSansDevanagari",
            "normal"
        );


        const pageWidth =
            doc.internal.pageSize
                .getWidth();


        const pageHeight =
            doc.internal.pageSize
                .getHeight();


        const margin =
            15;


        const usableWidth =
            pageWidth -
            margin * 2;


        let y =
            margin;


        /* =================================================
           PDF HEADER
           ================================================= */

        doc.setFontSize(
            20
        );


        doc.setTextColor(
            25,
            28,
            32
        );


        doc.text(
            "PIB UPSC Current Affairs",
            margin,
            y
        );


        y += 8;


        let filterLabel =
            "All Relevant Articles";


        if (
            selectedMonth !==
            "ALL"
        ) {

            filterLabel =
                getMonthLabelFromKey(
                    selectedMonth
                );
        }


        doc.setFontSize(
            9
        );


        doc.setTextColor(
            105,
            110,
            118
        );


        doc.text(
            `${filterLabel} · ${pdfArticles.length} Articles`,
            margin,
            y
        );


        y += 7;


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


        /* =================================================
           ARTICLES
           ================================================= */

        pdfArticles.forEach(
            (
                article,
                index
            ) => {

                /*
                 * Page protection.
                 */

                if (
                    y >
                    pageHeight - 30
                ) {

                    doc.addPage();

                    y =
                        margin;
                }


                const title =
                    cleanPDFText(
                        article.english_title ||
                        article.title ||
                        "Untitled Article"
                    );


                const date =
                    formatDate(
                        getDisplayDate(
                            article
                        )
                    );


                const importance =
                    Number(
                        article.importance ||
                        0
                    );


                const gs =
                    getGsPapers(
                        article
                    )
                    .join(
                        ", "
                    );


                /*
                 * TITLE
                 */

                doc.setFontSize(
                    13
                );


                doc.setTextColor(
                    25,
                    28,
                    32
                );


                const titleLines =
                    doc.splitTextToSize(
                        `${index + 1}. ${title}`,
                        usableWidth
                    );


                doc.text(
                    titleLines,
                    margin,
                    y
                );


                y +=
                    titleLines.length *
                    5 +
                    3;


                /*
                 * METADATA
                 */

                doc.setFontSize(
                    8.5
                );


                doc.setTextColor(
                    100,
                    106,
                    115
                );


                const metadata =
                    [
                        date,
                        `${importance}/10`,
                        gs
                    ]
                    .filter(Boolean)
                    .join(
                        " · "
                    );


                if (metadata) {

                    doc.text(
                        metadata,
                        margin,
                        y
                    );


                    y += 6;
                }


                /*
                 * SUMMARY
                 */

                const summary =
                    getPDFSummary(
                        article
                    );


                if (summary) {

                    if (
                        y >
                        pageHeight - 35
                    ) {

                        doc.addPage();

                        y =
                            margin;
                    }


                    doc.setFontSize(
                        9
                    );


                    doc.setTextColor(
                        30,
                        33,
                        38
                    );


                    doc.text(
                        "Summary",
                        margin,
                        y
                    );


                    y += 4;


                    doc.setFontSize(
                        8.5
                    );


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
                        summaryLines.length *
                        4 +
                        6;
                }


                /*
                 * UPSC SECTIONS
                 */

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
                            sectionTitle,
                            rawValues
                        ]
                    ) => {

                        const values =
                            getPDFArray(
                                rawValues
                            );


                        if (
                            !values.length
                        ) {

                            return;
                        }


                        if (
                            y >
                            pageHeight - 35
                        ) {

                            doc.addPage();

                            y =
                                margin;
                        }


                        doc.setFontSize(
                            9
                        );


                        doc.setTextColor(
                            30,
                            33,
                            38
                        );


                        doc.text(
                            sectionTitle,
                            margin,
                            y
                        );


                        y += 5;


                        doc.setFontSize(
                            8.2
                        );


                        doc.setTextColor(
                            75,
                            80,
                            88
                        );


                        values
                            .slice(
                                0,
                                8
                            )
                            .forEach(
                                value => {

                                    const bullet =
                                        `• ${value}`;


                                    const lines =
                                        doc.splitTextToSize(
                                            bullet,
                                            usableWidth - 2
                                        );


                                    const requiredHeight =
                                        lines.length *
                                        3.8 +
                                        3;


                                    if (
                                        y +
                                        requiredHeight >
                                        pageHeight - 18
                                    ) {

                                        doc.addPage();

                                        y =
                                            margin;
                                    }


                                    doc.text(
                                        lines,
                                        margin + 1,
                                        y
                                    );


                                    y +=
                                        requiredHeight;
                                }
                            );


                        y += 3;
                    }
                );


                /*
                 * ORIGINAL PIB LINK TEXT
                 */

                if (
                    article.link
                ) {

                    if (
                        y >
                        pageHeight - 25
                    ) {

                        doc.addPage();

                        y =
                            margin;
                    }


                    doc.setFontSize(
                        7.5
                    );


                    doc.setTextColor(
                        65,
                        100,
                        160
                    );


                    doc.text(
                        "Original PIB release available online",
                        margin,
                        y
                    );


                    y += 6;
                }


                /*
                 * ARTICLE DIVIDER
                 */

                if (
                    y >
                    pageHeight - 20
                ) {

                    doc.addPage();

                    y =
                        margin;

                } else {

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

            }
        );


        /* =================================================
           FOOTERS
           ================================================= */

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
                "NotoSansDevanagari",
                "normal"
            );


            doc.setFontSize(
                7
            );


            doc.setTextColor(
                145,
                149,
                155
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


        /* =================================================
           SAVE
           ================================================= */

        const filename =
            selectedMonth === "ALL"
                ? "PIB_UPSC_Current_Affairs.pdf"
                : `PIB_UPSC_${selectedMonth}.pdf`;


        doc.save(
            filename
        );


    } catch (error) {

        console.error(
            "PDF generation failed:",
            error
        );


        alert(
            "PDF generation failed. Check that NotoSansDevanagari-Regular.ttf is present inside /fonts."
        );


    } finally {

        if (button) {

            button.disabled =
                false;


            button.textContent =
                "Download PDF";
        }
    }
}


/* =========================================================
   PDF BUTTON
   ========================================================= */

function setupPDFButton() {

    const button =
        document.getElementById(
            "download-pdf-btn"
        );


    if (!button) {
        return;
    }


    /*
     * Prevent duplicate event listeners.
     */

    if (
        button.dataset.pdfReady ===
        "true"
    ) {

        return;
    }


    button.dataset.pdfReady =
        "true";


    button.addEventListener(
        "click",
        generatePDF
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

    setupFilterEvents();

    setupNavigation();

    setupSearch();

    setupModal();

    setupRefresh();

    setupPDFButton();

    loadArticles();
}


/*
 * If app.js is loaded at the bottom of body,
 * DOMContentLoaded may already have happened.
 */

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
