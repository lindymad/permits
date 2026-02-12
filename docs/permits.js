document.getElementById("filter").addEventListener("input", function (e) {
    let filter = new RegExp(e.target.value, "gi");
    let entries = document.getElementById("permits-list").children;
    for (let entry of entries) {
        if (!e.target.value || entry.querySelector(".entry-name").innerText.match(filter) || entry.querySelector(".entry-numberplate").innerText.match(filter)) {
            entry.classList.remove("hidden");
        } else {
            entry.classList.add("hidden");
        }
    }
});
const tabs = document.querySelector(".tabs");

tabs.addEventListener("click", function (e) {
    if (e.target.classList.contains("tab") || e.target.id === "filter") {
        const active = tabs.querySelectorAll("div.active");
        for (let tab of active) {
            tab.classList.remove("active");
        }
        if (e.target.id === "filter") {
            e.target.closest(".tab").classList.add("active");
            let filter = new RegExp(e.target.value, "gi");
            let entries = document.getElementById("permits-list").children;
            for (let entry of entries) {
                if (!e.target.value || entry.querySelector(".entry-name").innerText.match(filter) || entry.querySelector(".entry-numberplate").innerText.match(filter)) {
                    entry.classList.remove("hidden");
                } else {
                    entry.classList.add("hidden");
                }
            }
        } else {
            e.target.classList.add("active");
            let entries = document.getElementById("permits-list").children;
            for (entry of entries) {
                if ((e.target.classList.contains("frequent") && entry.classList.contains("usage-frequent"))
                    ||
                    (e.target.classList.contains("occasional") && entry.classList.contains("usage-occasional"))
                ) {
                    entry.classList.remove("hidden");
                } else {
                    entry.classList.add("hidden");
                }
            }
        }
    }
});

function saveNumberplate(name, numberplate, usage) {
    let currData = JSON.parse(window.localStorage.getItem("permitsData"));
    if (typeof currData === "undefined" || !currData) {
        currData = [];
    }
    let newData = [];
    let found = false;
    for (let existing of currData) {
        if (existing.numberplate === numberplate) {
            found = true;
            existing.name = name;
            existing.usage = usage;
        }
        newData.push(existing);
    }
    if (!found) {
        newData.push({numberplate: numberplate, name: name, usage: usage});
    }
    window.localStorage.setItem("permitsData", JSON.stringify(newData));
    let message;
    if (found) {
        message = numberplate + " was updated";
    } else {
        message = numberplate + " was added";
    }
    document.querySelector('.cancelEntry').click();
    let copied = document.createElement("div");
    copied.classList.add("passThruMessage");
    copied.id = generateRandomString(10);
    copied.innerHTML = "<em>" + message + "</em>";
    document.getElementById("permits-header").appendChild(copied);
    setTimeout(function () {
        const element = document.getElementById(copied.id);

        // Step 1: Start fading by setting opacity to 0
        element.style.opacity = 0;

        // Step 2: After transition ends, hide the element
        element.addEventListener("transitionend", function onTransitionEnd() {
            // Hide the element to free up space
            element.style.display = "none";
            // Remove the event listener to avoid reusing it accidentally
            element.removeEventListener("transitionend", onTransitionEnd);
        }, {once: true}); // { once: true } auto-removes the listener after it runs

    }, 2000);

}

function getUsage() {
    const curr = document.querySelector(".tabs > div.active");
    if (curr.classList.contains("frequent")) return "frequent";
    else if (curr.classList.contains("occasional")) return "occasional";
    else return "";
}

function getNumberplates() {
    let currData = JSON.parse(window.localStorage.getItem("permitsData"));
    if (typeof currData === "undefined" || !currData) {
        currData = [];
    }
    document.getElementById("permits-list").innerHTML = "";
    for (let entry of currData) {
        let div = document.createElement("div");
        div.classList.add("usage-" + entry.usage);
        div.classList.add("entry");
        if (getUsage() && getUsage() !== entry.usage) {
            div.classList.add("hidden");
        }
        let np = document.createElement("div");
        np.classList.add("entry-numberplate");
        np.classList.add("copy");
        np.innerText = entry.numberplate;
        let name = document.createElement("div");
        name.classList.add("entry-name");
        name.innerText = entry.name;
        let actions = document.createElement("div");
        actions.classList.add("entry-actions");
        let edit = document.createElement("button");
        edit.classList.add("edit-entry");
        edit.innerText = "Edit";
        let deleteButton = document.createElement("button");
        deleteButton.classList.add("delete-entry");
        deleteButton.innerText = "Delete";
        deleteButton.setAttribute("src", "#deleteEntry");
        deleteButton.dataset.fancybox = false;

        actions.appendChild(edit);
        actions.appendChild(deleteButton);
        div.appendChild(name);
        div.appendChild(np);
        div.appendChild(actions);
        document.getElementById("permits-list").appendChild(div);
    }
    if (document.querySelector(".tabs > div.active input")) {
        document.querySelector(".tabs > div.active input").dispatchEvent(new Event("input"));
    } else {
        document.querySelector(".tabs > div.active").click();
    }

}

document.getElementById("addeditform").addEventListener("submit", function () {
    let error="";
    if (!document.getElementById("addEditName").value) {
        error+="You must enter a name.\n";
    }
    if (!document.getElementById("addEditNumberPlate").value) {
        error+="You must enter a numberplate.\n";
    }
    if (error) {
        alert(error);
    }
    else {
        saveNumberplate(document.getElementById("addEditName").value, document.getElementById("addEditNumberPlate").value, document.getElementById("addEditUsage").value);
        document.getElementById('addeditform').reset();
        getNumberplates();
    }
});

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function copyTextToClipboard(element, textToCopy) {

    if (typeof contentType === 'undefined') {
        contentType = 'link';
    }
    element.insertAdjacentHTML('afterend', "<textarea id='TEMPcopy' style='display:block;position:fixed;top:-5000px;left:0;'>" + htmlEntities(textToCopy) + "</textarea>");
    /* Select the text field */
    setTimeout(function () {
        var copyText = document.getElementById("TEMPcopy");

        copyText.select();
        copyText.setSelectionRange(0, 99999); /*For mobile devices*/

        /* Copy the text inside the text field */
        let res = document.execCommand("copy");
        if (res) {
            // Copied
            //niceAlert('The '+contentType+' has been copied');
        } else {
            //niceError('An error occurred copying the '+contentType+', please copy it manually.');
        }
        document.getElementById("TEMPcopy").remove();
    }, 20);
}

const generateRandomString = (length) => {
    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let result = '';

    // Create an array of 32-bit unsigned integers
    const randomValues = new Uint32Array(length);

    // Generate random values
    window.crypto.getRandomValues(randomValues);
    randomValues.forEach((value) => {
        result += characters.charAt(value % charactersLength);
    });
    return result;
}


document.addEventListener("click", function (e) {
    if (e.target.classList.contains("copy")) {
        copyTextToClipboard(e.target, e.target.innerText);
        let copied = document.createElement("div");
        copied.classList.add("copiedHighlight");
        copied.id = generateRandomString(10);
        copied.innerHTML = "<em>Copied</em>";
        e.target.appendChild(copied);
        setTimeout(function () {
            const element = document.getElementById(copied.id);

            // Step 1: Start fading by setting opacity to 0
            element.style.opacity = 0;

            // Step 2: After transition ends, hide the element
            element.addEventListener("transitionend", function onTransitionEnd() {
                // Hide the element to free up space
                element.style.display = "none";
                // Remove the event listener to avoid reusing it accidentally
                element.removeEventListener("transitionend", onTransitionEnd);
            }, {once: true}); // { once: true } auto-removes the listener after it runs

        }, 1000);
    } else if (e.target.classList.contains("edit-entry")) {
        document.getElementById("addEditName").value = e.target.closest(".entry").querySelector(".entry-name").innerText;
        document.getElementById("addEditNumberPlate").value = e.target.closest(".entry").querySelector(".entry-numberplate").innerText;
        let usage;
        if (e.target.closest(".entry").classList.contains("usage-frequent")) {
            usage = "frequent";
        } else {
            usage = "occasional";
        }
        document.getElementById("addEditIsNew").value = "noTemp";
        document.getElementById("addEditUsage").value = usage;
        document.getElementById("add-permit").click();
    } else if (e.target.classList.contains("delete-entry-for-sure")) {
        let numberPlate = document.querySelector(".delete-confirm-numberplate").innerText;
        let currData = JSON.parse(window.localStorage.getItem("permitsData"));
        let newData = [];
        for (let entry of currData) {
            if (entry.numberplate !== numberPlate) {
                newData.push(entry);
            }
        }
        window.localStorage.setItem("permitsData", JSON.stringify(newData));

        document.querySelector('.cancelEntry').click();
        let deletedHighlight = document.createElement("div");
        deletedHighlight.classList.add("passThruMessage");
        deletedHighlight.id = generateRandomString(10);
        deletedHighlight.innerHTML = "<em>" + document.querySelector(".delete-confirm-numberplate").innerText + " (" + document.querySelector(".delete-confirm-name").innerText + ") has been deleted</em>";
        document.getElementById("permits-header").appendChild(deletedHighlight);
        setTimeout(function () {
            const element = document.getElementById(deletedHighlight.id);

            // Step 1: Start fading by setting opacity to 0
            element.style.opacity = 0;

            // Step 2: After transition ends, hide the element
            element.addEventListener("transitionend", function onTransitionEnd() {
                // Hide the element to free up space
                element.style.display = "none";
                // Remove the event listener to avoid reusing it accidentally
                element.removeEventListener("transitionend", onTransitionEnd);
            }, {once: true}); // { once: true } auto-removes the listener after it runs

        }, 2000);
        document.querySelector(".delete-confirm-name").innerText = "";
        document.querySelector(".delete-confirm-numberplate").innerText = "";
        getNumberplates();
    } else if (e.target.classList.contains("delete-entry")) {
        document.querySelector(".delete-confirm-name").innerText = e.target.closest(".entry").querySelector(".entry-name").innerText;
        document.querySelector(".delete-confirm-numberplate").innerText = e.target.closest(".entry").querySelector(".entry-numberplate").innerText;
    } else if (e.target.id === "add-permit") {
        if (document.getElementById("addEditIsNew").value === "noTemp") {
            document.getElementById("addEditIsNew").value = "no";
        } else {
            document.getElementById("addEditName").value = "";
            document.getElementById("addEditName").focus();
            document.getElementById("addEditNumberPlate").value = "";
            let usage = document.querySelector(".tabs>div.active");
            if (usage.classList.contains("occasional")) usage = "occasional";
            else usage = "frequent";
            document.getElementById("addEditUsage").value = usage;
        }
    } else if (e.target.id === "export-permits") {
        exportJSON();
    } else if (e.target.id === "import-permits") {
        if (confirm("Are you sure? This will overwrite all of your existing numberplates. Make sure you have exported your numberplates first!")) {
            importJSON();
        }

    }
});

function exportJSON() {
    let currData = JSON.parse(window.localStorage.getItem("permitsData"));
    if (typeof currData === "undefined" || !currData) {
        currData = [];
    }
    let json = JSON.stringify(currData);
    let blob = new Blob([json], {type: "application/json"});
    let url = URL.createObjectURL(blob);

    let a = document.createElement('a');
    let date = new Date().toLocaleString().replaceAll(/[^0-9a-zA-Z]+/g, '_');
    a.download = "Permits_Export_" + date + ".json";
    a.href = url;

    a.click();
}

function importJSON() {

    let input, file, fr;

    if (typeof window.FileReader !== 'function') {
        niceAlert("The file API isn't supported on this browser yet.");
        return;
    }

    input = document.createElement('input');
    input.type = "file";
    input.id = "fileinput";
    input.click();
    input.addEventListener('change', function () {
        if (!input) {
            niceAlert("Um, couldn't find the fileinput element.");
        } else if (!input.files) {
            niceAlert("This browser doesn't seem to support the `files` property of file inputs.");
        } else if (!input.files[0]) {
            niceAlert("Please select a file before clicking 'Load'");
        } else {
            file = input.files[0];
            fr = new FileReader();
            fr.onload = receivedText;
            fr.readAsText(file);

        }

        function receivedText(e) {
            let lines = e.target.result;
            let newData = JSON.parse(lines);
            if (typeof newData === "object") {
                window.localStorage.setItem("permitsData", JSON.stringify(newData));
                getNumberplates();
                let passThruMessage = document.createElement("div");
                passThruMessage.classList.add("passThruMessage");
                passThruMessage.id = generateRandomString(10);
                passThruMessage.innerHTML = "<em>Numberplates have been imported</em>";
                document.getElementById("permits-header").appendChild(passThruMessage);
                setTimeout(function () {
                    const element = document.getElementById(passThruMessage.id);

                    // Step 1: Start fading by setting opacity to 0
                    element.style.opacity = 0;

                    // Step 2: After transition ends, hide the element
                    element.addEventListener("transitionend", function onTransitionEnd() {
                        // Hide the element to free up space
                        element.style.display = "none";
                        // Remove the event listener to avoid reusing it accidentally
                        element.removeEventListener("transitionend", onTransitionEnd);
                    }, {once: true}); // { once: true } auto-removes the listener after it runs

                }, 2000);

            } else {
                alert("The file does not contain valid JSON");
            }
        }
    });

}


getNumberplates();

Fancybox.bind("[data-fancybox]", {
    // Your custom options
    width: 700,
    height: 500,
    'showNavArrows': false
});
