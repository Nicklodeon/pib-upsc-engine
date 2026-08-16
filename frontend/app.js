const SUPABASE_URL =
    "https://gmytscoqupsozionnryy.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_dpY7xVY8df2CqDfoT9rTFg_PGpgpWNF";

const { createClient } = supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let articles = [];
let flashcards = [];
let currentFlashcard = 0;


/* ==================================================
   LOAD DATA
================================================== */

async function loadArticles() {

    console.log("Loading articles...");

    const {
        data,
        error
    } = await db
        .from("articles")
        .select("*")
        .eq("relevant", true)
        .gte("importance", 7)
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

        alert(
            "Unable to load articles. Check the browser console."
        );

        return;
    }

    console.log(
        "Articles loaded:",
        data
    );

    articles = data || [];

    buildFlashcards();

    renderDashboard();

    renderArticles();

    renderRevision();
}


/* ==================================================
   DASHBOARD
================================================== */

function renderDashboard() {

    const total =
        articles.length;

    const processed =
        articles.filter(
            article =>
                article.processed
        ).length;

    const relevant =
        articles.filter(
            article =>
                article.relevant
        ).length;

    const important =
        articles.filter(
            article =>
                article.importance &&
                article.importance >= 7
        ).length;


    const heroCount =
        document.getElementById(
            "hero-count"
        );

    if (heroCount) {
        heroCount.textContent = total;
    }


    const totalCount =
        document.getElementById(
            "total-count"
        );

    if (totalCount) {
        totalCount.textContent = total;
    }


    const processedCount =
        document.getElementById(
            "processed-count"
        );

    if (processedCount) {
        processedCount.textContent =
            processed;
    }


    const relevantCount =
        document.getElementById(
            "relevant-count"
        );

    if (relevantCount) {
        relevantCount.textContent =
            relevant;
    }


    const importantCount =
        document.getElementById(
            "important-count"
        );

    if (importantCount) {
        importantCount.textContent =
            important;
    }


    const recent =
        articles.slice(0, 6);

    const recentContainer =
        document.getElementById(
            "recent-articles"
        );

    if (recentContainer) {

        recentContainer.innerHTML =
            recent
                .map(articleCard)
                .join("");
    }
}


/* ==================================================
   ARTICLE CARD
================================================== */

function articleCard(article) {

    const importance =
        article.importance || 0;


    const priority =
        importance >= 9
            ? "high"
            : importance >= 7
                ? "medium"
                : "low";


    const gs =
        (article.gs_papers || [])
            .slice(0, 2)
            .join(" · ");


    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    const summary =
        article.english_summary ||
        "";


    return `
        <article class="article-card">

            <div class="article-meta">

                <span class="article-date">
                    ${formatDate(
                        article.published_at
                    )}
                </span>

                <span class="badge ${priority}">
                    ${importance}/10
                </span>

                ${
                    gs
                        ? `<span class="badge">
                            ${escapeHtml(gs)}
                           </span>`
                        : ""
                }

            </div>


            <h4>
                ${escapeHtml(title)}
            </h4>


            ${
                summary
                    ? `<p>
                        ${escapeHtml(
                            summary.slice(0, 180)
                        )}
                       </p>`
                    : `
                        <p>
                            ${(article.topics || [])
                                .slice(0, 2)
                                .join(" · ")}
                        </p>
                    `
            }


            <button
                onclick="openArticle(${article.id})"
            >
                Read analysis →
            </button>

        </article>
    `;
}


/* ==================================================
   ARTICLES
================================================== */

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


    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-state">
                No UPSC-relevant articles found.
            </div>
        `;

        return;
    }


    const groups = {};


    filtered.forEach(
        article => {

            const month =
                monthYear(
                    article.published_at
                );


            if (!groups[month]) {

                groups[month] = [];
            }


            groups[month].push(
                article
            );
        }
    );


    container.innerHTML =
        Object.entries(groups)
            .map(
                (
                    [
                        month,
                        monthArticles
                    ]
                ) => `

                    <div class="month-section">

                        <div class="month-heading">
                            ${escapeHtml(month)}
                        </div>

                        <div class="article-list">

                            ${monthArticles
                                .map(
                                    articleListItem
                                )
                                .join("")}

                        </div>

                    </div>

                `
            )
            .join("");
}


/* ==================================================
   ARTICLE LIST ITEM
================================================== */

function articleListItem(article) {

    const importance =
        article.importance || 0;


    const priority =
        importance >= 9
            ? "high"
            : importance >= 7
                ? "medium"
                : "low";


    const title =
        article.english_title ||
        article.title ||
        "Untitled article";


    return `
        <article class="list-item">

            <div>

                <div class="article-meta">

                    <span class="article-date">
                        ${formatDate(
                            article.published_at
                        )}
                    </span>

                    <span class="badge ${priority}">
                        ${importance}/10
                    </span>

                    ${
                        (article.gs_papers || [])
                            .map(
                                gs =>
                                    `<span class="badge">
                                        ${escapeHtml(gs)}
                                    </span>`
                            )
                            .join("")
                    }

                </div>


                <h4>
                    ${escapeHtml(title)}
                </h4>


                ${
                    article.english_summary
                        ? `<p>
                            ${escapeHtml(
                                article.english_summary
                            )}
                           </p>`
                        : `
                            <p>
                                ${(article.topics || [])
                                    .join(" · ")}
                            </p>
                        `
                }

            </div>


            <button
                class="text-button"
                onclick="openArticle(${article.id})"
            >
                Read →
            </button>

        </article>
    `;
}


/* ==================================================
   ARTICLE DETAIL
================================================== */

function openArticle(id) {

    const article =
        articles.find(
            a => a.id === id
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


    let html = `

        <div class="article-meta">

            <span class="article-date">
                ${formatDate(
                    article.published_at
                )}
            </span>

            <span class="badge high">
                Importance
                ${article.importance || 0}/10
            </span>

            ${
                (article.gs_papers || [])
                    .map(
                        gs =>
                            `<span class="badge">
                                ${escapeHtml(gs)}
                            </span>`
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


        ${
            article.topics &&
            article.topics.length
                ? `
                    <div class="detail-section">

                        <h4>
                            Topics
                        </h4>

                        <p>
                            ${escapeHtml(
                                article.topics.join(
                                    " · "
                                )
                            )}
                        </p>

                    </div>
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
                !values ||
                values.length === 0
            ) {
                return;
            }


            html += `

                <div class="detail-section">

                    <h4>
                        ${title}
                    </h4>

                    <ul>

                        ${values
                            .map(
                                item =>
                                    `<li>
                                        ${escapeHtml(
                                            item
                                        )}
                                    </li>`
                            )
                            .join("")}

                    </ul>

                </div>

            `;
        }
    );


    if (article.keywords &&
        article.keywords.length) {

        html += `

            <div class="detail-section">

                <h4>
                    Keywords
                </h4>

                <p>
                    ${escapeHtml(
                        article.keywords.join(
                            " · "
                        )
                    )}
                </p>

            </div>

        `;
    }


    if (article.link) {

        html += `

            <div class="detail-section">

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


    if (detail) {

        detail.innerHTML =
            html;
    }


    const modal =
        document.getElementById(
            "article-modal"
        );


    if (modal) {

        modal.classList.remove(
            "hidden"
        );
    }
}


/* ==================================================
   FLASHCARDS
================================================== */

function buildFlashcards() {

    flashcards = [];


    articles.forEach(
        article => {

            if (
                !article.flashcards
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
                    card.type || "Concept"
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


/* ==================================================
   REVISION
================================================== */

function renderRevision() {

    const important =
        articles
            .filter(
                article =>
                    article.importance >= 7 &&
                    article.relevant
            )
            .sort(
                (a, b) =>
                    b.importance -
                    a.importance
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


/* ==================================================
   GS FILTER
================================================== */

function renderGS(gs) {

    const filtered =
        articles.filter(
            article =>
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

            ${filtered
                .map(
                    articleListItem
                )
                .join("")}

        </div>

    `;
}


/* ==================================================
   NAVIGATION
================================================== */

function showView(view) {

    document.querySelectorAll(
        ".view"
    ).forEach(
        element =>
            element.classList.remove(
                "active-view"
            )
    );


    const selectedView =
        document.getElementById(
            `${view}-view`
        );


    if (selectedView) {

        selectedView.classList.add(
            "active-view"
        );
    }


    document.querySelectorAll(
        ".nav-item"
    ).forEach(
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


    const pageTitle =
        document.getElementById(
            "page-title"
        );


    if (pageTitle) {

        pageTitle.textContent =
            titles[view] ||
            "Dashboard";
    }
}


/* ==================================================
   SEARCH
================================================== */

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

                renderArticles();

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


                        const originalTitle =
                            (
                                article.title ||
                                ""
                            )
                                .toLowerCase();


                        const rawText =
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
                            originalTitle.includes(query) ||
                            rawText.includes(query) ||
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


/* ==================================================
   FILTERS
================================================== */

const importanceFilter =
    document.getElementById(
        "importance-filter"
    );


if (importanceFilter) {

    importanceFilter.addEventListener(
        "change",
        applyFilters
    );
}


const gsFilter =
    document.getElementById(
        "gs-filter"
    );


if (gsFilter) {

    gsFilter.addEventListener(
        "change",
        applyFilters
    );
}


const relevanceFilter =
    document.getElementById(
        "relevance-filter"
    );


if (relevanceFilter) {

    relevanceFilter.addEventListener(
        "change",
        applyFilters
    );
}


function applyFilters() {

    const importanceElement =
        document.getElementById(
            "importance-filter"
        );


    const gsElement =
        document.getElementById(
            "gs-filter"
        );


    const relevanceElement =
        document.getElementById(
            "relevance-filter"
        );


    const importance =
        importanceElement
            ? importanceElement.value
            : "";


    const gs =
        gsElement
            ? gsElement.value
            : "";


    const relevance =
        relevanceElement
            ? relevanceElement.value
            : "";


    let filtered =
        [...articles];


    if (importance) {

        const min =
            Number(
                importance
            );


        const max =
            min === 9
                ? 10
                : min === 7
                    ? 8
                    : min === 4
                        ? 6
                        : 3;


        filtered =
            filtered.filter(
                article =>
                    article.importance >= min &&
                    article.importance <= max
            );
    }


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


    if (relevance) {

        filtered =
            filtered.filter(
                article =>
                    String(
                        article.relevant
                    ) === relevance
            );
    }


    renderArticles(
        filtered
    );
}


/* ==================================================
   HELPERS
================================================== */

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


function formatDate(
    dateValue
) {

    if (!dateValue) {

        return "Date unavailable";
    }


    const date =
        new Date(
            dateValue
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Date unavailable";
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


function monthYear(
    dateValue
) {

    if (!dateValue) {

        return "DATE UNAVAILABLE";
    }


    const date =
        new Date(
            dateValue
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "DATE UNAVAILABLE";
    }


    return date
        .toLocaleDateString(
            "en-IN",
            {
                month:
                    "long",

                year:
                    "numeric"
            }
        )
        .toUpperCase();
}


/* ==================================================
   EVENTS
================================================== */

document.querySelectorAll(
    ".nav-item"
).forEach(
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


document.querySelectorAll(
    "[data-view]"
).forEach(
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


document.querySelectorAll(
    ".gs-card"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                showView(
                    "gs"
                );

                renderGS(
                    button.dataset.gs
                );

            }
        );

    }
);


/* ==================================================
   MODAL
================================================== */

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


/* ==================================================
   REFRESH BUTTON
================================================== */

const refreshButton =
    document.getElementById(
        "refresh-btn"
    );


if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        async () => {

            refreshButton.disabled =
                true;


            try {

                await loadArticles();

            } finally {

                refreshButton.disabled =
                    false;
            }

        }
    );
}


/* ==================================================
   START APPLICATION
================================================== */

loadArticles();
