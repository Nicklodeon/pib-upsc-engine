const SUPABASE_URL =
    "YOUR_SUPABASE_URL";

const SUPABASE_KEY =
    "YOUR_SUPABASE_PUBLISHABLE_KEY";

const { createClient } =
    supabase;

const db =
    createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


let articles = [];
let flashcards = [];

let currentFlashcard = 0;


/* --------------------------------------------------
   LOAD DATA
-------------------------------------------------- */

async function loadArticles() {

    const {
        data,
        error
    } = await db
        .from("articles")
        .select("*")
        .order(
            "published_at",
            {
                ascending: false,
                nullsFirst: false
            }
        );

    if (error) {

        console.error(error);

        alert(
            "Unable to load articles."
        );

        return;
    }

    articles = data || [];

    buildFlashcards();

    renderDashboard();

    renderArticles();

    renderRevision();
}


/* --------------------------------------------------
   DASHBOARD
-------------------------------------------------- */

function renderDashboard() {

    const total =
        articles.length;

    const processed =
        articles.filter(
            a => a.processed
        ).length;

    const relevant =
        articles.filter(
            a => a.relevant
        ).length;

    const important =
        articles.filter(
            a =>
                a.importance &&
                a.importance >= 7
        ).length;


    document.getElementById(
        "hero-count"
    ).textContent = total;

    document.getElementById(
        "total-count"
    ).textContent = total;

    document.getElementById(
        "processed-count"
    ).textContent = processed;

    document.getElementById(
        "relevant-count"
    ).textContent = relevant;

    document.getElementById(
        "important-count"
    ).textContent = important;


    const recent =
        articles.slice(0, 6);

    document.getElementById(
        "recent-articles"
    ).innerHTML =
        recent.map(
            articleCard
        ).join("");
}


/* --------------------------------------------------
   ARTICLE CARD
-------------------------------------------------- */

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

    return `
        <article class="article-card">

            <div class="article-meta">

                <span class="badge ${priority}">
                    ${importance}/10
                </span>

                ${
                    gs
                    ? `<span class="badge">${gs}</span>`
                    : ""
                }

            </div>

            <h4>
                ${escapeHtml(
                    article.title
                )}
            </h4>

            <p>
                ${
                    article.topics
                    ? article.topics
                        .slice(0, 2)
                        .join(" · ")
                    : ""
                }
            </p>

            <button
                onclick="openArticle(${article.id})"
            >
                Read analysis →
            </button>

        </article>
    `;
}


/* --------------------------------------------------
   ARTICLES
-------------------------------------------------- */

function renderArticles(
    filtered = articles
) {

    document.getElementById(
        "articles-list"
    ).innerHTML =
        filtered.map(
            articleListItem
        ).join("");
}


function articleListItem(article) {

    const importance =
        article.importance || 0;

    const priority =
        importance >= 9
            ? "high"
            : importance >= 7
                ? "medium"
                : "low";

    return `
        <article class="list-item">

            <div>

                <div class="article-meta">

                    <span class="badge ${priority}">
                        ${importance}/10
                    </span>

                    ${
                        (article.gs_papers || [])
                        .map(
                            gs =>
                            `<span class="badge">${gs}</span>`
                        )
                        .join("")
                    }

                </div>

                <h4>
                    ${escapeHtml(
                        article.title
                    )}
                </h4>

                <p>
                    ${
                        (article.topics || [])
                        .join(" · ")
                    }
                </p>

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


/* --------------------------------------------------
   ARTICLE DETAIL
-------------------------------------------------- */

function openArticle(id) {

    const article =
        articles.find(
            a => a.id === id
        );

    if (!article) return;

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

            <span class="badge high">
                Importance ${article.importance}/10
            </span>

            ${
                (article.gs_papers || [])
                .map(
                    gs =>
                    `<span class="badge">${gs}</span>`
                )
                .join("")
            }

        </div>

        <h1 class="detail-title">
            ${escapeHtml(
                article.title
            )}
        </h1>

        <p class="detail-summary">
            ${
                article.raw_text
                ? escapeHtml(
                    article.raw_text
                        .slice(0, 1200)
                )
                : ""
            }
        </p>
    `;


    sections.forEach(
        ([title, values]) => {

            if (
                !values ||
                values.length === 0
            ) return;

            html += `

                <div class="detail-section">

                    <h4>${title}</h4>

                    <ul>

                        ${values.map(
                            item =>
                            `<li>${escapeHtml(
                                item
                            )}</li>`
                        ).join("")}

                    </ul>

                </div>
            `;
        }
    );


    if (article.link) {

        html += `

            <div class="detail-section">

                <a
                    href="${article.link}"
                    target="_blank"
                    rel="noopener"
                >
                    Read original PIB release →
                </a>

            </div>

        `;
    }


    document.getElementById(
        "article-detail"
    ).innerHTML = html;


    document.getElementById(
        "article-modal"
    ).classList.remove("hidden");
}


/* --------------------------------------------------
   FLASHCARDS
-------------------------------------------------- */

function buildFlashcards() {

    flashcards = [];

    articles.forEach(
        article => {

            if (
                !article.flashcards
            ) return;

            article.flashcards
                .forEach(
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

    if (
        flashcards.length === 0
    ) {

        container.innerHTML = `
            <div class="flashcard">
                <h3>No flashcards yet</h3>
                <p class="answer">
                    Process more PIB articles to
                    generate revision cards.
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
                ${card.type}
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


    document.getElementById(
        "flashcard-progress"
    ).textContent =
        `${currentFlashcard + 1} / ${flashcards.length}`;
}


function showAnswer() {

    document.getElementById(
        "flash-answer"
    ).style.display = "block";
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


/* --------------------------------------------------
   REVISION
-------------------------------------------------- */

function renderRevision() {

    const important =
        articles
        .filter(
            a =>
                a.importance >= 7 &&
                a.relevant
        )
        .sort(
            (a, b) =>
                b.importance -
                a.importance
        )
        .slice(0, 15);


    document.getElementById(
        "revision-list"
    ).innerHTML =
        important
        .map(
            articleListItem
        )
        .join("");
}


/* --------------------------------------------------
   GS FILTER
-------------------------------------------------- */

function renderGS(gs) {

    const filtered =
        articles.filter(
            article =>
                (article.gs_papers || [])
                .includes(gs)
        );

    document.getElementById(
        "gs-articles"
    ).innerHTML = `

        <h3>
            ${gs} Current Affairs
        </h3>

        <div class="article-list">

            ${filtered
                .map(articleListItem)
                .join("")}

        </div>
    `;
}


/* --------------------------------------------------
   NAVIGATION
-------------------------------------------------- */

function showView(view) {

    document.querySelectorAll(
        ".view"
    ).forEach(
        element =>
            element.classList.remove(
                "active-view"
            )
    );


    document.getElementById(
        `${view}-view`
    ).classList.add(
        "active-view"
    );


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
        dashboard: "Dashboard",
        articles: "Current Affairs",
        gs: "GS Papers",
        flashcards: "Flashcards",
        revision: "Revision"
    };


    document.getElementById(
        "page-title"
    ).textContent =
        titles[view];
}


/* --------------------------------------------------
   SEARCH
-------------------------------------------------- */

document.getElementById(
    "global-search"
).addEventListener(
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
                article =>
                    (
                        article.title ||
                        ""
                    )
                    .toLowerCase()
                    .includes(query)

                    ||

                    (
                        article.raw_text ||
                        ""
                    )
                    .toLowerCase()
                    .includes(query)

                    ||

                    (
                        article.topics ||
                        []
                    )
                    .join(" ")
                    .toLowerCase()
                    .includes(query)
            );

        showView("articles");

        renderArticles(
            filtered
        );
    }
);


/* --------------------------------------------------
   FILTERS
-------------------------------------------------- */

document.getElementById(
    "importance-filter"
).addEventListener(
    "change",
    applyFilters
);


document.getElementById(
    "gs-filter"
).addEventListener(
    "change",
    applyFilters
);


document.getElementById(
    "relevance-filter"
).addEventListener(
    "change",
    applyFilters
);


function applyFilters() {

    const importance =
        document.getElementById(
            "importance-filter"
        ).value;

    const gs =
        document.getElementById(
            "gs-filter"
        ).value;

    const relevance =
        document.getElementById(
            "relevance-filter"
        ).value;


    let filtered =
        [...articles];


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
                a =>
                    a.importance >= min &&
                    a.importance <= max
            );
    }


    if (gs) {

        filtered =
            filtered.filter(
                a =>
                    (
                        a.gs_papers || []
                    ).includes(gs)
            );
    }


    if (relevance) {

        filtered =
            filtered.filter(
                a =>
                    String(
                        a.relevant
                    ) === relevance
            );
    }


    renderArticles(
        filtered
    );
}


/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function escapeHtml(value) {

    if (value === null ||
        value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* --------------------------------------------------
   EVENTS
-------------------------------------------------- */

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

                showView("gs");

                renderGS(
                    button.dataset.gs
                );

            }
        );

    }
);


document.getElementById(
    "close-modal"
).addEventListener(
    "click",
    () =>
        document.getElementById(
            "article-modal"
        ).classList.add(
            "hidden"
        )
);


document.getElementById(
    "article-modal"
).addEventListener(
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


document.getElementById(
    "refresh-btn"
).addEventListener(
    "click",
    loadArticles
);


/* START */

loadArticles();
