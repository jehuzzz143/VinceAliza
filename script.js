/* ==========================================================================
   VINCE & ALIZA — LUXURY WEDDING INVITATION
   script.js
   Vanilla JS only. Organized into small modules, each initialised once the
   DOM is ready. Every module is self-contained so sections can be lifted
   out independently if needed.
   ========================================================================== */

(function () {
  'use strict';

  /* Respect the visitor's motion preference across every module below. */
  var PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The wedding moment the countdown & copy revolve around. */
  var WEDDING_DATE = new Date('2026-11-14T15:30:00+08:00');

  /* --------------------------------------------------------------
     Google Apps Script Web App deployment shared by:
       - initRsvpForm()  -> POSTs new RSVPs into the Sheet
       - initWishesWall() -> GETs existing rows back out to display
     doPost(e) expects a JSON body (e.postData.contents) with keys
     fullname/email/guests/attendance/message — sent as text/plain to
     dodge the CORS preflight Apps Script can't answer. doGet(e) must
     return a JSON array of objects; this deployment's version only
     includes { fullname, message }, so the wishes wall shows each
     guest's name and note but not their attendance status.
  -------------------------------------------------------------- */
  var GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoNtsJwFTZv7K9qYKFnS4zIB3Xh_fwaI3-2FtLuskZCuHhQ2Tj-OpHeESfvJmxSdAU/exec';

  /* ------------------------------------------------------------------
     UTIL: run fn once the DOM is parsed
  ------------------------------------------------------------------ */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ==================================================================
     MODULE: LOADING SCREEN
     Fakes an asset-loading progress bar, then hands off to the
     invitation gate. Real image/font loading is tracked so the bar
     never finishes before the hero art is actually ready.
  ================================================================== */
  function initLoader(onDone) {
    var screen = document.getElementById('loading-screen');
    var fill = document.getElementById('loading-bar-fill');
    if (!screen || !fill) { onDone(); return; }

    var progress = 0;
    var assetsReady = false;

    // Track real network readiness: fonts + the hero background image.
    var heroImg = new Image();
    heroImg.src = document.querySelector('#hero-bg img') ? document.querySelector('#hero-bg img').src : '';
    var fontsPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var imgPromise = new Promise(function (resolve) {
      if (!heroImg.src) return resolve();
      heroImg.onload = resolve;
      heroImg.onerror = resolve;
    });

    Promise.all([fontsPromise, imgPromise]).then(function () {
      assetsReady = true;
    });

    var tick = setInterval(function () {
      // Ease toward 90% while waiting on real assets; only the final
      // stretch to 100% requires assetsReady, so the bar feels alive
      // instead of stalling on a slow connection.
      var ceiling = assetsReady ? 100 : 90;
      progress += (ceiling - progress) * 0.12 + 0.6;
      if (progress >= ceiling) progress = ceiling;
      fill.style.width = progress + '%';

      if (progress >= 100) {
        clearInterval(tick);
        setTimeout(function () {
          screen.classList.add('is-hidden');
          setTimeout(onDone, 700);
        }, 250);
      }
    }, 90);

    // Safety net: never trap a guest behind the loader for more than 4.5s.
    setTimeout(function () { assetsReady = true; }, 4500);
  }

  /* ==================================================================
     MODULE: INVITATION GATE (envelope + card open)
  ================================================================== */
  function initInvitationGate() {
    var gate = document.getElementById('invitation-gate');
    var card = document.getElementById('invitation-card');
    if (!gate || !card) return;

    card.addEventListener('click', openInvitation);
    card.addEventListener('keyup', function (e) {
      if (e.key === 'Enter' || e.key === ' ') openInvitation();
    });

    function openInvitation() {
      if (card.classList.contains('is-opening')) return;
      card.classList.add('is-opening');
      card.setAttribute('aria-hidden', 'true');

      // Cinematic beat: let the card animate away before the gate fades
      // and the homepage becomes interactive underneath it.
      setTimeout(function () {
        gate.classList.add('is-hidden');
        document.body.classList.remove('no-scroll');
        gate.setAttribute('aria-hidden', 'true');
        startMusicPlayer();
      }, 550);
    }
  }

  /* ==================================================================
     MODULE: BACKGROUND MUSIC PLAYER
  ================================================================== */
  var musicState = { started: false };

  function startMusicPlayer() {
    var player = document.getElementById('music-player');
    var audio = document.getElementById('bg-audio');
    var toggle = document.getElementById('music-toggle');
    if (!player || !audio || !toggle) return;

    player.classList.add('is-visible');
    musicState.started = true;

    // Autoplay after the gate opens (a user gesture already happened —
    // the tap on the invitation card — so most browsers allow this).
    // play() can still legally reject (e.g. missing/blocked audio file);
    // that's expected until a real MP3 is dropped in assets/audio/, so
    // we fail quietly and simply leave the player in its paused state.
    var playPromise = audio.play();
    if (playPromise && playPromise.then) {
      playPromise.then(function () {
        setPlayingUI(true);
      }).catch(function () {
        setPlayingUI(false);
      });
    }

    toggle.addEventListener('click', function () {
      if (audio.paused) {
        audio.play().then(function () { setPlayingUI(true); }).catch(function () {});
      } else {
        audio.pause();
        setPlayingUI(false);
      }
    });

    function setPlayingUI(isPlaying) {
      toggle.classList.toggle('is-playing', isPlaying);
      player.classList.toggle('is-playing', isPlaying);
      toggle.setAttribute('aria-pressed', String(isPlaying));
      toggle.setAttribute('aria-label', isPlaying ? 'Pause background music' : 'Play background music');
    }
  }

  /* ==================================================================
     MODULE: NAVIGATION
     - Smooth anchor scroll
     - Active-section highlight via IntersectionObserver
     - Hide on scroll down / show on scroll up
     - Mobile hamburger toggle
  ================================================================== */
  function initNav() {
    var nav = document.getElementById('site-nav');
    var toggle = document.getElementById('nav-toggle');
    var links = document.getElementById('nav-links');
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
    if (!nav) return;

    // --- Mobile menu open/close ---
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        var isOpen = links.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      });
      navLinks.forEach(function (link) {
        link.addEventListener('click', function () {
          links.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // --- Smooth anchor scrolling (native smooth-scroll already set via
    //     CSS `scroll-behavior`, this just accounts for the fixed nav) ---
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: top, behavior: PREFERS_REDUCED_MOTION ? 'auto' : 'smooth' });
      });
    });

    // --- Hide on scroll down, reveal on scroll up ---
    var lastY = window.pageYOffset;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var y = window.pageYOffset;
          if (y > lastY && y > 140) {
            nav.classList.add('nav-hidden');
          } else {
            nav.classList.remove('nav-hidden');
          }
          lastY = y;
          ticking = false;
        });
        ticking = true;
      }
    });

    // --- Active section highlight ---
    var sections = navLinks
      .map(function (l) { return document.querySelector(l.getAttribute('href')); })
      .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      var sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = '#' + entry.target.id;
          navLinks.forEach(function (l) {
            l.classList.toggle('active', l.getAttribute('href') === id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

      sections.forEach(function (s) { sectionObserver.observe(s); });
    }
  }

  /* ==================================================================
     MODULE: COUNTDOWN
  ================================================================== */
  function initCountdown() {
    var daysEl = document.getElementById('count-days');
    var hoursEl = document.getElementById('count-hours');
    var minsEl = document.getElementById('count-minutes');
    var secsEl = document.getElementById('count-seconds');
    if (!daysEl) return;

    function pad(n) { return String(n).padStart(2, '0'); }

    function update() {
      var diff = WEDDING_DATE.getTime() - Date.now();
      if (diff < 0) diff = 0;

      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);
      var secs = Math.floor((diff % 60000) / 1000);

      setIfChanged(daysEl, pad(days));
      setIfChanged(hoursEl, pad(hours));
      setIfChanged(minsEl, pad(mins));
      setIfChanged(secsEl, pad(secs));
    }

    // Only touch the DOM (and re-trigger the fade) when a value actually
    // changes, keeping this comfortably inside a 60fps budget.
    function setIfChanged(el, value) {
      if (el.textContent === value) return;
      el.textContent = value;
      if (PREFERS_REDUCED_MOTION) return;
      el.style.animation = 'none';
      // Force reflow so the animation can restart on every tick.
      void el.offsetWidth;
      el.style.animation = 'fade-in-soft 0.4s ease-out';
    }

    update();
    setInterval(update, 1000);
  }

  /* ==================================================================
     MODULE: SCROLL REVEAL
     Generic fade-up/left/right/scale reveal driven by [data-reveal].
  ================================================================== */
  function initScrollReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || PREFERS_REDUCED_MOTION) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ==================================================================
     MODULE: AMBIENT LEAVES & PETALS
     Continuously spawns lightweight SVG leaves/petals that drift down
     across the whole page, plus a denser burst behind the hero title.
     Pure CSS transform/opacity animation for 60fps; JS only handles
     timed creation/removal so the DOM never accumulates nodes.
  ================================================================== */
  function initAmbientParticles() {
    if (PREFERS_REDUCED_MOTION) return;

    var globalLayer = document.getElementById('ambient-leaves');
    var heroLayer = document.querySelector('.hero-leaves');

    var LEAF_SVG =
      '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2C6 8 4 14 12 22C20 14 18 8 12 2Z" fill="#87986A" opacity="0.75"/></svg>';
    var PETAL_SVG =
      '<svg width="14" height="14" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="7" ry="10" fill="#E8DDC8" opacity="0.85"/></svg>';

    function spawn(layer, markup, sizeRange) {
      if (!layer) return;
      var el = document.createElement('div');
      el.className = markup === LEAF_SVG ? 'leaf' : 'petal';
      el.innerHTML = markup;
      el.setAttribute('aria-hidden', 'true');

      var startX = Math.random() * 100;
      var drift = (Math.random() * 160 - 80).toFixed(0) + 'px';
      var rotate = (Math.random() * 540 + 180).toFixed(0) + 'deg';
      var duration = (Math.random() * 8 + 9).toFixed(1) + 's';
      var scale = (Math.random() * 0.6 + sizeRange).toFixed(2);

      el.style.left = startX + '%';
      el.style.setProperty('--drift-x', drift);
      el.style.setProperty('--drift-r', rotate);
      el.style.transform = 'scale(' + scale + ')';
      el.style.animation = 'drift-down ' + duration + ' linear forwards';

      layer.appendChild(el);
      setTimeout(function () { el.remove(); }, parseFloat(duration) * 1000 + 200);
    }

    // Background ambience across the full page.
    setInterval(function () { spawn(globalLayer, LEAF_SVG, 0.6); }, 2200);
    setInterval(function () { spawn(globalLayer, PETAL_SVG, 0.5); }, 3100);

    // A slightly denser flourish specifically over the hero.
    setInterval(function () { spawn(heroLayer, LEAF_SVG, 0.7); }, 1500);
  }

  /* ==================================================================
     MODULE: MOUSE PARALLAX (hero)
     Subtle desktop-only parallax on the hero background + title.
  ================================================================== */
  function initParallax() {
    if (PREFERS_REDUCED_MOTION) return;
    var hero = document.getElementById('home');
    var bg = document.getElementById('hero-bg');
    var content = document.querySelector('.hero-content');
    if (!hero || !bg) return;
    if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch

    var rafId = null;
    hero.addEventListener('mousemove', function (e) {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        var rect = hero.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        bg.style.transform = 'translate3d(' + (x * -14) + 'px,' + (y * -14) + 'px, 0)';
        if (content) content.style.transform = 'translate3d(' + (x * 10) + 'px,' + (y * 10) + 'px, 0)';
        rafId = null;
      });
    });
    hero.addEventListener('mouseleave', function () {
      bg.style.transform = '';
      if (content) content.style.transform = '';
    });
  }

  /* ==================================================================
     MODULE: QUOTE PARALLAX
     The love-quote background photo drifts at a slower rate than the
     page scroll, giving the full-bleed section a sense of depth.
  ================================================================== */
  function initQuoteParallax() {
    if (PREFERS_REDUCED_MOTION) return;
    var section = document.querySelector('.quote-section');
    var img = section && section.querySelector('.quote-bg img');
    if (!section || !img) return;

    var ticking = false;
    function update() {
      var rect = section.getBoundingClientRect();
      var vh = window.innerHeight;
      // 0 when the section is centered in the viewport; negative above, positive below.
      var progress = (rect.top + rect.height / 2 - vh / 2) / (vh + rect.height);
      img.style.transform = 'translate3d(0,' + (progress * -50) + 'px,0)';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ==================================================================
     MODULE: GALLERY LIGHTBOX
     Click/keyboard/swipe capable lightbox shared by every gallery item.
  ================================================================== */
  function initLightbox() {
    var triggers = Array.prototype.slice.call(document.querySelectorAll('.gallery-trigger'));
    var lightbox = document.getElementById('lightbox');
    var imgEl = document.getElementById('lightbox-img');
    var captionEl = document.getElementById('lightbox-caption');
    var closeBtn = document.getElementById('lightbox-close');
    var prevBtn = document.getElementById('lightbox-prev');
    var nextBtn = document.getElementById('lightbox-next');
    if (!triggers.length || !lightbox) return;

    var currentIndex = 0;
    var lastFocused = null;

    function openAt(index) {
      currentIndex = (index + triggers.length) % triggers.length;
      var t = triggers[currentIndex];
      imgEl.src = t.getAttribute('data-full');
      imgEl.alt = t.querySelector('img').alt;
      captionEl.textContent = t.getAttribute('data-caption') || '';
      lastFocused = document.activeElement;
      lightbox.hidden = false;
      requestAnimationFrame(function () { lightbox.classList.add('is-visible'); });
      document.body.classList.add('no-scroll');
      closeBtn.focus();
    }

    function close() {
      lightbox.classList.remove('is-visible');
      document.body.classList.remove('no-scroll');
      setTimeout(function () { lightbox.hidden = true; }, 300);
      if (lastFocused) lastFocused.focus();
    }

    triggers.forEach(function (t, i) {
      t.addEventListener('click', function () { openAt(i); });
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { openAt(currentIndex - 1); });
    nextBtn.addEventListener('click', function () { openAt(currentIndex + 1); });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') openAt(currentIndex - 1);
      if (e.key === 'ArrowRight') openAt(currentIndex + 1);
    });

    // --- Swipe support (touch) ---
    var touchStartX = null;
    lightbox.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 40) {
        openAt(currentIndex + (delta < 0 ? 1 : -1));
      }
      touchStartX = null;
    }, { passive: true });
  }

  /* ==================================================================
     MODULE: FAQ ACCORDION
     Only one question stays open at a time; the CSS grid-template-rows
     trick on .faq-answer handles the smooth expand/collapse animation.
  ================================================================== */
  function initFaq() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    if (!items.length) return;

    items.forEach(function (item) {
      var btn = item.querySelector('.faq-question');
      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');
        items.forEach(function (other) {
          other.classList.remove('is-open');
          other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ==================================================================
     MODULE: BUTTON RIPPLE
     Adds a Material-esque ripple to any .btn on click/tap.
  ================================================================== */
  function initRipple() {
    document.querySelectorAll('.btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var rect = btn.getBoundingClientRect();
        var ripple = document.createElement('span');
        var size = Math.max(rect.width, rect.height);
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 650);
      });
    });
  }

  /* ==================================================================
     MODULE: RSVP FORM
     Submits directly to a Google Apps Script Web App (deployed to write
     rows into a Google Sheet) — no backend/database of our own.
  ================================================================== */
  function initRsvpForm() {
    var form = document.getElementById('rsvp-form');
    var submitBtn = document.getElementById('rsvp-submit');
    if (!form) return;

    var rsvpDeadline = new Date('2026-10-17T23:59:59+08:00');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Check RSVP deadline
      if (new Date() > rsvpDeadline) {
        showToast('error', 'RSVP submissions are now closed. Thank you!');
        return;
      }
      if (!form.reportValidity()) return;

      var data = new FormData(form);
      // Keys match the Apps Script doPost(e) contract exactly (it reads
      // data.fullname, not data.name) — a mismatch here silently drops
      // every submission since the sheet's required-field check fails.
      var payload = {
        fullname: data.get('name'),
        email: data.get('email'),
        // No guest-count field in the form anymore — every RSVP is for one.
        guests: '1',
        attendance: data.get('attendance'),
        message: data.get('message')
      };
      setLoading(true);

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        // A JSON content-type would trigger a CORS preflight Apps Script
        // can't answer, so the body is sent as text/plain — Apps Script
        // still reads the raw JSON fine via e.postData.contents. This is
        // a "simple request", so (unlike a no-cors call) the response
        // stays readable — needed to surface the sheet's own duplicate-
        // email / validation messages back to the guest.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (result && result.success) {
            showToast('success', result.message || 'Thank you! Your RSVP has been received.');
            form.reset();
            // Give the Sheet a moment to save, then pull the new message
            // into the wall below so the guest sees their own note appear.
            setTimeout(refreshWishesWall, 1200);
          } else {
            showToast('error', (result && result.message) || 'Something went wrong. Please try again.');
          }
        })
        .catch(function () {
          showToast('error', 'Something went wrong. Please try again or reach out to us directly.');
        })
        .finally(function () {
          setLoading(false);
        });
    });

    function setLoading(isLoading) {
      submitBtn.classList.toggle('is-loading', isLoading);
      submitBtn.disabled = isLoading;
    }

  }

  /* ==================================================================
     MODULE: TOAST
     Small floating notification used for RSVP success/error feedback.
  ================================================================== */
  var toastTimer = null;
  function showToast(kind, message) {
    var toast = document.getElementById('toast');
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove('toast--success', 'toast--error');
    toast.classList.add(kind === 'success' ? 'toast--success' : 'toast--error');
    toast.classList.add('is-visible');

    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 5000);
  }

  /* ==================================================================
     MODULE: WORDS OF LOVE WALL
     Reads RSVP messages back from the same Google Sheet and displays
     them as a horizontally auto-scrolling, randomly-tilted marquee.
     Requires the Apps Script deployment to implement doGet(e) — see
     assets/google-apps-script.gs.txt for a ready-to-paste example.
  ================================================================== */
  var refreshWishesWall = function () {}; // reassigned once initWishesWall() runs

  function initWishesWall() {
    var marquee = document.getElementById('wishes-marquee');
    var track = document.getElementById('wishes-track');
    var emptyMsg = document.getElementById('wishes-empty');
    if (!track || !marquee) return;

    function load() {
      fetch(GOOGLE_SCRIPT_URL, { method: 'GET' })
        .then(function (res) { return res.json(); })
        .then(render)
        .catch(showEmpty);
    }

    function render(rows) {
      if (!Array.isArray(rows)) return showEmpty();

      var wishes = rows
        .filter(function (r) { return r && r.message && String(r.message).trim(); })
        .map(function (r) {
          return {
            name: String(r.fullname || 'A Guest').trim(),
            attendance: String(r.attendance || '').trim(),
            message: String(r.message).trim()
          };
        });

      if (!wishes.length) return showEmpty();

      shuffle(wishes);

      // Duplicate the shuffled list once so the CSS marquee
      // (translateX -50%) loops seamlessly with no visible seam.
      var cardsHtml = wishes.concat(wishes).map(buildCardHtml).join('');
      track.innerHTML = cardsHtml;
      marquee.hidden = false;
      emptyMsg.hidden = true;
    }

    function buildCardHtml(wish) {
      // Small random tilt/vertical offset per card gives the "randomly
      // arranged" pinboard feel the brief asked for, rather than a grid.
      var tilt = (Math.random() * 6 - 3).toFixed(1);
      var offset = (Math.random() * 16 - 8).toFixed(0);
      var badge = wish.attendance
        ? '<span class="wish-badge">' + escapeHtml(wish.attendance) + '</span>'
        : '';
      return (
        '<article class="wish-card" style="--tilt:' + tilt + 'deg;--offset:' + offset + 'px">' +
          '<p class="wish-message">“' + escapeHtml(wish.message) + '”</p>' +
          '<p class="wish-name">' + escapeHtml(wish.name) + '</p>' +
          badge +
        '</article>'
      );
    }

    function showEmpty() {
      marquee.hidden = true;
      emptyMsg.hidden = false;
    }

    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
    }

    // Escaping via textContent (never innerHTML) on a scratch element
    // keeps user-submitted RSVP messages from being able to inject markup.
    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    refreshWishesWall = load;
    load();
  }

  /* ==================================================================
     BOOT
  ================================================================== */
  ready(function () {
    document.body.classList.add('no-scroll'); // locked until gate opens

    initNav();
    initCountdown();
    initScrollReveal();
    initAmbientParticles();
    initParallax();
    initQuoteParallax();
    initLightbox();
    initFaq();
    initRipple();
    initRsvpForm();
    initWishesWall();
    initInvitationGate();

    initLoader(function () {
      // Loader has finished; the invitation gate (already in the DOM,
      // sitting above the homepage) is what the guest sees next.
    });
  });
})();
