// This script might get added multiple times:
// FIXME: let's not add it multiple times!
if (this.hasLoaded === undefined) {
  this.hasLoaded = false;
}

(function () {

  console.log("worker loaded", hasLoaded);

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

  addCheckbox();

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
