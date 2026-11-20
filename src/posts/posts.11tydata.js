// News & Stories posts: one Markdown file per post (Pages CMS writes them). Address: /news/<file name without the date>/
export default {
  layout: "layouts/post.njk",
  permalink: (data) => `/news/${data.page.fileSlug}/`,
};
