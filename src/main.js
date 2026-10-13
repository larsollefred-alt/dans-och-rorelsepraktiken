// Mobile menu and booking form. The page works without this file:
// the menu links are also in the footer, and the form then posts normally to Netlify.

// ---------- mobile menu ----------
(() => {
  const button = document.querySelector(".menu-button");
  const menu = document.getElementById("mobilmeny");
  if (!button || !menu) return;
  const label = button.querySelector(".menu-button__label");

  const setOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
    label.textContent = open ? "Stäng" : "Meny";
  };

  button.addEventListener("click", () => setOpen(menu.hidden));
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
})();

// ---------- booking form ----------
(() => {
  const form = document.querySelector("form.booking");
  if (!form) return;
  const success = document.querySelector(".booking-success");
  const alertBox = form.querySelector(".booking__alert");
  const submit = form.querySelector(".booking__submit");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // /?intresse=<tjänst>#kontakt preselects that service.
  const wanted = new URLSearchParams(location.search).get("intresse");
  if (wanted) {
    const option = form.querySelector(`option[data-slug="${CSS.escape(wanted)}"]`);
    if (option) option.selected = true;
  }

  const showError = (name, message) => {
    const field = form.elements[name];
    const box = document.getElementById(`${name}-fel`);
    if (message) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", box.id);
      box.textContent = message;
      box.hidden = false;
    } else {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
      box.hidden = true;
    }
  };

  const validate = () => {
    const name = form.elements.namn.value.trim();
    const email = form.elements.email.value.trim();
    const errors = {
      namn: name ? "" : "Skriv ditt namn.",
      email: !email ? "Skriv din e-postadress." : EMAIL_RE.test(email) ? "" : "Kontrollera e-postadressen.",
      intresse: form.elements.intresse.value ? "" : "Välj vad du är intresserad av.",
    };
    Object.entries(errors).forEach(([field, message]) => showError(field, message));
    return Object.keys(errors).find((k) => errors[k]);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.hidden = true;
    const firstInvalid = validate();
    if (firstInvalid) {
      form.elements[firstInvalid].focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Skickar…";
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch {
      alertBox.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Skicka förfrågan";
    }
  });

  success.querySelector(".booking-success__again").addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    form.elements.namn.focus();
  });
})();

// ---------- Netlify Identity invitations ----------
// Invitation and password-reset links point to the start page; pass them on to the CMS login.
if (/(invite|recovery|confirmation|email_change)_token=/.test(location.hash) && !location.pathname.startsWith("/admin")) {
  location.replace(`/admin/${location.hash}`);
}
