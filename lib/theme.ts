/** Runs before the page paints, so the saved theme and grid size never flash the defaults. */
export const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("theme"),g=localStorage.getItem("grid");d.dataset.theme=t==="light"?"light":"dark";d.dataset.grid=g==="small"?"small":"large";}catch(e){d.dataset.theme="dark";d.dataset.grid="large";}})();`;
