function typeHTML(el, html, done) {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  const nodes = Array.from(temp.childNodes);
  let i = 0;

  function next() {
    if (i >= nodes.length) {
      done && done();
      return;
    }

    const n = nodes[i];

    // code blocks → instant
    if (n.nodeName === "PRE") {
      el.appendChild(n);
      i++;
      next();
      return;
    }

    // text typing
    if (n.nodeType === Node.TEXT_NODE) {
      let j = 0;
      const t = n.textContent;
      const span = document.createTextNode("");
      el.appendChild(span);

      const iv = setInterval(() => {
        span.textContent += t[j++];
        if (j >= t.length) {
          clearInterval(iv);
          i++;
          next();
        }
      }, 15);
    } else {
      el.appendChild(n);
      i++;
      next();
    }
  }

  next();
}
