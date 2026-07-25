/**
 * permits-guide.js — an interactive guided tour for the Number Plate Manager.
 *
 * Include on the page after permits.js:
 *     <script defer src="permits-guide.js"></script>
 *
 * What it does:
 *  - Adds a "Guide" button next to Add/Export/Import that starts the tour.
 *  - Starts automatically (once) for first-time visitors with no saved plates.
 *  - Walks through the app by highlighting and driving the real interface:
 *    switching tabs, typing in the filter, opening the Add form, and so on.
 *  - If the list is empty, temporary example entries are shown during the
 *    tour (DOM only — nothing is ever written to the saved data).
 *  - Remembers it has been seen via the localStorage key "permitsGuideSeen".
 *  - Also available from the console: PermitsGuide.start() / PermitsGuide.end()
 */
(function () {
    "use strict";

    const SEEN_KEY = "permitsGuideSeen";
    const AUTO_START_FOR_NEW_USERS = true;
    const Z = 2147483600; // above Fancybox

    let active = false;
    let busy = false;
    let stepIndex = -1;
    let posInterval = null;
    let injectedDemo = false;
    let savedNoRecords = null;
    let initialTab = null;
    let initialFilter = "";
    let initialScrollY = 0;
    let ui = null, blocker = null, spot = null, tip = null;

    const timers = [];

    function later(fn, ms) {
        timers.push(setTimeout(fn, ms));
    }

    function clearTimers() {
        while (timers.length) clearTimeout(timers.pop());
    }

    function waitFor(test, timeoutMs) {
        return new Promise(function (resolve) {
            const started = Date.now();
            (function poll() {
                let ok = false;
                try {
                    ok = test();
                } catch (e) {
                }
                if (ok || Date.now() - started > (timeoutMs || 2500)) return resolve(ok);
                timers.push(setTimeout(poll, 60));
            })();
        });
    }

    function clickIf(selector) {
        const el = document.querySelector(selector);
        if (el) el.click();
    }

    function firstEntry() {
        return document.querySelector("#permits-list .entry:not(.hidden)")
            || document.querySelector("#permits-list .entry");
    }

    function closeAddForm() {
        try {
            if (window.Fancybox && typeof Fancybox.getInstance === "function" && Fancybox.getInstance()) {
                Fancybox.close();
                return;
            }
        } catch (e) {
        }
        const cancel = document.querySelector("#addeditform .cancelEntry");
        if (cancel) cancel.click();
    }

    /* ------------------------------------------------------------------ *
     *  Temporary example entries (DOM only, never saved)                 *
     * ------------------------------------------------------------------ */

    const DEMO_ENTRIES = [
        {name: "Mum", plate: "AB12 CDE", usage: "frequent"},
        {name: "The Plumber", plate: "CD34 EFG", usage: "occasional"}
    ];

    function buildDemoEntry(demo) {
        const div = document.createElement("div");
        div.className = "entry usage-" + demo.usage + " guide-demo";
        div.dataset.id = "guide-demo-" + demo.usage;
        const name = document.createElement("div");
        name.className = "entry-name";
        name.innerText = demo.name;
        const npwrap = document.createElement("div");
        npwrap.className = "entry-numberplate-wrapper";
        const np = document.createElement("div");
        np.className = "copy entry-numberplate";
        np.innerText = demo.plate;
        npwrap.appendChild(np);
        const actions = document.createElement("div");
        actions.className = "entry-actions";
        const edit = document.createElement("button");
        edit.className = "edit-entry";
        edit.innerText = "Edit";
        const del = document.createElement("button");
        del.className = "delete-entry";
        del.innerText = "Delete";
        actions.appendChild(edit);
        actions.appendChild(del);
        div.appendChild(name);
        div.appendChild(npwrap);
        div.appendChild(actions);
        return div;
    }

    function injectDemoIfEmpty() {
        const list = document.getElementById("permits-list");
        if (!list) return;
        savedNoRecords = list.querySelector(".no-records");
        if (!savedNoRecords) return; // the user already has real entries
        savedNoRecords.remove();
        for (const demo of DEMO_ENTRIES) {
            list.appendChild(buildDemoEntry(demo));
        }
        injectedDemo = true;
    }

    function removeDemo() {
        if (!injectedDemo) return;
        injectedDemo = false;
        document.querySelectorAll("#permits-list .guide-demo").forEach(function (n) {
            n.remove();
        });
        try {
            // Rebuild the (empty) list exactly as the app would
            if (typeof window.getNumberplates === "function") {
                window.getNumberplates();
            } else if (savedNoRecords) {
                document.getElementById("permits-list").appendChild(savedNoRecords);
            }
        } catch (e) {
            if (savedNoRecords) document.getElementById("permits-list").appendChild(savedNoRecords);
        }
    }

    function removeDemoBubble() {
        document.querySelectorAll(".pg-demo-bubble").forEach(function (n) {
            n.remove();
        });
    }

    function demoFilterQuery() {
        if (injectedDemo) return "mu"; // narrows the examples down to "Mum"
        const entry = firstEntry();
        if (!entry) return "";
        const name = entry.querySelector(".entry-name") ? entry.querySelector(".entry-name").innerText : "";
        return name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toLowerCase();
    }

    /* ------------------------------------------------------------------ *
     *  The tour steps                                                    *
     * ------------------------------------------------------------------ */

    const steps = [
        {
            center: true,
            title: "Welcome!",
            body: "<p>This little app keeps a list of the number plates of people who visit you, so that when you " +
                "need to enter one into your parking permit system, it's just a couple of taps away.</p>" +
                "<p>Everything you save stays private, in this browser on this device.</p>" +
                "<p>This quick tour shows you around — use <strong>Next</strong> to continue, or the × to leave " +
                "at any time.</p>"
        },
        {
            target: "#permits-list",
            title: "Your list of number plates",
            body: function () {
                let html = "<p>Everyone you add appears here, with their name and number plate.</p>";
                if (injectedDemo) {
                    html += "<p><em>We've popped in two example entries so you can see how it works — they'll " +
                        "vanish when the tour ends, and nothing is saved.</em></p>";
                }
                return html;
            }
        },
        {
            target: function () {
                return firstEntry();
            },
            title: "Tap a plate to copy it",
            body: "<p>Tap or click anywhere on an entry and the number plate is copied, ready to paste straight " +
                "into your permit app — you'll see a little <em>Copied</em> flash, just like the one showing " +
                "now.</p>",
            onEnter: function () {
                later(function () {
                    const entry = firstEntry();
                    const np = entry && entry.querySelector(".entry-numberplate");
                    if (!np) return;
                    const bubble = document.createElement("div");
                    bubble.className = "copiedHighlight pg-demo-bubble";
                    bubble.innerHTML = "<em>Copied</em>";
                    np.insertAdjacentElement("afterend", bubble);
                }, 600);
            },
            onExit: removeDemoBubble
        },
        {
            target: [".tabs .tab.frequent", ".tabs .tab.occasional"],
            title: "Frequent and Occasional",
            body: "<p>Your plates live in two lists: <strong>Frequent</strong> for regular visitors, and " +
                "<strong>Occasional</strong> for everyone else.</p>" +
                "<p>We've switched to the Occasional tab so you can see it — just tap a tab to change lists.</p>",
            onEnter: function () {
                later(function () {
                    clickIf(".tabs .tab.occasional");
                }, 800);
            },
            onExit: function () {
                clickIf(".tabs .tab.frequent");
            }
        },
        {
            target: ".tabs .tab.filter",
            title: "Finding someone quickly",
            body: "<p>The <strong>Filter</strong> box searches names and number plates as you type.</p>" +
                "<p>Watch the list narrow down as we type…</p>",
            onEnter: function () {
                clickIf(".tabs .tab.filter");
                const query = demoFilterQuery();
                let typed = "";
                for (let i = 0; i < query.length; i++) {
                    (function (i) {
                        later(function () {
                            typed += query.charAt(i);
                            const input = document.getElementById("filter");
                            if (!input) return;
                            input.value = typed;
                            input.dispatchEvent(new Event("input"));
                        }, 900 + i * 550);
                    })(i);
                }
            },
            onExit: function () {
                const input = document.getElementById("filter");
                if (input) {
                    input.value = "";
                    input.dispatchEvent(new Event("input"));
                    input.blur();
                }
                clickIf(".tabs .tab.frequent");
            }
        },
        {
            target: "#add-permit",
            title: "Adding someone",
            body: "<p>The <strong>Add</strong> button is how you put a new person on your list. " +
                "Let's open it and take a look…</p>"
        },
        {
            target: "#addeditform",
            title: "The Add form",
            body: "<p>Type the person's <strong>name</strong>, their <strong>number plate</strong>, and choose " +
                "whether they visit <strong>frequently or occasionally</strong>. Then press " +
                "<strong>Save</strong>.</p>" +
                "<p>We'll close it again for now — nothing will be saved.</p>",
            onEnter: async function () {
                clickIf("#add-permit");
                await waitFor(function () {
                    const form = document.getElementById("addeditform");
                    if (!form) return false;
                    const rect = form.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                }, 2500);
                // let the Fancybox opening animation settle
                await new Promise(function (resolve) {
                    later(resolve, 350);
                });
                // Fancybox opens a modal <dialog> in the browser's top layer,
                // which stacks above the tour — re-raise the tour above it
                raiseUi();
            },
            onExit: function () {
                closeAddForm();
            }
        },
        {
            target: function () {
                const entry = firstEntry();
                return entry && entry.querySelector(".entry-actions");
            },
            title: "Changing or removing an entry",
            body: "<p><strong>Edit</strong> lets you correct a name or plate (for example if someone changes " +
                "car). <strong>Delete</strong> removes them — you'll always be asked to confirm first.</p>"
        },
        {
            target: ["#export-permits", "#import-permits"],
            title: "Back up your list",
            body: "<p>Your list only exists in this browser. <strong>Export</strong> downloads it as a small " +
                "file — keep it somewhere safe.</p>" +
                "<p><strong>Import</strong> loads a saved file back in, which is also how you move your list to " +
                "a new phone, tablet or computer.</p>"
        },
        {
            target: [".country-picker", ".light-dark-toggle-wrapper", ".qr-wrapper", ".github-wrapper", ".help-wrapper"],
            title: "A few extras",
            body: "<p>Up here you can pick the country flag (how plates are shown), switch between light and " +
                "dark mode, share this app with a QR code, see the code on GitHub, or read the full help under " +
                "the <strong>?</strong>.</p>"
        },
        {
            center: true,
            title: "That's it — you're ready!",
            body: "<p>Add your first number plate with the <strong>Add</strong> button.</p>" +
                "<p>You can watch this tour again any time by pressing the <strong>Guide</strong> button at the " +
                "top of the page.</p>"
        }
    ];

    /* ------------------------------------------------------------------ *
     *  Tour engine: overlay, spotlight and tooltip                       *
     * ------------------------------------------------------------------ */

    const CSS = "" +
        "#pg-ui, #pg-ui * { box-sizing: border-box; }" +
        "dialog#pg-ui { position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none; " +
        "  max-height: none; margin: 0; border: 0; padding: 0; background: transparent; " +
        "  overflow: visible; }" +
        "dialog#pg-ui::backdrop { background: transparent; }" +
        // extra scroll room so a target can always be scrolled clear of the tooltip
        "html.pg-active body { padding-bottom: 60vh !important; }" +
        ".pg-blocker { position: fixed; inset: 0; z-index: " + Z + "; background: rgba(10,10,10,0); " +
        "  transition: background .25s ease; -webkit-tap-highlight-color: transparent; }" +
        ".pg-blocker.pg-dim { background: rgba(10,10,10,.55); }" +
        ".pg-spot { position: fixed; z-index: " + (Z + 1) + "; border-radius: 12px; pointer-events: none; " +
        "  box-shadow: 0 0 0 2px rgba(255,255,255,.9), 0 0 0 200vmax rgba(10,10,10,.55); " +
        "  transition: left .25s ease, top .25s ease, width .25s ease, height .25s ease; }" +
        ".pg-tip { position: fixed; z-index: " + (Z + 2) + "; width: min(360px, calc(100vw - 24px)); " +
        "  font-family: var(--font, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial); " +
        "  background: var(--light-panel, #fafafa); color: var(--light-text, #333); " +
        "  border: 1px solid var(--light-border, #e0e0e0); border-radius: var(--radius, 10px); " +
        "  padding: 16px 18px 14px; box-shadow: 0 12px 40px rgba(0,0,0,.35); " +
        "  transition: left .25s ease, top .25s ease; }" +
        "html.dark .pg-tip { background: var(--dark-panel-2, #0f0f0f); color: var(--dark-text, #fafafa); " +
        "  border-color: var(--dark-border, #262626); }" +
        ".pg-tip h3 { margin: 0 24px 8px 0; font-size: 1.05rem; }" +
        ".pg-body { font-size: .95rem; line-height: 1.45; }" +
        ".pg-body p { margin: 0 0 10px; }" +
        ".pg-body p:last-child { margin-bottom: 0; }" +
        ".pg-x { position: absolute; top: 6px; right: 8px; border: none; background: none; " +
        "  font-size: 20px; line-height: 1; cursor: pointer; color: inherit; opacity: .6; padding: 4px; }" +
        ".pg-x:hover { opacity: 1; }" +
        ".pg-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }" +
        ".pg-progress { font-size: .8rem; opacity: .65; }" +
        ".pg-btns button { font: inherit; font-size: .9rem; padding: 6px 14px; cursor: pointer; " +
        "  border-radius: var(--radius-sm, 8px); margin-left: 8px; " +
        "  border: 1px solid var(--light-border, #e0e0e0); background: var(--light-panel, #fafafa); " +
        "  color: var(--light-text, #333); }" +
        ".pg-btns .pg-next { background: #333; color: #fff; border-color: #333; }" +
        "html.dark .pg-btns button { border-color: var(--dark-border, #262626); " +
        "  background: var(--dark-panel, #0a0a0a); color: var(--dark-text, #fafafa); }" +
        "html.dark .pg-btns .pg-next { background: var(--dark-accent, #e5e7eb); color: #111; " +
        "  border-color: var(--dark-accent, #e5e7eb); }" +
        ".pg-btns .pg-back:disabled { opacity: .4; cursor: default; }" +
        ".pg-body { max-height: 45vh; overflow-y: auto; }" +
        // on short screens, pull the Fancybox slide content up during the tour so
        // the tooltip (pinned at the bottom) covers as little of the form as possible
        "@media (max-height: 700px) { " +
        "  html.pg-active .fancybox__slide { padding-top: 4px !important; } " +
        "  html.pg-active .fancybox__slide > * { margin-top: 0 !important; } }" +
        "@media (max-width: 420px), (max-height: 700px) { " +
        "  .pg-tip { padding: 12px 14px 10px; } " +
        "  .pg-tip h3 { font-size: 1rem; margin-bottom: 6px; } " +
        "  .pg-body { font-size: .875rem; line-height: 1.4; } " +
        "  .pg-body p { margin-bottom: 8px; } " +
        "  .pg-foot { margin-top: 10px; } }" +
        "@media (prefers-reduced-motion: reduce) { .pg-blocker, .pg-spot, .pg-tip { transition: none; } }";

    function buildUi() {
        if (!document.getElementById("pg-style")) {
            const style = document.createElement("style");
            style.id = "pg-style";
            style.textContent = CSS;
            document.head.appendChild(style);
        }
        // A modal <dialog> lives in the browser's top layer, which keeps the
        // tour above Fancybox (which is itself a modal <dialog>)
        ui = document.createElement("dialog");
        ui.id = "pg-ui";
        blocker = document.createElement("div");
        blocker.className = "pg-blocker";
        spot = document.createElement("div");
        spot.className = "pg-spot";
        spot.style.display = "none";
        spot.style.left = "50vw";
        spot.style.top = "50vh";
        spot.style.width = "0";
        spot.style.height = "0";
        tip = document.createElement("div");
        tip.className = "pg-tip";
        tip.setAttribute("role", "dialog");
        tip.setAttribute("aria-modal", "true");
        tip.setAttribute("aria-live", "polite");
        tip.innerHTML =
            "<button type='button' class='pg-x' aria-label='Close guide'>&times;</button>" +
            "<h3 class='pg-title'></h3>" +
            "<div class='pg-body'></div>" +
            "<div class='pg-foot'>" +
            "  <span class='pg-progress'></span>" +
            "  <span class='pg-btns'>" +
            "    <button type='button' class='pg-back'>Back</button>" +
            "    <button type='button' class='pg-next'>Next</button>" +
            "  </span>" +
            "</div>";
        ui.appendChild(blocker);
        ui.appendChild(spot);
        ui.appendChild(tip);
        document.body.appendChild(ui);

        tip.querySelector(".pg-x").addEventListener("click", end);
        tip.querySelector(".pg-back").addEventListener("click", back);
        tip.querySelector(".pg-next").addEventListener("click", next);
        ui.addEventListener("cancel", function (e) {
            e.preventDefault();
            end();
        });
        raiseUi();
    }

    function raiseUi() {
        if (!ui || typeof ui.showModal !== "function") return;
        try {
            if (ui.open) ui.close();
            ui.showModal();
        } catch (e) {
        }
    }

    function targetsOf(step) {
        if (!step.target) return [];
        const list = Array.isArray(step.target) ? step.target : [step.target];
        const els = [];
        for (const t of list) {
            const el = typeof t === "function" ? t() : document.querySelector(t);
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width || rect.height) els.push(el);
        }
        return els;
    }

    function unionRect(els) {
        let r = null;
        for (const el of els) {
            const b = el.getBoundingClientRect();
            r = r ? {
                left: Math.min(r.left, b.left),
                top: Math.min(r.top, b.top),
                right: Math.max(r.right, b.right),
                bottom: Math.max(r.bottom, b.bottom)
            } : {left: b.left, top: b.top, right: b.right, bottom: b.bottom};
        }
        return r;
    }

    function position() {
        if (!active) return;
        const step = steps[stepIndex];
        if (!step) return;
        const els = targetsOf(step);
        const r = step.center || !els.length ? null : unionRect(els);
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = tip.offsetWidth, h = tip.offsetHeight;

        if (!r) {
            // Centered step: dim the whole page instead of spotlighting
            blocker.classList.add("pg-dim");
            spot.style.display = "none";
            tip.style.left = Math.max(12, (vw - w) / 2) + "px";
            tip.style.top = Math.max(12, (vh - h) / 2) + "px";
            return;
        }
        blocker.classList.remove("pg-dim");
        spot.style.display = "block";
        const pad = 6;
        spot.style.left = (r.left - pad) + "px";
        spot.style.top = (r.top - pad) + "px";
        spot.style.width = (r.right - r.left + pad * 2) + "px";
        spot.style.height = (r.bottom - r.top + pad * 2) + "px";

        const gap = 14;
        let top;
        if (r.bottom + gap + h + 8 <= vh) {
            top = r.bottom + gap;
        } else if (r.top - gap - h >= 8) {
            top = r.top - gap - h;
        } else {
            top = Math.max(8, vh - h - 8);
        }
        let left = (r.left + r.right) / 2 - w / 2;
        left = Math.max(8, Math.min(left, vw - w - 8));
        tip.style.left = left + "px";
        tip.style.top = top + "px";
    }

    function render() {
        const step = steps[stepIndex];
        tip.querySelector(".pg-title").textContent = step.title;
        tip.querySelector(".pg-body").innerHTML = typeof step.body === "function" ? step.body() : step.body;
        tip.querySelector(".pg-progress").textContent = (stepIndex + 1) + " of " + steps.length;
        tip.querySelector(".pg-back").disabled = stepIndex === 0;
        tip.querySelector(".pg-next").textContent = stepIndex === steps.length - 1 ? "Finish" : "Next";
        const els = targetsOf(step);
        if (els.length && !step.center) {
            try {
                els[0].scrollIntoView({block: "nearest"});
            } catch (e) {
            }
            ensureRoomFor(step);
        }
        position();
        try {
            tip.querySelector(".pg-next").focus();
        } catch (e) {
        }
    }

    // On small screens the tooltip may fit neither below nor above the target;
    // scroll the target towards the top of the viewport to make room below
    // (the tour adds bottom padding to the page so this is always possible)
    function ensureRoomFor(step) {
        const els = targetsOf(step);
        if (!els.length) return;
        const r = unionRect(els);
        const h = tip.offsetHeight, gap = 14;
        const vh = window.innerHeight;
        if (r.bottom + gap + h + 8 <= vh) return; // fits below
        if (r.top - gap - h >= 8) return; // fits above
        try {
            window.scrollBy({top: r.top - 64, behavior: "auto"});
        } catch (e) {
        }
    }

    async function goTo(i) {
        if (!active || busy) return;
        busy = true;
        clearTimers();
        const prev = steps[stepIndex];
        try {
            if (prev && prev.onExit) await prev.onExit();
        } catch (e) {
        }
        stepIndex = i;
        const step = steps[i];
        try {
            if (step.onEnter) await step.onEnter();
        } catch (e) {
        }
        if (!active) {
            busy = false;
            return;
        }
        render();
        busy = false;
    }

    function next() {
        if (busy || !active) return;
        if (stepIndex >= steps.length - 1) {
            end();
        } else {
            goTo(stepIndex + 1);
        }
    }

    function back() {
        if (busy || !active) return;
        if (stepIndex > 0) goTo(stepIndex - 1);
    }

    function onKey(e) {
        if (!active) return;
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            end();
        } else if (e.key === "ArrowRight" || e.key === "Enter") {
            e.preventDefault();
            next();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            back();
        }
    }

    /* ------------------------------------------------------------------ *
     *  Start / end                                                       *
     * ------------------------------------------------------------------ */

    function start() {
        if (active) return;
        if (!document.getElementById("permits-list")) return;
        active = true;
        busy = false;
        try {
            window.localStorage.setItem(SEEN_KEY, "1");
        } catch (e) {
        }
        initialTab = document.querySelector(".tabs > div.active");
        initialScrollY = window.scrollY;
        document.documentElement.classList.add("pg-active");
        const filter = document.getElementById("filter");
        initialFilter = filter ? filter.value : "";
        if (filter && filter.value) {
            filter.value = "";
            filter.dispatchEvent(new Event("input"));
        }
        injectDemoIfEmpty();
        clickIf(".tabs .tab.frequent");
        buildUi();
        stepIndex = -1;
        goTo(0);
        posInterval = setInterval(position, 250);
        window.addEventListener("resize", position);
        window.addEventListener("scroll", position, true);
        document.addEventListener("keydown", onKey, true);
    }

    function end() {
        if (!active) return;
        active = false;
        clearTimers();
        clearInterval(posInterval);
        window.removeEventListener("resize", position);
        window.removeEventListener("scroll", position, true);
        document.removeEventListener("keydown", onKey, true);
        closeAddForm();
        removeDemoBubble();
        const filter = document.getElementById("filter");
        if (filter) {
            filter.value = initialFilter || "";
            filter.dispatchEvent(new Event("input"));
            filter.blur();
        }
        removeDemo();
        if (initialTab && document.contains(initialTab) && !initialTab.classList.contains("filter")) {
            try {
                initialTab.click();
            } catch (e) {
            }
        }
        if (ui) {
            try {
                if (ui.open) ui.close();
            } catch (e) {
            }
            ui.remove();
            ui = null;
            blocker = spot = tip = null;
        }
        document.documentElement.classList.remove("pg-active");
        try {
            window.scrollTo({top: initialScrollY, behavior: "auto"});
        } catch (e) {
        }
    }

    /* ------------------------------------------------------------------ *
     *  Wiring: the Guide button and the first-visit auto start           *
     * ------------------------------------------------------------------ */

    function addTriggerButton() {
        const holder = document.querySelector("#permits-header .buttons");
        if (!holder || document.getElementById("start-guide")) return;
        const button = document.createElement("button");
        button.id = "start-guide";
        button.type = "button";
        button.innerText = "Guide";
        button.title = "Take a quick tour of this app";
        button.addEventListener("click", function (e) {
            e.preventDefault();
            start();
        });
        holder.appendChild(button);
    }

    function shouldAutoStart() {
        try {
            if (window.localStorage.getItem(SEEN_KEY)) return false;
            const data = JSON.parse(window.localStorage.getItem("permitsData"));
            return !(Array.isArray(data) && data.length > 0);
        } catch (e) {
            return false;
        }
    }

    function init() {
        addTriggerButton();
        if (AUTO_START_FOR_NEW_USERS && shouldAutoStart()) {
            // wait for permits.js to render the list and the page to fade in
            setTimeout(start, 900);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.PermitsGuide = {start: start, end: end};
})();
