// ===== CHOC — shared site script (nav, cart, checkout, modals) =====
// Loaded on every page. Safe to run even on pages with no products yet —
// each block checks the relevant elements exist before wiring anything up.

// Info modals (Sizing / Materials / Terms) — open via any [data-info] link
(function () {
    function openInfo(id) {
        var overlay = document.getElementById('info-' + id);
        if (overlay) overlay.classList.add('open');
    }
    function closeAll() {
        document.querySelectorAll('.info-overlay.open').forEach(function (o) {
            o.classList.remove('open');
        });
    }
    document.querySelectorAll('[data-info]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            closeAll();
            openInfo(link.getAttribute('data-info'));
        });
    });
    document.querySelectorAll('.info-overlay').forEach(function (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay || e.target.classList.contains('close')) {
                overlay.classList.remove('open');
            }
        });
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAll();
    });
})();

// Thumbnail gallery swap (only relevant on pages with products)
document.querySelectorAll('.product').forEach(function (product) {
    var main = product.querySelector('.product-img');
    product.querySelectorAll('.thumb').forEach(function (thumb) {
        thumb.addEventListener('click', function () {
            main.src = thumb.src;
            product.querySelectorAll('.thumb').forEach(function (t) { t.classList.remove('active'); });
            thumb.classList.add('active');
        });
    });
});

// Image lightbox: click a product image to enlarge
(function () {
    var lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxClose = document.getElementById('lightboxClose');

    function openLightbox(src, alt) {
        lightboxImg.src = src;
        lightboxImg.alt = alt || 'Enlarged product image';
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
    }

    document.querySelectorAll('.product-img').forEach(function (img) {
        img.addEventListener('click', function () {
            openLightbox(img.src, img.alt);
        });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
    });
})();

// ===== CART + SIZE PICKER + EMBEDDED STRIPE CHECKOUT =====
(function () {
    // Cloudflare Worker that creates the Stripe Checkout Session.
    var CHECKOUT_ENDPOINT = 'https://choc-checkout.ethan-d1a.workers.dev';
    // Publishable key is safe in public front-end code.
    var STRIPE_PUBLISHABLE_KEY = 'pk_live_51U0iKMICTTxpFptqPrOCbxnl4vi1RwQhlkT9eSPBLYSRti0bPxM4CXzABomeui8LBQ3H2U68tGWgd1OZspzSCCaD00oZ9a9j2W';
    var STORAGE_KEY = 'choc_cart';

    var cart = load();

    function load() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch (e) { return []; }
    }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); }

    function addItem(item) {
        var existing = cart.find(function (l) { return l.id === item.id && l.size === item.size; });
        if (existing) { existing.qty += 1; } else { cart.push(item); }
        save(); render();
    }
    function setQty(id, size, qty) {
        var line = cart.find(function (l) { return l.id === id && l.size === size; });
        if (!line) return;
        line.qty = qty;
        if (line.qty <= 0) { cart = cart.filter(function (l) { return !(l.id === id && l.size === size); }); }
        save(); render();
    }
    function removeItem(id, size) {
        cart = cart.filter(function (l) { return !(l.id === id && l.size === size); });
        save(); render();
    }
    function count() { return cart.reduce(function (n, l) { return n + l.qty; }, 0); }
    function subtotal() { return cart.reduce(function (s, l) { return s + l.price * l.qty; }, 0); }
    function money(n) { return '£' + n.toFixed(2); }

    var overlay = document.getElementById('cartOverlay');
    var drawer = document.getElementById('cartDrawer');
    var itemsEl = document.getElementById('cartItems');
    var subtotalEl = document.getElementById('cartSubtotal');
    var checkoutBtn = document.getElementById('cartCheckout');
    var countEls = document.querySelectorAll('.cart-count');

    // If the cart chrome isn't on this page for some reason, bail out safely.
    if (!overlay || !drawer || !itemsEl || !subtotalEl || !checkoutBtn) return;

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function render() {
        var c = count();
        countEls.forEach(function (el) { el.textContent = c; });
        if (cart.length === 0) {
            itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
        } else {
            itemsEl.innerHTML = cart.map(function (l) {
                return '<div class="cart-line">' +
                    '<img src="' + esc(l.image) + '" alt="' + esc(l.name) + '" />' +
                    '<div class="cart-line__info">' +
                        '<p class="cart-line__name">' + esc(l.name) + '</p>' +
                        '<p class="cart-line__size">Size: ' + esc(l.size) + '</p>' +
                        '<div class="cart-line__row">' +
                            '<div class="qty-stepper">' +
                                '<button data-act="dec" data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '">&minus;</button>' +
                                '<span>' + l.qty + '</span>' +
                                '<button data-act="inc" data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '">+</button>' +
                            '</div>' +
                            '<span class="cart-line__price">' + money(l.price * l.qty) + '</span>' +
                        '</div>' +
                        '<button class="cart-line__remove" data-act="rm" data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '">Remove</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        subtotalEl.textContent = money(subtotal());
        checkoutBtn.disabled = cart.length === 0;
    }

    itemsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var id = btn.dataset.id, size = btn.dataset.size;
        var line = cart.find(function (l) { return l.id === id && l.size === size; });
        if (!line) return;
        if (btn.dataset.act === 'inc') setQty(id, size, line.qty + 1);
        else if (btn.dataset.act === 'dec') setQty(id, size, line.qty - 1);
        else if (btn.dataset.act === 'rm') removeItem(id, size);
    });

    function openCart() { overlay.classList.add('open'); drawer.classList.add('open'); }
    function closeCart() { overlay.classList.remove('open'); drawer.classList.remove('open'); }
    var cartOpenBtn = document.getElementById('cartOpen');
    if (cartOpenBtn) cartOpenBtn.addEventListener('click', openCart);
    document.getElementById('cartClose').addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);

    // ----- Embedded Stripe checkout (renders inside the site) -----
    var stripeInstance = null;
    var embeddedCheckout = null;
    var coOverlay = document.getElementById('checkoutOverlay');

    checkoutBtn.addEventListener('click', openCheckout);
    var checkoutCloseBtn = document.getElementById('checkoutClose');
    if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckout);

    function openCheckout() {
        if (cart.length === 0 || !coOverlay) return;
        closeCart();
        coOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (!stripeInstance) stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
        if (embeddedCheckout) { embeddedCheckout.destroy(); embeddedCheckout = null; }
        document.getElementById('embedded-checkout').innerHTML = '';
        stripeInstance.initEmbeddedCheckout({
            fetchClientSecret: function () {
                return fetch(CHECKOUT_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: cart.map(function (l) { return { id: l.id, size: l.size, qty: l.qty }; }) })
                })
                .then(function (r) { return r.json(); })
                .then(function (d) { if (!d.client_secret) throw new Error('No client secret'); return d.client_secret; });
            }
        }).then(function (checkout) {
            embeddedCheckout = checkout;
            checkout.mount('#embedded-checkout');
        }).catch(function () {
            alert('Sorry — checkout is temporarily unavailable. Please try again shortly.');
            closeCheckout();
        });
    }

    function closeCheckout() {
        if (!coOverlay) return;
        coOverlay.classList.remove('open');
        document.body.style.overflow = '';
        if (embeddedCheckout) { embeddedCheckout.destroy(); embeddedCheckout = null; }
    }

    // ----- Size picker: pick size, then add to cart -----
    var sizeOverlay = document.getElementById('sizeOverlay');
    if (sizeOverlay) {
        var nameEl = document.getElementById('sizeProductName');
        var sizeCloseBtn = document.getElementById('sizeClose');
        var confirmBtn = document.getElementById('sizeConfirm');
        var sizeButtons = document.querySelectorAll('.size-grid button');
        var activeBtn = null;
        var chosenSize = null;

        document.querySelectorAll('.add-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                openSize(btn);
            });
        });

        function openSize(btn) {
            activeBtn = btn;
            chosenSize = null;
            sizeButtons.forEach(function (b) { b.classList.remove('selected'); });
            confirmBtn.disabled = true;
            nameEl.textContent = btn.getAttribute('data-item-name') || 'Choose a Size';
            sizeOverlay.classList.add('open');
        }
        function closeSize() {
            sizeOverlay.classList.remove('open');
            activeBtn = null; chosenSize = null;
        }

        sizeButtons.forEach(function (sizeBtn) {
            sizeBtn.addEventListener('click', function () {
                chosenSize = sizeBtn.getAttribute('data-size');
                sizeButtons.forEach(function (b) { b.classList.remove('selected'); });
                sizeBtn.classList.add('selected');
                confirmBtn.disabled = false;
            });
        });

        confirmBtn.addEventListener('click', function () {
            if (!activeBtn || !chosenSize) return;
            addItem({
                id: activeBtn.getAttribute('data-item-id'),
                name: activeBtn.getAttribute('data-item-name'),
                price: parseFloat(activeBtn.getAttribute('data-item-price')),
                image: activeBtn.getAttribute('data-item-image'),
                size: chosenSize,
                qty: 1
            });
            closeSize();
            openCart();
        });

        sizeCloseBtn.addEventListener('click', closeSize);
        sizeOverlay.addEventListener('click', function (e) {
            if (e.target === sizeOverlay) closeSize();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeSize(); closeCart(); }
        });
    }

    render();
})();
