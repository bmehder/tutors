# SEO and AI search plan

Recovered from the November 19, 2026 discussion. Local first pass prepared November 20.

## Current work

- Prepared: descriptive homepage, tutor-directory, and tutor-profile titles and descriptions. Branding remains in the visible homepage copy.
- Already implemented: the planner's initial package screen is server-rendered from the same Gleam model and view. Prices, student limits, session length, and weekly scheduling explanations are readable before JavaScript loads. Keep one package chooser; no planner redesign.
- Prepared: Organization and tutoring Service structured data, plus tutor ProfilePage/Person and page breadcrumbs. Only describe visible, verified content. No fabricated review ratings or business addresses.
- Prepared: dynamic `/sitemap.xml` containing the homepage, directory, and active tutor profile slugs. Excludes admin, APIs, previews, checkout, and archived profiles. Canonicals use `https://www.mychristiantutors.com`.
- Preserved: `noindex, nofollow, noarchive` in HTML and Vercel headers. Robots.txt allows crawling so crawlers can read the noindex rule. No indexing launch has been authorized.

## Next content work

1. Select a small set of useful subject pages, such as Algebra, Biology, and Writing. Explain the help available, show tutors using the actual catalog, answer subject-specific questions, and link into planning. Avoid thin pages for every possible search phrase.
2. Ask tutors to confirm their teaching approaches and the problems they help students solve. Keep MyFunScience classroom experience distinct from this tutoring service. Do not invent credentials or tutor-specific claims.
3. Replace the two temporary testimonials with real statements before indexing. Confirm tutor profiles, pricing, the free-session offer terms, cancellation/rescheduling policies, and contact information. Keep the relationship with MyFunScience clear.

## At public launch

1. Make an explicit indexing decision. Update both the HTML robots meta tag and Vercel response header together, retaining noindex for admin, checkout, previews, and other private pages.
2. Check the www domain, HTTPS, canonicals, and any alternate-domain handling. Verify the sitemap against the live catalog.
3. Register the domain with Google Search Console and Bing Webmaster Tools and submit the sitemap. Add its URL to robots.txt.
4. Decide crawler access for AI search. OAI-SearchBot and model-training crawler GPTBot are separate choices; no permission change has been made yet.
5. Monitor indexing and search results after launch. Structured data and readable text support understanding; they do not guarantee rich results or AI citations.

## Verification

Local checks confirm the homepage/directory/profile metadata, parseable JSON-LD, package prices in the initial HTML, and 16 unique public sitemap URLs. Both prelaunch indexing protections remain intact. Further subject/content work requires editorial review.

## Guidance

- [Google AI search guidance](https://developers.google.com/search/docs/appearance/ai-features): normal SEO fundamentals apply; no special AI markup is required.
- [Google Search Essentials](https://developers.google.com/search/docs/essentials).
- [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization).
- [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing): a crawler must be able to access a page to read its noindex instruction.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).
