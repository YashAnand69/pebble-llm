// Progressive enhancement: all sections stay visible if JavaScript is unavailable.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if ("IntersectionObserver" in window && !reducedMotion.matches) {
  try {
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
  window.addEventListener("pebble-motion-change", () => {
    if (document.documentElement.dataset.motion === "off") {
      observer.disconnect();
      document.querySelectorAll(".reveal").forEach(section => section.classList.add("is-visible"));
    }
  });
  document
    .querySelectorAll(".reveal")
    .forEach((section) => observer.observe(section));
  document.documentElement.classList.add("motion-ready");
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches)
      document.documentElement.classList.remove("motion-ready");
  });
  } catch { document.documentElement.classList.remove("motion-ready"); }
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

// A visible page-level preference supplements the operating system preference.
const motionButton = document.querySelector(".motion-toggle");
let userMotionOff = false;
try { userMotionOff = localStorage.getItem("pebble-motion") === "off"; } catch {}
function syncMotionPreference() {
  const off = userMotionOff || reducedMotion.matches;
  document.documentElement.dataset.motion = off ? "off" : "on";
  if (motionButton) {
    motionButton.textContent = reducedMotion.matches ? "Motion off · system" : off ? "Motion off" : "Motion on";
    motionButton.disabled = reducedMotion.matches;
    motionButton.setAttribute("aria-pressed", String(off));
    motionButton.setAttribute("aria-label", off ? "Turn on animation" : "Turn off animation");
  }
  if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("pebble-motion-change"));
}
motionButton?.addEventListener("click", () => {
  userMotionOff = !(userMotionOff || reducedMotion.matches);
  try { localStorage.setItem("pebble-motion", userMotionOff ? "off" : "on"); } catch {}
  syncMotionPreference();
});
reducedMotion.addEventListener("change", syncMotionPreference);
syncMotionPreference();
