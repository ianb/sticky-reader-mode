// This script might get added multiple times:
// FIXME: let's not add it multiple times!
if (this.hasLoaded === undefined) {
  this.hasLoaded = false;
}

(function () {

  if (hasLoaded) {
    return;
  }

  let checkbox;

  function addCheckbox() {
    let element = document.querySelector(".domain.reader-domain");
    if (!element) {
      setTimeout(addCheckbox, 100);
      return;
    }
    let label = document.createElement("label");
    label.setAttribute("for", "sticky-checkbox");
    label.style.fontSize = "0.8em";
    label.innerHTML = `
    <input type="checkbox" id="sticky-checkbox">
    always use Reader Mode for articles on this site
    `;
    element.insertAdjacentElement("afterend", label);
    checkbox = label.querySelector("input");
    checkbox.addEventListener("change", () => {
      updateCheckbox(checkbox.checked);
    });
  }

  // Takes the link <a href="original-link" class="reader reader-domain">site name</a>
  // and rewrites it to <a href="site">site name</a> <a href="original-link">article</a>
  function adjustLink() {
    let link = document.querySelector(".domain.reader-domain");
    if (!link || !link.href) {
      // Rendering hasn't finished
      setTimeout(adjustLink, 100);
      return;
    }
    let siteLink = document.createElement("a");
    siteLink.className = "domain";
    siteLink.textContent = link.textContent;
    siteLink.href = (new URL(link.href)).origin;
    link.textContent = "article";
    link.parentNode.insertBefore(siteLink, link);
    link.parentNode.insertBefore(document.createTextNode(" "), link);
  }

  try {
    addCheckbox();
    adjustLink();
  } catch (e) {
    console.error("Error adding UI:", e + "", e.stack);
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "setValue") {
      checkbox.checked = message.checked;
    } else {
      console.warn("Unexpected message:", message);
    }
  });

  function updateCheckbox(checked) {
    browser.runtime.sendMessage({type: "setValue", checked: checkbox.checked});
  }

})();

this.hasLoaded = true;
