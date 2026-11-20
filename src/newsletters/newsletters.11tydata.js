// Newsletter issues (archive on News & Stories). The "Past newsletters" links appear site-wide
// automatically as soon as one issue exists in this folder.
export default {
  layout: "layouts/post.njk",
  isNewsletter: true,
  permalink: (data) => `/newsletters/${data.page.fileSlug}/`,
  eleventyComputed: { year: (data) => String(new Date(data.page.date).getUTCFullYear()) },
};
