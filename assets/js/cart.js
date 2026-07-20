"use strict";
/* ==========================================================
   Peak Wild — lightweight cart (no dependencies, no API token)

   How it works:
   - "Add to Cart" (.buy) adds an item to a localStorage cart shown in a
     slide-out drawer. Checkout builds ONE Shopify cart permalink for all
     items and sends the shopper to Shopify's secure hosted checkout.
   - "Subscribe & Save" (.sub-buy) is a PER-PRODUCT action: it sends the
     shopper straight to a subscription checkout for that one product via
     Shopify's /cart/add?...&selling_plan=...&return_to=/checkout endpoint.

   Why subscriptions are single-product: this store is headless (site on
   peakwildshop.com, checkout on peakwild.myshopify.com). Shopify cart
   PERMALINKS silently drop the selling plan (checkout falls back to a
   one-time, full-price order), and the cart AJAX API is cross-origin, so
   it can't be called from the site. /cart/add DOES attach the selling plan,
   but only one item per navigation — so Subscribe & Save goes item-by-item
   straight to a subscription checkout. That's the path that actually
   applies the plan + discount at checkout.

   Game reward: we deliberately do NOT auto-apply the game's discount code.
   Winners paste their earned code in Shopify's discount box at checkout.
   ========================================================== */

const STORE_DOMAIN = "peakwild.myshopify.com";  // Shopify store checkout domain
const CART_KEY = "pw_cart_v1";

// Subscribe & Save — the Shopify subscription "selling plan" ("Deliver every month").
// DEFAULT only. Products can sit on DIFFERENT selling plans with different
// discounts (e.g. Shilajit is on a 28%-off plan while the rest are on 17%), so
// each product card carries its own data-selling-plan / data-sub-pct written by
// scratchpad gen_subs.py from the live store. Sending the wrong plan id makes
// Shopify fail with "Cannot apply selling plan to variant" — so always prefer
// the per-card values and treat these as a fallback.
const SUBSCRIPTION = { planId: "6431178995", pct: 17 };
// Variants NOT on any subscription plan in Shopify — no Subscribe option shown.
const NO_SUB_VARIANTS = [];

// Read a card's own plan/discount, falling back to the store default.
const planOf = card => (card && card.dataset.sellingPlan) || SUBSCRIPTION.planId;
const pctOf  = card => {
  const p = parseFloat(card && card.dataset.subPct);
  return isNaN(p) ? SUBSCRIPTION.pct : p;
};

// Free shipping: orders at/over this subtotal ship free (keep matched to Shopify's
// shipping rule). The cart shows a progress bar nudging shoppers to the threshold.
const FREE_SHIP_THRESHOLD = 70;

/* ---- state ---------------------------------------------------------- */
const load = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch (e) { return {}; } };
const save = c => localStorage.setItem(CART_KEY, JSON.stringify(c));
let cart = load();   // { variantId: {qty, name, price, img} }

const count = () => Object.values(cart).reduce((n, i) => n + i.qty, 0);
const subtotal = () => Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
const money = n => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");

// Single-product subscription checkout URL (this is what actually attaches the
// selling plan + discount at checkout — verified against the live store).
const subCheckoutUrl = (variant, qty = 1, planId = SUBSCRIPTION.planId) => {
  // A per-product subscription must check out with ONLY this item. /cart/add
  // APPENDS to the persistent Shopify server cart, so without clearing first,
  // stale items from earlier subscribe clicks pile up at checkout. /cart/clear
  // honors return_to (verified against the live store), so we chain:
  //   clear the cart -> add just this item (with its plan) -> go to checkout.
  const add = `/cart/add?id=${variant}&quantity=${qty}` +
    `&selling_plan=${planId}&return_to=/checkout`;
  return `https://${STORE_DOMAIN}/cart/clear?return_to=${encodeURIComponent(add)}`;
};

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

// Free-shipping progress bar for the drawer footer.
function shipBar(amount) {
  const remaining = Math.round((FREE_SHIP_THRESHOLD - amount) * 100) / 100;
  const pct = Math.max(0, Math.min(100, (amount / FREE_SHIP_THRESHOLD) * 100));
  const unlocked = remaining <= 0;
  const msg = unlocked
    ? `🎉 You’ve unlocked <b>free shipping!</b>`
    : `You’re <b>${money(remaining)}</b> away from <b>free shipping</b>`;
  return `
    <div class="ship-bar ${unlocked ? "done" : ""}">
      <div class="ship-msg">${msg}</div>
      <div class="ship-track"><div class="ship-fill" style="width:${pct}%"></div></div>
    </div>`;
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

  const total = subtotal();
  foot.innerHTML = `
    ${shipBar(total)}
    <div class="cart-sub"><span>Subtotal</span><b>${money(total)}</b></div>
    <p class="cart-note">🔄 Want it monthly? Use <b>Subscribe &amp; Save</b> on any product for ${SUBSCRIPTION.pct}% off.
      Got a code from <a href="/game/">Peak&nbsp;Catch</a>? Enter it at checkout.</p>
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
  if (window.fbq) fbq("track", "AddToCart",
    { content_ids: [variant], content_name: name, content_type: "product", value: price, currency: "USD" });
}
function changeQty(v, d) {
  if (!cart[v]) return;
  cart[v].qty += d;
  if (cart[v].qty <= 0) delete cart[v];
  save(cart); renderBadge(); renderDrawer();
}
function removeItem(v) {
  delete cart[v];
  save(cart); renderBadge(); renderDrawer();
}

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

/* ---- checkout (one-time, multi-item) -------------------------------- */
// Optional discount auto-applied at checkout, ONLY when a page opts in via
// window.PW_DISCOUNT (e.g. a paid landing page). Pages that don't set it are
// unchanged — the game-reward code stays "paste it at checkout" everywhere else.
function discountQuery() {
  const code = (typeof window !== "undefined" && window.PW_DISCOUNT ? String(window.PW_DISCOUNT) : "").trim();
  return code ? `?discount=${encodeURIComponent(code)}` : "";
}
function checkoutUrl() {
  const parts = Object.entries(cart).map(([v, it]) => `${v}:${it.qty}`).join(",");
  return `https://${STORE_DOMAIN}/cart/${parts}${discountQuery()}`;
}
function checkout() {
  if (!count()) return;
  if (window.fbq) fbq("track", "InitiateCheckout",
    { value: subtotal(), currency: "USD", num_items: count() });
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

document.addEventListener("click", e => {
  // Add to Cart (one-time) — keeps the anchor as a no-JS fallback
  const buy = e.target.closest("a.buy");
  if (buy) { e.preventDefault(); addItem(productFromButton(buy)); return; }
  // Subscribe & Save — go straight to a single-product subscription checkout
  const subBuy = e.target.closest("a.sub-buy");
  if (subBuy) {
    e.preventDefault();
    if (window.fbq) fbq("track", "InitiateCheckout",
      { content_type: "product", num_items: 1, currency: "USD" });
    window.location.href = subBuy.getAttribute("href");
    return;
  }
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

// Subscribe & Save — add a per-product subscription option under each buy row.
// Clicking it goes straight to a subscription checkout for that product (the
// href is a valid subscription checkout link, so it also works with JS off).
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
    const pct = pctOf(card), plan = planOf(card);
    const subPrice = Math.round(price * (1 - pct / 100) * 100) / 100;
    const row = document.createElement("div");
    row.className = "subrow";
    row.innerHTML =
      `<div class="sub-info">` +
        `<span class="sub-label">&#128260; Subscribe &amp; Save ${pct}%</span>` +
        `<span class="sub-note">Your best price &middot; skip or cancel anytime</span>` +
      `</div>` +
      `<a class="sub-buy" href="${subCheckoutUrl(variant, 1, plan)}">` +
        `${money(subPrice)}<span class="sub-per">/mo</span></a>`;
    buyrow.insertAdjacentElement("afterend", row);
  });
}
injectSubscribeOptions();
