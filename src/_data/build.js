// Cache-busting tag added to CSS/JS links (?v=...). Changes on every build.
export default { version: Date.now().toString(36), year: new Date().getFullYear() };
