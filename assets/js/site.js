"use strict";
/* Peak Wild — tiny site JS: mobile nav, scroll reveal, shop filters */

// Signal JS is active so CSS applies the hidden-until-revealed state.
// Without this class, .rv elements stay fully visible (no-JS safety + SEO).
document.documentElement.classList.add("js");

// mobile nav
const burger = document.querySelector(".burger");
const links = document.querySelector("nav.links");
if (burger && links) {
  burger.addEventListener("click", () => {
    links.classList.toggle("open");
    burger.setAttribute("aria-expanded", links.classList.contains("open"));
  });
  links.querySelectorAll("a").forEach(a =>
    a.addEventListener("click", () => links.classList.remove("open")));
}

// reveal on scroll — with guarantees that nothing stays hidden
const revealEls = [...document.querySelectorAll(".rv")];
const reveal = el => el.classList.add("in");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
  revealEls.forEach(el => io.observe(el));
  // reveal anything already at/above the fold on load (no wait for a scroll)
  addEventListener("load", () =>
    revealEls.forEach(el => { if (el.getBoundingClientRect().top < innerHeight) reveal(el); }));
  // final safety net: after a beat, force-reveal any straggler so content can
  // never be permanently invisible (e.g. a fast scroll past a card).
  setTimeout(() => revealEls.forEach(reveal), 2600);
} else {
  revealEls.forEach(reveal);
}

// shop category filters
const chips = document.querySelectorAll(".chip");
const cards = document.querySelectorAll(".prod-card[data-cats]");
chips.forEach(chip => chip.addEventListener("click", () => {
  chips.forEach(c => c.classList.remove("on"));
  chip.classList.add("on");
  const want = chip.dataset.filter;
  cards.forEach(card => {
    const cats = card.dataset.cats.split(" ");
    card.classList.toggle("hide", want !== "all" && !cats.includes(want));
  });
}));
