"use strict";
/* ==========================================================
   Peak Wild — lightweight cart (no dependencies, no API token)

   How it works:
   - "Add to Cart" buttons (.buy) carry a Shopify cart permalink as their
     href, e.g. https://peakwild.myshopify.com/cart/49286205243635:1
   - JS intercepts the click, reads the product straight off its card,
     and stores it in localStorage. A slide-out drawer shows the cart.
   - Checkout builds ONE Shopify cart permalink for all items and sends the
     shopper to Shopify's secure hosted checkout.
   - Progressive enhancement: if JS is disabled or errors, the .buy anchor
     still works as a normal single-item checkout link.

   Game reward: we deliberately do NOT auto-apply the game's discount code.
   Winners paste their earned code in Shopify's discount box at checkout.
   ========================================================== */

const STORE_DOMAIN = "peakwild.myshopify.com";  // Shopify store checkout domain
const CART_KEY = "pw_cart_v1";

// Subscribe & Save — the Shopify subscription "selling plan" ("Deliver every month").
// The discount % is set in Shopify; keep `pct` here matched to it so the site never
// shows a discount that differs from what checkout charges.
const SUBSCRIPTION = { planId: "6431178995", pct: 17 };
// Variants NOT on the subscription plan in Shopify — no Subscribe option is shown for these.
const NO_SUB_VARIANTS = ["49286180405491"]; // Libido Support Strips (add it to the plan in Shopify to enable)

/* ---- state ---------------------------------------------------------- */
const load = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch (e) { return {}; } };
const save = c => localStorage.setItem(CART_KEY, JSON.stringify(c));
let cart = load();   // { variantId: {qty, name, price, img} }

const count = () => Object.values(cart).reduce((n, i) => n + i.qty, 0);
const subtotal = () => Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
const money = n => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");

/* ---- drawer markup, injected once ----------------------------------- */
function injectDrawer() {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="cart-overlay" id="cartOverlay" hidden></div>
    <aside class="cart-drawer" id="cartDrawer" aria-label="Shopping cart" aria-hidden="true">
      <div class="cart-head">
        <span class="rye">Your Pack</span>
        <button class="cart-x" id="cartClose" aria-label="Close cart">&times;</button>
      </div>
      <div class="cart-body" id="cartBody"></div>
      <div class="cart-foot" id="cartFoot"></div>
    </aside>`;
  document.body.appendChild(el);
  document.getElementById("cartOverlay").addEventListener("click", closeCart);
  document.getElementById("cartClose").addEventListener("click", closeCart);
}

/* ---- render --------------------------------------------------------- */
function renderBadge() {
  const n = count();
  document.querySelectorAll(".cart-count").forEach(b => {
    b.textContent = n;
    b.hidden = n === 0;
  });
}

function renderDrawer() {
  const body = document.getElementById("cartBody");
  const foot = document.getElementById("cartFoot");
  const entries = Object.entries(cart);
  if (!entries.length) {
    body.innerHTML = `<div class="cart-empty">
        <p>Your pack is empty.</p>
        <a class="btn green" href="/shop/">Shop the Collection</a>
      </div>`;
    foot.innerHTML = "";
    return;
  }
  body.innerHTML = entries.map(([v, it]) => `
    <div class="cart-item" data-v="${v}">
      <img src="${it.img}" alt="${it.name}">
      <div class="ci-info">
        <b>${it.name}</b>
        <span class="ci-price">${money(it.price)}</span>
        <div class="ci-qty">
          <button class="qminus" aria-label="Decrease quantity">&minus;</button>
          <span>${it.qty}</span>
          <button class="qplus" aria-label="Increase quantity">+</button>
          <button class="ci-remove" aria-label="Remove">Remove</button>
        </div>
      </div>
    </div>`).join("");
  foot.innerHTML = `
    <div class="cart-sub"><span>Subtotal</span><b>${money(subtotal())}</b></div>
    <p class="cart-note">Got a code from <a href="/game/">Peak&nbsp;Catch</a>? Enter it at checkout.</p>
    <button class="btn" id="cartCheckout" style="width:100%;justify-content:center">Checkout on Shopify</button>
    <p class="cart-secure">🔒 Secure checkout powered by Shopify</p>`;
  document.getElementById("cartCheckout").addEventListener("click", checkout);
}

/* ---- mutations ------------------------------------------------------ */
function addItem({ variant, name, price, img }) {
  if (!variant) return;
  if (cart[variant]) cart[variant].qty++;
  else cart[variant] = { qty: 1, name, price, img };
  save(cart); renderBadge(); renderDrawer(); openCart();
}
function changeQty(v, d) {
  if (!cart[v]) return;
  cart[v].qty += d;
  if (cart[v].qty <= 0) delete cart[v];
  save(cart); renderBadge(); renderDrawer();
}
function removeItem(v) { delete cart[v]; save(cart); renderBadge(); renderDrawer(); }

/* ---- open / close --------------------------------------------------- */
function openCart() {
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartDrawer").setAttribute("aria-hidden", "false");
  document.getElementById("cartOverlay").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeCart() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartDrawer").setAttribute("aria-hidden", "true");
  document.getElementById("cartOverlay").hidden = true;
  document.body.style.overflow = "";
}

/* ---- checkout ------------------------------------------------------- */
function checkoutUrl() {
  const parts = Object.entries(cart).map(([v, it]) => `${v}:${it.qty}`).join(",");
  return `https://${STORE_DOMAIN}/cart/${parts}`;
}
function checkout() {
  if (!count()) return;
  window.location.href = checkoutUrl();
}

/* ---- read a product off its card ------------------------------------ */
function productFromButton(btn) {
  const card = btn.closest(".prod-card");
  const m = (btn.getAttribute("href") || "").match(/\/cart\/(\d+):/);
  const variant = m ? m[1] : null;
  const priceText = card?.querySelector(".price")?.textContent || "0";
  return {
    variant,
    name: card?.querySelector("h3")?.textContent?.trim() || "Item",
    price: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
    img: card?.querySelector("img")?.getAttribute("src") || ""
  };
}

/* ---- wire everything ------------------------------------------------ */
injectDrawer();
renderDrawer();
renderBadge();

// add-to-cart (event delegation; keeps the anchor as a no-JS fallback)
document.addEventListener("click", e => {
  const buy = e.target.closest("a.buy");
  if (buy) { e.preventDefault(); addItem(productFromButton(buy)); return; }
  const open = e.target.closest(".cartbtn");
  if (open) { e.preventDefault(); openCart(); return; }
  // drawer qty controls
  const row = e.target.closest(".cart-item");
  if (row) {
    const v = row.dataset.v;
    if (e.target.closest(".qplus")) changeQty(v, +1);
    else if (e.target.closest(".qminus")) changeQty(v, -1);
    else if (e.target.closest(".ci-remove")) removeItem(v);
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCart(); });

// label the buy buttons for their new role
document.querySelectorAll("a.buy").forEach(b => { if (b.textContent.trim() === "Buy Now") b.textContent = "Add to Cart"; });

// Subscribe & Save — add a subscription option under each product's buy row.
// The subscribe link goes straight to Shopify's subscription checkout (selling_plan),
// so it never conflicts with the one-time cart drawer. Products on the plan only.
function injectSubscribeOptions() {
  document.querySelectorAll(".prod-card").forEach(card => {
    const buy = card.querySelector("a.buy");
    const buyrow = card.querySelector(".buyrow");
    if (!buy || !buyrow || card.querySelector(".subrow")) return;
    const m = (buy.getAttribute("href") || "").match(/\/cart\/(\d+):/);
    const variant = m ? m[1] : null;
    if (!variant || NO_SUB_VARIANTS.includes(variant)) return;
    const price = parseFloat((card.querySelector(".price")?.textContent || "0").replace(/[^0-9.]/g, ""));
    if (!price) return;
    const subPrice = Math.round(price * (1 - SUBSCRIPTION.pct / 100) * 100) / 100;
    const url = `https://${STORE_DOMAIN}/cart/${variant}:1?selling_plan=${SUBSCRIPTION.planId}`;
    const row = document.createElement("div");
    row.className = "subrow";
    row.innerHTML =
      `<span class="sub-label">&#128260; Subscribe &amp; Save ${SUBSCRIPTION.pct}%</span>` +
      `<a class="sub-buy" href="${url}">${money(subPrice)}/mo &rarr;</a>`;
    buyrow.insertAdjacentElement("afterend", row);
  });
}
injectSubscribeOptions();
