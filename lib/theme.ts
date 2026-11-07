/**
 * Runs before the page paints, so the saved theme and grid size never flash the defaults. It also
 * marks signed-in visitors (data-auth="in", from Supabase's session cookie), so pages can drop the
 * introductions they've already read.
 */
export const themeScript = `(function(){var d=document.documentElement;try{if(/(^|; )sb-[^=]*-auth-token(\\.0)?=/.test(document.cookie))d.dataset.auth="in";}catch(e){}try{var t=localStorage.getItem("theme"),g=localStorage.getItem("grid");d.dataset.theme=t==="light"?"light":"dark";d.dataset.grid=g==="small"||g==="list"?g:"large";}catch(e){d.dataset.theme="dark";d.dataset.grid="large";}})();`;
