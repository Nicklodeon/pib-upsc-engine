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
   DATE HELPERS
   ================================================== */

/*
 * Prefer the actual PIB publication date.
 *
 * If PIB did not provide one, use created_at,
 * which represents when the article entered
 * the database.
 */

function getArticleDate(article) {

    return (
        article.published_at ||
        article.created_at ||
        null
    );
}


function formatDate(dateValue) {

    if (!dateValue) {
        return "Recently fetched";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Recently fetched";
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


function monthYear(article) {

    const dateValue =
        getArticleDate(article);

    if (!dateValue) {
        return "RECENTLY FETCHED";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "RECENTLY FETCHED";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            month: "long",
            year: "numeric"
        }
    ).toUpperCase();
}


/* ==================================================
   LOAD DATA
   ================================================== */

async function loadArticles() {

    const {
        data,
        error
    } = await db
        .from("articles")
        .select("*")
        .eq("relevant", true)
        .gte("importance", 7)
        .order(
            "id",
            {
                ascending: false
            }
        );

    if (error) {

        console.error(
            "Supabase error:",
            error
        );

        alert(
            "Unable to load articles."
        );

        return;
    }

    articles = data || [];

    console.log(
        "Articles loaded:",
        articles.length
    );

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

    const totalCount =
        document.getElementById(
            "total-count"
        );

    const processedCount =
        document.getElementById(
            "processed-count"
        );

    const relevantCount =
        document.getElementById(
            "relevant-count"
        );

    const importantCount =
        document.getElementById(
            "important-count"
        );


    if (heroCount) {
        heroCount.textContent =
            total;
    }

    if (totalCount) {
        totalCount.textContent =
            total;
    }

    if (processedCount) {
        processedCount.textContent =
            processed;
    }

    if (relevantCount) {
        relevantCount.textContent =
            relevant;
    }

    if (importantCount) {
        importantCount.textContent =
            important;
    }


    /*
     * Articles are already ordered by newest
     * database ID, so the newest fetched
     * articles appear first here as well.
     */

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


    const displayTitle =
        article.english_title ||
        article.title ||
        "Untitled article";


    const summary =
        article.english_summary ||
        "";


    const topics =
        (article.topics || [])
            .slice(0, 2)
            .join(" · ");


    return `

        <article class="article-card">

            <div class="article-date">
                ${escapeHtml(
                    formatDate(
                        getArticleDate(article)
                    )
                )}
            </div>


            <div class="article-meta">

                <span class="badge ${priority}">
                    ${importance}/10
                </span>


                ${
                    gs
                        ? `
                            <span class="badge">
                                ${escapeHtml(gs)}
                            </span>
                          `
                        : ""
                }

            </div>


            <h4>
                ${escapeHtml(
                    displayTitle
                )}
            </h4>


            ${
                summary
                    ? `
                        <p>
                            ${escapeHtml(
                                summary
                            )}
                        </p>
                      `
                    : `
                        <p>
                            ${escapeHtml(topics)}
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
   ARTICLE LIST
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


    const displayTitle =
        article.english_title ||
        article.title ||
        "Untitled article";


    const topics =
        (article.topics || [])
            .join(" · ");


    return `

        <article class="list-item">

            <div>

                <div class="article-date">
                    ${escapeHtml(
                        formatDate(
                            getArticleDate(article)
                        )
                    )}
                </div>


                <div class="article-meta">

                    <span
                        class="badge ${priority}"
                    >
                        ${importance}/10
                    </span>


                    ${
                        (article.gs_papers || [])
                            .map(
                                gs =>
                                    `
                                    <span
                                        class="badge"
                                    >
                                        ${escapeHtml(gs)}
                                    </span>
                                    `
                            )
                            .join("")
                    }

                </div>


                <h4>
                    ${escapeHtml(
                        displayTitle
                    )}
                </h4>


                ${
                    topics
                        ? `
                            <p>
                                ${escapeHtml(
                                    topics
                                )}
                            </p>
                          `
                        : ""
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


    /*
     * Keep the order received from Supabase.
     *
     * Supabase is ordering by ID DESC,
     * therefore the newest fetched articles
     * stay at the top.
     */

    const groups = {};


    filtered.forEach(
        article => {

            const month =
                monthYear(article);


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
                    [month, monthArticles]
                ) => `

                    <section
                        class="month-section"
                    >

                        <div
                            class="month-heading"
                        >
                            ${escapeHtml(month)}
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


/* ==================================================
   ARTICLE DETAIL
   ================================================== */

function openArticle(id) {

    const article =
        articles.find(
            a =>
                String(a.id) ===
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


    const displayTitle =
        article.english_title ||
        article.title ||
        "Untitled article";


    const summary =
        article.english_summary ||
        (
            article.raw_text
                ? article.raw_text.slice(
                    0,
                    1200
                )
                : ""
        );


    let html = `

        <div class="article-date">
            ${escapeHtml(
                formatDate(
                    getArticleDate(article)
                )
            )}
        </div>


        <div class="article-meta">

            <span class="badge high">
                Importance
                ${article.importance || 0}/10
            </span>


            ${
                (article.gs_papers || [])
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
                displayTitle
            )}
        </h1>


        ${
            summary
                ? `
                    <p class="detail-summary">
                        ${escapeHtml(
                            summary
                        )}
                    </p>
                  `
                : ""
        }

    `;


    sections.forEach(
        ([title, values]) => {

            if (
                !values ||
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
        detail.innerHTML = html;
    }


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


    if (flashcards.length === 0) {

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


        const progress =
            document.getElementById(
                "flashcard-progress"
            );

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
                    card.type || "Concept"
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
                    (
                        b.importance || 0
                    ) -
                    (
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

        important
            .map(articleListItem)
            .join("");
}


/* ==================================================
   GS PAPERS
   ================================================== */

function renderGS(gs) {

    const filtered =
        articles.filter(
            article =>
                (
                    article.gs_papers || []
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
                .map(articleListItem)
                .join("")
            }

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
        button => {

            button.classList.toggle(
                "active",
                button.dataset.view === view
            );

        }
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

const globalSearch =
    document.getElementById(
        "global-search"
    );


if (globalSearch) {

    globalSearch.addEventListener(
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


                        const summary =
                            (
                                article.english_summary ||
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

                            title.includes(
                                query
                            )

                            ||

                            originalTitle.includes(
                                query
                            )

                            ||

                            summary.includes(
                                query
                            )

                            ||

                            rawText.includes(
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


/* ==================================================
   FILTERS
   ================================================== */

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


if (importanceFilter) {

    importanceFilter.addEventListener(
        "change",
        applyFilters
    );

}


if (gsFilter) {

    gsFilter.addEventListener(
        "change",
        applyFilters
    );

}


if (relevanceFilter) {

    relevanceFilter.addEventListener(
        "change",
        applyFilters
    );

}


function applyFilters() {

    const importance =
        importanceFilter
            ? importanceFilter.value
            : "";


    const gs =
        gsFilter
            ? gsFilter.value
            : "";


    const relevance =
        relevanceFilter
            ? relevanceFilter.value
            : "";


    let filtered =
        [...articles];


    /* Importance */

    if (importance) {

        const min =
            Number(importance);


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
                    (
                        article.importance || 0
                    ) >= min &&

                    (
                        article.importance || 0
                    ) <= max
            );

    }


    /* GS */

    if (gs) {

        filtered =
            filtered.filter(
                article =>
                    (
                        article.gs_papers || []
                    ).includes(gs)
            );

    }


    /* Relevance */

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
   HTML ESCAPE
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


/* ==================================================
   NAVIGATION EVENTS
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


/* ==================================================
   GS CARD EVENTS
   ================================================== */

document.querySelectorAll(
    ".gs-card"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                showView("gs");

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
   REFRESH
   ================================================== */

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


/* ==================================================
   START APPLICATION
   ================================================== */

loadArticles();
