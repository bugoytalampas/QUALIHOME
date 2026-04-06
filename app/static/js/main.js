/* QUALIHOME — Main JavaScript */

// ── Toast duration ───────────────────────────────────────────────
var SQH_TOAST_DURATION = 4500;

// ── Dismiss a toast element ──────────────────────────────────────
function dismissToast(toast) {
  if (toast.dataset.sqhDismissed) return;
  toast.dataset.sqhDismissed = '1';
  toast.classList.remove('sqh-toast--visible');
  toast.classList.add('sqh-toast--hiding');
  setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
}

// ── Programmatic toast (usable from any page script) ────────────
function showToast(message, type, title) {
  type = type || 'danger';
  var container = document.getElementById('sqh-toast-container');
  if (!container) return;

  var icons  = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  var titles = { success: 'Success', danger: 'Error', warning: 'Warning', info: 'Notice' };
  var t = title || titles[type] || 'Notice';

  var toast = document.createElement('div');
  toast.className = 'sqh-toast sqh-toast--' + type;
  toast.setAttribute('role', 'alert');
  toast.innerHTML =
    '<div class="sqh-toast-icon"><i class="fas ' + (icons[type] || 'fa-info-circle') + '"></i></div>' +
    '<div class="sqh-toast-body">' +
      '<div class="sqh-toast-title">' + t + '</div>' +
      '<div class="sqh-toast-msg">' + message + '</div>' +
    '</div>' +
    '<button class="sqh-toast-close" aria-label="Close"><i class="fas fa-times"></i></button>' +
    '<div class="sqh-toast-progress"><div class="sqh-toast-progress-fill"></div></div>';

  container.appendChild(toast);

  // Slide in
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { toast.classList.add('sqh-toast--visible'); });
  });

  // Progress bar
  var fill = toast.querySelector('.sqh-toast-progress-fill');
  if (fill) {
    fill.style.transition = 'none';
    fill.style.width = '100%';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fill.style.transition = 'width ' + SQH_TOAST_DURATION + 'ms linear';
        fill.style.width = '0%';
      });
    });
  }

  var timer = setTimeout(function () { dismissToast(toast); }, SQH_TOAST_DURATION);
  var closeBtn = toast.querySelector('.sqh-toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      clearTimeout(timer);
      dismissToast(toast);
    });
  }
}

document.addEventListener('DOMContentLoaded', function () {

  // ── Activate existing flash toasts ──────────────────────────────
  document.querySelectorAll('.sqh-toast').forEach(function (toast) {
    // Slide in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('sqh-toast--visible');
      });
    });

    // Progress bar countdown
    var fill = toast.querySelector('.sqh-toast-progress-fill');
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = '100%';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          fill.style.transition = 'width ' + SQH_TOAST_DURATION + 'ms linear';
          fill.style.width = '0%';
        });
      });
    }

    // Auto-dismiss
    var timer = setTimeout(function () { dismissToast(toast); }, SQH_TOAST_DURATION);

    // Manual close
    var closeBtn = toast.querySelector('.sqh-toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        clearTimeout(timer);
        dismissToast(toast);
      });
    }
  });

  // ── Activate current nav-link based on URL ─────────────────────
  var currentPath = window.location.pathname;
  document.querySelectorAll('.sqh-navbar .nav-link').forEach(function (link) {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });

  // ── Password toggle (show/hide) ───────────────────────────────
  document.querySelectorAll('.toggle-password').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.dataset.target;
      var input    = document.getElementById(targetId);
      var icon     = btn.querySelector('i');
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  });

  // ── Confirm action modal trigger ──────────────────────────────
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var msg = el.dataset.confirm || 'Are you sure?';
      if (!window.confirm(msg)) e.preventDefault();
    });
  });

});
