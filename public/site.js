// Progressive enhancement: all sections stay visible if JavaScript is unavailable.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if ("IntersectionObserver" in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -30px 0px" },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((section) => observer.observe(section));
  document.documentElement.classList.add("motion-ready");
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches)
      document.documentElement.classList.remove("motion-ready");
  });
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copy);
    if (!target) return;
    const feedback = document.querySelector("#copy-feedback");
    try {
      await navigator.clipboard.writeText(target.textContent);
      button.textContent = "Copied";
      if (feedback) feedback.textContent = "Code copied to clipboard.";
    } catch {
      if (feedback)
        feedback.textContent =
          "Clipboard unavailable. Select the code to copy it.";
      button.textContent = "Select to copy";
    }
    setTimeout(() => {
      button.textContent = "Copy code";
    }, 2500);
  });
});
