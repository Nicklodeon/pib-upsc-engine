/* =========================================================
   PIB UPSC — APP.JS
   Current Affairs Engine
   ========================================================= */

const SUPABASE_URL =
    "https://gmytscoqupsozionnryy.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_dpY7xVY8df2CqDfoT9rTFg_PGpgwNWF";

const { createClient } = supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let articles = [];
let relevantArticles = [];
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

        if (!value) continue;

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

    const date = getDisplayDate(article);

    if (!date) {
        return "UNKNOWN";
    }

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}`;
}


function getMonthLabelFromKey(key) {

    if (!key || key === "UNKNOWN") {
        return "CURRENT AFFAIRS";
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
   SORTING
   ========================================================= */

function articleTimestamp(article) {

    const date = getArticleDate(article);

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
   RELEVANCE
   ========================================================= */

/*
 * IMPORTANT:
 *
 * Only articles explicitly marked relevant are allowed
 * anywhere in the user-facing application.
 *
 * This handles:
 * true
 * "true"
 * 1
 * "1"
 *
 * Everything else is treated as irrelevant.
 */

function isRelevant(article) {

    if (!article) {
        return false;
    }

    const value = article.relevant;

    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true"
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
                ? data
                : [];

        articles =
            sortNewestFirst(
                articles
            );


        /*
         * CRITICAL:
         *
         * From this point onwards, only relevant
         * articles are used by the application.
         */

        relevantArticles =
            articles.filter(
                isRelevant
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
     * ONLY relevant articles contribute
     * to the month slicer.
     */

    relevantArticles.forEach(
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
            (
                a,
                b
            ) =>
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
                        value="${escapeHtml(key)}"
                    >
                        ${escapeHtml(label)}
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

    } else {

        select.value =
            "ALL";

        selectedMonth =
            "ALL";
    }


    updateDynamicMonthHeading();
}


/* =========================================================
   DYNAMIC MONTH HEADING
   ========================================================= */

function updateDynamicMonthHeading() {

    /*
     * Try multiple possible IDs so this works
     * with the existing HTML structure.
     */

    const possibleIds = [
        "month-heading",
        "current-month-heading",
        "articles-month-heading"
    ];

    let element = null;

    for (const id of possibleIds) {

        const candidate =
            document.getElementById(id);

        if (candidate) {
            element = candidate;
            break;
        }
    }

    /*
     * Also support a class-based heading.
     */

    if (!element) {

        element =
            document.querySelector(
                ".month-heading"
            );
    }


    if (!element) {
        return;
    }


    if (selectedMonth === "ALL") {

        element.textContent =
            "ALL CURRENT AFFAIRS";

        return;
    }


    element.textContent =
        getMonthLabelFromKey(
            selectedMonth
        );
}


/* =========================================================
   APPLY ALL FILTERS
   ========================================================= */

function applyAllFilters() {

    /*
     * START WITH RELEVANT ARTICLES ONLY.
     */

    let filtered =
        [...relevantArticles];


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
                article =>
                    (
                        article.importance ||
                        0
                    ) >= min &&
                    (
                        article.importance ||
                        0
                    ) <= max
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
                    ).includes(gs)
            );
    }


    /*
     * RELEVANCE
     *
     * The relevance filter is intentionally
     * ignored because irrelevant articles must
     * NEVER appear anywhere in the application.
     */


    updateDynamicMonthHeading();

    renderArticles(
        filtered
    );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

    /*
     * ALL DASHBOARD NUMBERS ARE BASED ON
     * RELEVANT ARTICLES ONLY.
     */

    const total =
        relevantArticles.length;


    const processed =
        relevantArticles.filter(
            article =>
                article.processed
        ).length;


    const important =
        relevantArticles.filter(
            article =>
                (
                    article.importance ||
                    0
                ) >= 7
        ).length;


    const averageImportance =
        total > 0
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
        total
    );

    setText(
        "important-count",
        important
    );

    setText(
        "average-importance",
        averageImportance
    );


    /*
     * Recent articles.
     */

    const recent =
        relevantArticles.slice(
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

    /*
     * Safety guard.
     */

    if (!isRelevant(article)) {
        return "";
    }


    const importance =
        article.importance || 0;


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

function renderArticles(filtered) {

    const container =
        document.getElementById(
            "articles-list"
        );


    if (!container) {
        return;
    }


    /*
     * SECOND SAFETY FILTER.
     *
     * Even if another function passes all articles,
     * irrelevant ones are removed here.
     */

    filtered =
        (
            Array.isArray(filtered)
                ? filtered
                : []
        )
        .filter(
            isRelevant
        );


    if (
        filtered.length === 0
    ) {

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


    const sortedGroups =
        Array.from(
            groups.entries()
        )
        .sort(
            (
                a,
                b
            ) =>
                b[0].localeCompare(
                    a[0]
                )
        );


    /*
     * When a month is selected, show only
     * that month's article list without creating
     * another unwanted heading.
     */

    if (
        selectedMonth !==
        "ALL"
    ) {

        const monthArticles =
            filtered;


        container.innerHTML = `

            <section
                class="month-section"
            >

                <div
                    class="month-heading"
                >
                    ${escapeHtml(
                        getMonthLabelFromKey(
                            selectedMonth
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

        `;

        return;
    }


    /*
     * ALL MONTHS
     */

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

    /*
     * Never render irrelevant articles.
     */

    if (!isRelevant(article)) {
        return "";
    }


    const importance =
        article.importance || 0;


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
        relevantArticles.find(
            item =>
                String(
                    item.id
                ) ===
                String(id)
        );


    /*
     * Irrelevant articles cannot be opened.
     */

    if (
        !article ||
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
                ${article.importance || 0}/10
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
     * Flashcards only from relevant articles.
     */

    relevantArticles.forEach(
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
                    Process more relevant PIB
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

    const important =
        relevantArticles
            .filter(
                article =>
                    (
                        article.importance ||
                        0
                    ) >= 7
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    (
                        b.importance ||
                        0
                    ) -
                    (
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

    const filtered =
        relevantArticles.filter(
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

document.addEventListener(
    "DOMContentLoaded",
    () => {

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

                    updateDynamicMonthHeading();

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


        /*
         * Navigation
         */

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


        /*
         * Search
         */

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
                        relevantArticles.filter(
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


                    renderArticles(
                        filtered
                    );

                }
            );
        }


        /*
         * Modal
         */

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


        /*
         * Refresh
         */

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


        /*
         * PDF BUTTON
         */

        setupPDFButton();

    }
);


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
}


/* =========================================================
   PDF GENERATION
   ========================================================= */

/*
 * jsPDF requires a real Unicode TTF font for Hindi.
 *
 * We first try the local Vercel file.
 * If it doesn't exist, we fetch Noto Sans Devanagari
 * from GitHub/jsDelivr.
 */

let pdfFontLoaded = false;


const PDF_FONT_NAME =
    "NotoSansDevanagari";


const PDF_FONT_FILE =
    "NotoSansDevanagari-Regular.ttf";


async function loadPDFFont(doc) {

    if (pdfFontLoaded) {

        doc.setFont(
            PDF_FONT_NAME,
            "normal"
        );

        return true;
    }


    const fontUrls = [

        /*
         * Preferred local font.
         */

        "/fonts/NotoSansDevanagari-Regular.ttf",


        /*
         * GitHub raw fallback.
         */

        "https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",


        /*
         * jsDelivr fallback.
         */

        "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"

    ];


    for (
        const url of fontUrls
    ) {

        try {

            console.log(
                "Trying PDF font:",
                url
            );


            const response =
                await fetch(
                    url,
                    {
                        mode: "cors",
                        cache: "force-cache"
                    }
                );


            if (!response.ok) {

                console.warn(
                    "Font request failed:",
                    response.status,
                    url
                );

                continue;
            }


            const buffer =
                await response.arrayBuffer();


            if (
                !buffer ||
                buffer.byteLength < 10000
            ) {

                console.warn(
                    "Invalid font file:",
                    url
                );

                continue;
            }


            const base64 =
                arrayBufferToBase64(
                    buffer
                );


            doc.addFileToVFS(
                PDF_FONT_FILE,
                base64
            );


            doc.addFont(
                PDF_FONT_FILE,
                PDF_FONT_NAME,
                "normal"
            );


            doc.setFont(
                PDF_FONT_NAME,
                "normal"
            );


            pdfFontLoaded = true;


            console.log(
                "Unicode PDF font loaded successfully."
            );


            return true;

        } catch (error) {

            console.warn(
                "Could not load PDF font:",
                url,
                error
            );

        }
    }


    return false;
}


/* =========================================================
   ARRAY BUFFER → BASE64
   ========================================================= */

function arrayBufferToBase64(buffer) {

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
   PDF BUTTON SETUP
   ========================================================= */

function setupPDFButton() {

    const button =
        document.getElementById(
            "download-pdf"
        );


    if (!button) {

        console.warn(
            "PDF button #download-pdf was not found."
        );

        return;
    }


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
        generateCurrentAffairsPDF
    );
}


/* =========================================================
   GET ARTICLES FOR PDF
   ========================================================= */

function getPDFArticles() {

    let filtered =
        [...relevantArticles];


    /*
     * Month filter.
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
     * Importance filter.
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
                article =>
                    (
                        article.importance ||
                        0
                    ) >= min &&
                    (
                        article.importance ||
                        0
                    ) <= max
            );
    }


    /*
     * GS Paper filter.
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
                    ).includes(gs)
            );
    }


    /*
     * Final safety filter.
     */

    return sortNewestFirst(
        filtered.filter(
            isRelevant
        )
    );
}


/* =========================================================
   PDF HELPERS
   ========================================================= */

function pdfCleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    if (Array.isArray(value)) {

        return value
            .map(
                item =>
                    pdfCleanText(
                        item
                    )
            )
            .filter(Boolean)
            .join(" • ");
    }


    return String(value)
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


function pdfArray(value) {

    if (
        !Array.isArray(value)
    ) {
        return [];
    }


    return value
        .map(
            item =>
                pdfCleanText(
                    item
                )
        )
        .filter(Boolean);
}


function addPDFWrappedText(
    doc,
    text,
    x,
    y,
    maxWidth,
    lineHeight
) {

    const lines =
        doc.splitTextToSize(
            pdfCleanText(
                text
            ),
            maxWidth
        );


    doc.text(
        lines,
        x,
        y
    );


    return (
        y +
        (
            lines.length *
            lineHeight
        )
    );
}


function checkPDFPage(
    doc,
    y,
    requiredSpace
) {

    const pageHeight =
        doc.internal.pageSize
            .getHeight();


    if (
        y + requiredSpace >
        pageHeight - 18
    ) {

        doc.addPage();

        return 18;
    }


    return y;
}


/* =========================================================
   GENERATE PDF
   ========================================================= */

async function generateCurrentAffairsPDF() {

    const button =
        document.getElementById(
            "download-pdf"
        );


    const originalText =
        button
            ? button.textContent
            : "";


    try {

        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Generating...";
        }


        /*
         * Check jsPDF.
         */

        if (
            typeof window.jspdf ===
            "undefined"
        ) {

            throw new Error(
                "jsPDF is not loaded."
            );
        }


        const {
            jsPDF
        } =
            window.jspdf;


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


        /*
         * Create portrait A4 PDF.
         */

        const doc =
            new jsPDF(
                {
                    orientation: "portrait",
                    unit: "mm",
                    format: "a4"
                }
            );


        /*
         * Load Unicode font.
         */

        const fontLoaded =
            await loadPDFFont(
                doc
            );


        if (!fontLoaded) {

            throw new Error(
                "Unable to load the Unicode PDF font."
            );
        }


        /*
         * PDF dimensions.
         */

        const pageWidth =
            doc.internal.pageSize
                .getWidth();


        const pageHeight =
            doc.internal.pageSize
                .getHeight();


        const margin =
            16;


        const contentWidth =
            pageWidth -
            margin * 2;


        let y = 18;


        /*
         * Header.
         */

        doc.setFont(
            PDF_FONT_NAME,
            "normal"
        );


        doc.setFontSize(
            20
        );


        doc.setFont(
            PDF_FONT_NAME,
            "normal"
        );


        doc.text(
            "PIB UPSC — Current Affairs",
            margin,
            y
        );


        y += 8;


        doc.setFontSize(
            9
        );


        const period =
            selectedMonth === "ALL"
                ? "All relevant current affairs"
                : getMonthLabelFromKey(
                    selectedMonth
                );


        doc.text(
            period,
            margin,
            y
        );


        y += 4;


        doc.text(
            `Articles: ${pdfArticles.length}`,
            margin,
            y
        );


        y += 10;


        /*
         * Divider.
         */

        doc.line(
            margin,
            y,
            pageWidth - margin,
            y
        );


        y += 8;


        /*
         * Articles.
         */

        pdfArticles.forEach(
            (
                article,
                index
            ) => {

                y =
                    checkPDFPage(
                        doc,
                        y,
                        30
                    );


                /*
                 * Article title.
                 */

                doc.setFontSize(
                    13
                );


                const title =
                    pdfCleanText(
                        article.english_title ||
                        article.title ||
                        "Untitled article"
                    );


                y =
                    addPDFWrappedText(
                        doc,
                        title,
                        margin,
                        y,
                        contentWidth,
                        6
                    );


                y += 2;


                /*
                 * Metadata.
                 */

                doc.setFontSize(
                    8
                );


                const date =
                    formatDate(
                        getDisplayDate(
                            article
                        )
                    );


                const importance =
                    article.importance ||
                    0;


                const papers =
                    (
                        article.gs_papers ||
                        []
                    ).join(
                        ", "
                    );


                const metadata =
                    [
                        date,
                        `${importance}/10`,
                        papers
                    ]
                        .filter(Boolean)
                        .join(
                            " • "
                        );


                y =
                    addPDFWrappedText(
                        doc,
                        metadata,
                        margin,
                        y,
                        contentWidth,
                        4
                    );


                y += 4;


                /*
                 * Summary.
                 */

                const summary =
                    pdfCleanText(
                        article.english_summary ||
                        (
                            article.topics ||
                            []
                        ).join(
                            " • "
                        )
                    );


                if (summary) {

                    doc.setFontSize(
                        9
                    );


                    y =
                        addPDFWrappedText(
                            doc,
                            summary,
                            margin,
                            y,
                            contentWidth,
                            4.5
                        );


                    y += 4;
                }


                /*
                 * Prelims.
                 */

                const prelims =
                    pdfArray(
                        article.prelims_facts
                    );


                if (
                    prelims.length > 0
                ) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            15
                        );


                    doc.setFontSize(
                        10
                    );


                    doc.text(
                        "Prelims Facts",
                        margin,
                        y
                    );


                    y += 5;


                    doc.setFontSize(
                        8.5
                    );


                    prelims
                        .slice(
                            0,
                            8
                        )
                        .forEach(
                            item => {

                                y =
                                    checkPDFPage(
                                        doc,
                                        y,
                                        8
                                    );


                                const bullet =
                                    `• ${item}`;


                                y =
                                    addPDFWrappedText(
                                        doc,
                                        bullet,
                                        margin + 2,
                                        y,
                                        contentWidth - 2,
                                        4.2
                                    );


                                y += 1.5;

                            }
                        );


                    y += 2;
                }


                /*
                 * Mains notes.
                 */

                const mains =
                    pdfArray(
                        article.mains_notes
                    );


                if (
                    mains.length > 0
                ) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            15
                        );


                    doc.setFontSize(
                        10
                    );


                    doc.text(
                        "Mains Notes",
                        margin,
                        y
                    );


                    y += 5;


                    doc.setFontSize(
                        8.5
                    );


                    mains
                        .slice(
                            0,
                            6
                        )
                        .forEach(
                            item => {

                                y =
                                    checkPDFPage(
                                        doc,
                                        y,
                                        8
                                    );


                                y =
                                    addPDFWrappedText(
                                        doc,
                                        `• ${item}`,
                                        margin + 2,
                                        y,
                                        contentWidth - 2,
                                        4.2
                                    );


                                y += 1.5;

                            }
                        );


                    y += 2;
                }


                /*
                 * Important data.
                 */

                const dataPoints =
                    pdfArray(
                        article.data_points
                    );


                if (
                    dataPoints.length > 0
                ) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            15
                        );


                    doc.setFontSize(
                        10
                    );


                    doc.text(
                        "Important Data",
                        margin,
                        y
                    );


                    y += 5;


                    doc.setFontSize(
                        8.5
                    );


                    dataPoints
                        .slice(
                            0,
                            6
                        )
                        .forEach(
                            item => {

                                y =
                                    checkPDFPage(
                                        doc,
                                        y,
                                        8
                                    );


                                y =
                                    addPDFWrappedText(
                                        doc,
                                        `• ${item}`,
                                        margin + 2,
                                        y,
                                        contentWidth - 2,
                                        4.2
                                    );


                                y += 1.5;

                            }
                        );


                    y += 2;
                }


                /*
                 * Schemes.
                 */

                const schemes =
                    pdfArray(
                        article.schemes
                    );


                if (
                    schemes.length > 0
                ) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            15
                        );


                    doc.setFontSize(
                        10
                    );


                    doc.text(
                        "Schemes / Programmes",
                        margin,
                        y
                    );


                    y += 5;


                    doc.setFontSize(
                        8.5
                    );


                    schemes
                        .slice(
                            0,
                            6
                        )
                        .forEach(
                            item => {

                                y =
                                    checkPDFPage(
                                        doc,
                                        y,
                                        8
                                    );


                                y =
                                    addPDFWrappedText(
                                        doc,
                                        `• ${item}`,
                                        margin + 2,
                                        y,
                                        contentWidth - 2,
                                        4.2
                                    );


                                y += 1.5;

                            }
                        );


                    y += 2;
                }


                /*
                 * Implications.
                 */

                const implications =
                    pdfArray(
                        article.implications
                    );


                if (
                    implications.length > 0
                ) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            15
                        );


                    doc.setFontSize(
                        10
                    );


                    doc.text(
                        "Implications",
                        margin,
                        y
                    );


                    y += 5;


                    doc.setFontSize(
                        8.5
                    );


                    implications
                        .slice(
                            0,
                            6
                        )
                        .forEach(
                            item => {

                                y =
                                    checkPDFPage(
                                        doc,
                                        y,
                                        8
                                    );


                                y =
                                    addPDFWrappedText(
                                        doc,
                                        `• ${item}`,
                                        margin + 2,
                                        y,
                                        contentWidth - 2,
                                        4.2
                                    );


                                y += 1.5;

                            }
                        );


                    y += 2;
                }


                /*
                 * UPSC questions.
                 */

                const questions =
                    pdfArray(
                        article.possible_questions
                    );


                if (
                    questions.length > 0
                ) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            15
                        );


                    doc.setFontSize(
                        10
                    );


                    doc.text(
                        "Possible UPSC Questions",
                        margin,
                        y
                    );


                    y += 5;


                    doc.setFontSize(
                        8.5
                    );


                    questions
                        .slice(
                            0,
                            5
                        )
                        .forEach(
                            item => {

                                y =
                                    checkPDFPage(
                                        doc,
                                        y,
                                        8
                                    );


                                y =
                                    addPDFWrappedText(
                                        doc,
                                        `• ${item}`,
                                        margin + 2,
                                        y,
                                        contentWidth - 2,
                                        4.2
                                    );


                                y += 1.5;

                            }
                        );


                    y += 2;
                }


                /*
                 * Original PIB link.
                 */

                if (article.link) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            12
                        );


                    doc.setFontSize(
                        8
                    );


                    doc.text(
                        "Original PIB release:",
                        margin,
                        y
                    );


                    y += 4;


                    /*
                     * URLs are often ASCII and may not
                     * render elegantly with the Devanagari
                     * font, so use a safe shortened label.
                     */

                    doc.text(
                        pdfCleanText(
                            article.link
                        ).slice(
                            0,
                            120
                        ),
                        margin,
                        y
                    );


                    y += 5;
                }


                /*
                 * Article separator.
                 */

                if (
                    index <
                    pdfArticles.length - 1
                ) {

                    y =
                        checkPDFPage(
                            doc,
                            y,
                            8
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


        /*
         * Page numbers.
         */

        const pageCount =
            doc.getNumberOfPages();


        for (
            let page = 1;
            page <= pageCount;
            page++
        ) {

            doc.setPage(
                page
            );


            doc.setFontSize(
                7
            );


            doc.text(
                `PIB UPSC • Page ${page} of ${pageCount}`,
                pageWidth / 2,
                pageHeight - 8,
                {
                    align: "center"
                }
            );
        }


        /*
         * Filename.
         */

        const filename =
            selectedMonth === "ALL"
                ? "PIB-UPSC-Current-Affairs.pdf"
                : `PIB-UPSC-${selectedMonth}.pdf`;


        doc.save(
            filename
        );


    } catch (error) {

        console.error(
            "PDF generation error:",
            error
        );


        alert(
            "PDF generation failed. " +
            "Please check that jsPDF is loaded " +
            "and the Unicode font can be accessed."
        );

    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                originalText ||
                "↓ Download PDF";
        }
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

loadArticles();
